// U-123 a U-127 (spec 002, RF-11.1, RF-11.3, RF-11.4, DP-7): operaciones inversas definidas en el núcleo para «Deshacer».
import { describe, it, expect, beforeEach } from "vitest";
import { createNodeSqliteStore } from "../../tests/support/nodeSqliteStore";
import { FakeClock } from "../clock";
import { migrate } from "../db/migrate";
import { migrations } from "../db/migrations";
import { defaultProps, type Block } from "../blocks/types";
import { PageService } from "../pages/pageService";
import { PagesRepo, type PageNode } from "../pages/pagesRepo";
import { BoardService } from "../databases/boardService";
import { DatabaseService } from "../databases/databaseService";
import { ViewService } from "../databases/viewService";
import { TaskService, type TaskSourceWriter } from "../tasks/taskService";
import type { SqlStore } from "../ports/sqlStore";
import { trashWithUndo, moveWithUndo, duplicateWithUndo, completeTaskWithUndo, moveCardWithUndo, isUndoable } from "./undo";

let db: SqlStore, clock: FakeClock, svc: PageService, repo: PagesRepo;
const must = <T,>(r: { ok: boolean; value?: T; error?: { message: string } }): T => { if (!r.ok) throw new Error(r.error?.message); return r.value as T; };
beforeEach(async () => {
  db = await createNodeSqliteStore(":memory:");
  await migrate(db, migrations);
  clock = new FakeClock(Date.UTC(2026, 2, 5, 10, 0));
  svc = new PageService(db, clock);
  repo = new PagesRepo(db, clock);
});
const shape = (nodes: PageNode[]): unknown => nodes.map((n) => [n.page.title, shape(n.children)]);
const tree = async () => shape(await repo.tree());
const mk = async (title: string, parentId: string | null = null) => must(await svc.create({ title, parentId }));

describe("deshacer «mover a la papelera» (U-123)", () => {
  it("restaura la página y sus hijas a su lugar exacto", async () => {
    const a = await mk("A"); await mk("A1", a.id); await mk("A2", a.id); await mk("B");
    const before = await tree();
    const r = must(await trashWithUndo(repo, a.id));
    expect(await tree()).toEqual([["B", []]]);
    must(await r.undo());
    expect(await tree()).toEqual(before);
  });
  it("si el padre ya no existe, la página vuelve a la raíz", async () => {
    const p = await mk("P"); const c = await mk("C", p.id);
    const r = must(await trashWithUndo(repo, c.id));
    must(await repo.trash(p.id));
    must(await r.undo());
    const t = await tree();
    expect(JSON.stringify(t)).toContain("C");
    expect(must(await repo.get(c.id)).deletedAt).toBeNull();
  });
  it("deshacer dos veces no falla ni duplica nada", async () => {
    const a = await mk("A");
    const r = must(await trashWithUndo(repo, a.id));
    must(await r.undo());
    expect((await r.undo()).ok).toBe(true);
    expect(await tree()).toEqual([["A", []]]);
  });
});

describe("deshacer «mover página» (U-124)", () => {
  it("devuelve la página a su padre y a su posición anterior, con el orden de hermanas intacto", async () => {
    const a = await mk("A"); const b = await mk("B"); const c = await mk("C"); const d = await mk("D", a.id);
    const before = await tree();
    const r = must(await moveWithUndo(repo, c.id, a.id));
    expect(JSON.stringify(await tree())).not.toBe(JSON.stringify(before));
    must(await r.undo());
    expect(await tree()).toEqual(before);
    expect(d.id).toBeTruthy(); expect(b.id).toBeTruthy();
  });
  it("mover al inicio y deshacer conserva la posición original", async () => {
    await mk("A"); await mk("B"); const c = await mk("C");
    const before = await tree();
    const r = must(await moveWithUndo(repo, c.id, null, { afterId: null }));
    expect(await tree()).toEqual([["C", []], ["A", []], ["B", []]]);
    must(await r.undo());
    expect(await tree()).toEqual(before);
  });
  it("si la hermana anterior ya no está, vuelve al final del padre en lugar de fallar", async () => {
    const a = await mk("A"); const b = await mk("B"); const c = await mk("C");
    const r = must(await moveWithUndo(repo, c.id, a.id));
    must(await repo.trash(b.id));
    expect((await r.undo()).ok).toBe(true);
    expect(must(await repo.get(c.id)).parentId).toBeNull();
  });
  it("un movimiento inválido (a una descendiente) se rechaza y no deja nada que deshacer", async () => {
    const a = await mk("A"); const a1 = await mk("A1", a.id);
    const r = await moveWithUndo(repo, a.id, a1.id);
    expect(r.ok).toBe(false);
  });
});

describe("deshacer «duplicar» (U-125)", () => {
  it("envía la copia a la papelera y no toca el original", async () => {
    const a = await mk("A"); await mk("A1", a.id);
    const before = await tree();
    const r = must(await duplicateWithUndo(repo, a.id, { withChildren: true }));
    expect((await tree() as unknown[]).length).toBe(2);
    must(await r.undo());
    expect(await tree()).toEqual(before);
    expect(must(await repo.get(r.page.id)).deletedAt).not.toBeNull();
    expect(must(await repo.get(a.id)).deletedAt).toBeNull();
  });
});

describe("deshacer «marcar tarea hecha» (U-126)", () => {
  let tasks: TaskService; let pageId: string;
  const writes: string[] = [];
  const writer: TaskSourceWriter = { async setSchedule(t, s) { writes.push(`schedule ${t.id} ${s.due}`); }, async setDone(t, d) { writes.push(`done ${t.id} ${d}`); } };
  let n = 0;
  const block = (title: string, props: Record<string, unknown>): Block => ({ id: `b${++n}`, type: "task", props: { checked: false, due: "", remindAt: "", recurrence: "", ...props }, content: [{ type: "text", text: title, styles: {} }], children: [] });
  beforeEach(async () => { tasks = new TaskService(db, clock, writer, () => "2026-03-05T10:00"); pageId = (await mk("Nota")).id; writes.length = 0; });

  it("una tarea simple vuelve a pendiente", async () => {
    await tasks.indexPage(pageId, [block("Pagar", { due: "2026-03-10" })]);
    const t = (await tasks.list())[0]!;
    const r = must(await completeTaskWithUndo(tasks, t.id));
    expect((await tasks.get(t.id))!.done).toBe(true);
    must(await r.undo());
    expect((await tasks.get(t.id))!.done).toBe(false);
    expect(writes).toContain(`done ${t.id} false`);
  });
  it("una tarea recurrente recupera su fecha original (no la siguiente repetición)", async () => {
    await tasks.indexPage(pageId, [block("Semanal", { due: "2026-03-10", recurrence: JSON.stringify({ freq: "weekly", interval: 1 }) })]);
    const t = (await tasks.list())[0]!;
    const r = must(await completeTaskWithUndo(tasks, t.id));
    expect((await tasks.get(t.id))!.due).not.toBe("2026-03-10");
    must(await r.undo());
    const after = (await tasks.get(t.id))!;
    expect(after.due).toBe("2026-03-10");
    expect(after.done).toBe(false);
    expect(after.recurrence).toEqual(t.recurrence);
  });
  it("una tarea inexistente da error", async () => {
    expect((await completeTaskWithUndo(tasks, "nope")).ok).toBe(false);
  });
});

describe("deshacer el cambio de columna de una tarjeta (U-126)", () => {
  it("la tarjeta vuelve a su columna y a su lugar", async () => {
    const dbs = new DatabaseService(db, clock); const views = new ViewService(db); const boards = new BoardService(dbs, views);
    const b = must(await boards.createBoard({ name: "T" }));
    const read0 = must(await boards.read(b.databaseId));
    const todo = read0.columns[0]!.id, done = read0.columns[2]!.id;
    const c1 = must(await boards.createCard(b.databaseId, { title: "Uno", columnId: todo }));
    must(await boards.createCard(b.databaseId, { title: "Dos", columnId: todo }));
    const order = async (col: string) => must(await boards.read(b.databaseId)).columns.find((c) => c.id === col)!.cards.map((c) => c.title);
    const r = must(await moveCardWithUndo(boards, b.databaseId, c1.pageId, done));
    expect(await order(done)).toEqual(["Uno"]);
    expect(await order(todo)).toEqual(["Dos"]);
    must(await r.undo());
    expect(await order(todo)).toEqual(["Uno", "Dos"]);
    expect(await order(done)).toEqual([]);
  });
});

describe("lo irreversible no ofrece inversa (U-127, RF-11.3)", () => {
  it.each(["delete_forever", "empty_trash", "replace_workspace", "delete_workspace"])("«%s» no se puede deshacer", (a) => { expect(isUndoable(a)).toBe(false); });
  it.each(["trash", "move_page", "duplicate", "complete_task", "move_card"])("«%s» sí se puede deshacer", (a) => { expect(isUndoable(a)).toBe(true); });
  it("una acción desconocida no se considera deshacible (por seguridad)", () => { expect(isUndoable("rara")).toBe(false); });
});
