// T-279…T-282, T-287, T-288 (prueba primero): tableros kanban como una vista más de una base de datos con una propiedad de estado.
import { describe, it, expect, beforeEach } from "vitest";
import { createNodeSqliteStore } from "../../tests/support/nodeSqliteStore";
import { FakeClock } from "../clock";
import { migrate } from "../db/migrate";
import { migrations } from "../db/migrations";
import { PagesRepo } from "../pages/pagesRepo";
import type { SqlStore } from "../ports/sqlStore";
import { BoardService } from "./boardService";
import { DatabaseService } from "./databaseService";
import { ViewService } from "./viewService";

let db: SqlStore, boards: BoardService, svc: DatabaseService, views: ViewService, repo: PagesRepo;
const must = <T,>(r: { ok: boolean; value?: T; error?: { message: string } }): T => { if (!r.ok) throw new Error(r.error?.message); return r.value as T; };
beforeEach(async () => {
  db = await createNodeSqliteStore(":memory:");
  await migrate(db, migrations);
  const clock = new FakeClock(1_000);
  svc = new DatabaseService(db, clock);
  views = new ViewService(db);
  boards = new BoardService(svc, views);
  repo = new PagesRepo(db, clock);
});
const titles = async (b: { databaseId: string }, col: string) => {
  const res = must(await boards.read(b.databaseId));
  return res.columns.find((c) => c.id === col)!.cards.map((c) => c.title);
};

describe("crear un tablero (T-279)", () => {
  it("crea una base con propiedad de estado y una vista tablero con las columnas Por hacer, En curso y Hecho", async () => {
    const b = must(await boards.createBoard({ name: "Proyecto" }));
    const props = await svc.listProperties(b.databaseId);
    expect(props.map((p) => p.type)).toEqual(["status"]);
    const view = (await views.list(b.databaseId)).find((v) => v.type === "board")!;
    expect(view.config.groupBy).toBe(props[0]!.id);
    const read = must(await boards.read(b.databaseId));
    expect(read.columns.map((c) => c.name)).toEqual(["Por hacer", "En curso", "Hecho"]);
  });
  it("la página del tablero es de tipo «board»", async () => {
    const b = must(await boards.createBoard({ name: "Proyecto" }));
    const d = must(await svc.getDatabase(b.databaseId));
    expect(must(await repo.get(d.pageId!)).kind).toBe("board");
  });
  it("el mismo conjunto de tarjetas se ve también como vista de tabla de la misma base (RF-22)", async () => {
    const b = must(await boards.createBoard({ name: "Proyecto" }));
    must(await boards.createCard(b.databaseId, { title: "T1", columnId: "todo" }));
    const table = (await views.list(b.databaseId)).find((v) => v.type === "table")!;
    const res = must(await views.run(svc, table.id));
    expect(res.rows.map((r) => r.title)).toEqual(["T1"]);
  });
});

describe("columnas (T-280, T-281)", () => {
  it("crear, renombrar y reordenar", async () => {
    const b = must(await boards.createBoard({ name: "P" }));
    const rev = must(await boards.addColumn(b.databaseId, "Revisión"));
    expect(must(await boards.read(b.databaseId)).columns.map((c) => c.name)).toEqual(["Por hacer", "En curso", "Hecho", "Revisión"]);
    must(await boards.renameColumn(b.databaseId, rev.id, "En revisión"));
    must(await boards.moveColumn(b.databaseId, rev.id, "todo")); // tras «Por hacer»
    expect(must(await boards.read(b.databaseId)).columns.map((c) => c.name)).toEqual(["Por hacer", "En revisión", "En curso", "Hecho"]);
    must(await boards.moveColumn(b.databaseId, rev.id, null)); // al inicio
    expect(must(await boards.read(b.databaseId)).columns[0]!.name).toBe("En revisión");
  });
  it("nombres vacíos o repetidos se rechazan", async () => {
    const b = must(await boards.createBoard({ name: "P" }));
    expect((await boards.addColumn(b.databaseId, "  ")).ok).toBe(false);
    expect((await boards.addColumn(b.databaseId, "hecho")).ok).toBe(false);
    expect((await boards.renameColumn(b.databaseId, "todo", "En curso")).ok).toBe(false);
  });
  it("eliminar una columna vacía la quita sin más", async () => {
    const b = must(await boards.createBoard({ name: "P" }));
    const c = must(await boards.addColumn(b.databaseId, "Extra"));
    must(await boards.deleteColumn(b.databaseId, c.id));
    expect(must(await boards.read(b.databaseId)).columns.map((x) => x.name)).toEqual(["Por hacer", "En curso", "Hecho"]);
  });
  it("eliminar una columna con tarjetas exige confirmar y elegir a dónde van las tarjetas", async () => {
    const b = must(await boards.createBoard({ name: "P" }));
    must(await boards.createCard(b.databaseId, { title: "A", columnId: "in_progress" })); must(await boards.createCard(b.databaseId, { title: "B", columnId: "in_progress" }));
    const info = must(await boards.describeColumnDeletion(b.databaseId, "in_progress"));
    expect(info.cardCount).toBe(2);
    const r = await boards.deleteColumn(b.databaseId, "in_progress");
    expect(!r.ok && r.error.code).toBe("NEEDS_CONFIRMATION");
    expect(await titles(b, "in_progress")).toEqual(["A", "B"]); // nada cambió
    must(await boards.deleteColumn(b.databaseId, "in_progress", { moveTo: "done" }));
    expect(await titles(b, "done")).toEqual(["A", "B"]);
    expect(must(await boards.read(b.databaseId)).columns.map((c) => c.name)).toEqual(["Por hacer", "Hecho"]);
  });
  it("no se puede mover las tarjetas a la misma columna que se borra ni a una inexistente; y no se borra la última columna", async () => {
    const b = must(await boards.createBoard({ name: "P" }));
    must(await boards.createCard(b.databaseId, { title: "A", columnId: "todo" }));
    expect((await boards.deleteColumn(b.databaseId, "todo", { moveTo: "todo" })).ok).toBe(false);
    expect((await boards.deleteColumn(b.databaseId, "todo", { moveTo: "zzz" })).ok).toBe(false);
    must(await boards.deleteColumn(b.databaseId, "in_progress")); must(await boards.deleteColumn(b.databaseId, "done", { moveTo: "todo" }));
    expect((await boards.deleteColumn(b.databaseId, "todo", { moveTo: "todo" })).ok).toBe(false);
    expect(must(await boards.read(b.databaseId)).columns).toHaveLength(1);
  });
});

describe("tarjetas (T-282, T-283…)", () => {
  it("crear una tarjeta crea una página completa más su fila, en la columna elegida", async () => {
    const b = must(await boards.createBoard({ name: "P" }));
    const card = must(await boards.createCard(b.databaseId, { title: "Escribir informe", columnId: "in_progress" }));
    const page = must(await repo.get(card.pageId));
    expect(page.title).toBe("Escribir informe");
    expect(page.kind).toBe("note");
    expect(await titles(b, "in_progress")).toEqual(["Escribir informe"]);
  });
  it("sin columna indicada cae en la primera", async () => {
    const b = must(await boards.createBoard({ name: "P" }));
    must(await boards.createCard(b.databaseId, { title: "X" }));
    expect(await titles(b, "todo")).toEqual(["X"]);
  });
  it("una columna inexistente se rechaza y no deja páginas huérfanas", async () => {
    const b = must(await boards.createBoard({ name: "P" }));
    const before = (await db.query("SELECT id FROM pages")).length;
    expect((await boards.createCard(b.databaseId, { title: "X", columnId: "zzz" })).ok).toBe(false);
    expect((await db.query("SELECT id FROM pages")).length).toBe(before);
  });
  it("mover una tarjeta entre columnas cambia su estado, y el orden se respeta", async () => {
    const b = must(await boards.createBoard({ name: "P" }));
    const a = must(await boards.createCard(b.databaseId, { title: "A", columnId: "todo" }));
    must(await boards.createCard(b.databaseId, { title: "B", columnId: "todo" }));
    const c = must(await boards.createCard(b.databaseId, { title: "C", columnId: "done" }));
    must(await boards.moveCard(b.databaseId, a.pageId, "done", c.pageId)); // A pasa a «Hecho», después de C
    expect(await titles(b, "todo")).toEqual(["B"]);
    expect(await titles(b, "done")).toEqual(["C", "A"]);
    must(await boards.moveCard(b.databaseId, a.pageId, "done", null)); // al inicio de «Hecho»
    expect(await titles(b, "done")).toEqual(["A", "C"]);
  });
  it("reordenar dentro de la misma columna", async () => {
    const b = must(await boards.createBoard({ name: "P" }));
    const [x, y, z] = [must(await boards.createCard(b.databaseId, { title: "X", columnId: "todo" })), must(await boards.createCard(b.databaseId, { title: "Y", columnId: "todo" })), must(await boards.createCard(b.databaseId, { title: "Z", columnId: "todo" }))];
    must(await boards.moveCard(b.databaseId, z.pageId, "todo", null));
    expect(await titles(b, "todo")).toEqual(["Z", "X", "Y"]);
    must(await boards.moveCard(b.databaseId, x.pageId, "todo", y.pageId));
    expect(await titles(b, "todo")).toEqual(["Z", "Y", "X"]);
  });
  it("el orden y el estado persisten (se leen de nuevo desde la base)", async () => {
    const b = must(await boards.createBoard({ name: "P" }));
    const a = must(await boards.createCard(b.databaseId, { title: "A", columnId: "todo" }));
    must(await boards.moveCard(b.databaseId, a.pageId, "in_progress", null));
    const other = new BoardService(new DatabaseService(db, new FakeClock(5)), new ViewService(db));
    const read = must(await other.read(b.databaseId));
    expect(read.columns.find((c) => c.id === "in_progress")!.cards.map((c) => c.title)).toEqual(["A"]);
  });
  it("mover a una columna que no existe o una tarjeta que no es del tablero se rechaza", async () => {
    const b = must(await boards.createBoard({ name: "P" }));
    const a = must(await boards.createCard(b.databaseId, { title: "A" }));
    expect((await boards.moveCard(b.databaseId, a.pageId, "zzz", null)).ok).toBe(false);
    expect((await boards.moveCard(b.databaseId, "no-existe", "done", null)).ok).toBe(false);
  });
});

describe("tarjetas y papelera (T-287, CL-7) y estados independientes (T-288, CL-34)", () => {
  it("una tarjeta eliminada desde fuera desaparece del tablero y vuelve al restaurarla, en su columna y su sitio", async () => {
    const b = must(await boards.createBoard({ name: "P" }));
    must(await boards.createCard(b.databaseId, { title: "A", columnId: "todo" }));
    const m = must(await boards.createCard(b.databaseId, { title: "B", columnId: "todo" }));
    must(await boards.createCard(b.databaseId, { title: "C", columnId: "todo" }));
    must(await repo.trash(m.pageId));
    expect(await titles(b, "todo")).toEqual(["A", "C"]);
    must(await repo.restore(m.pageId));
    expect(await titles(b, "todo")).toEqual(["A", "B", "C"]);
  });
  it("una misma página en dos tableros: moverla en uno no cambia su estado en el otro", async () => {
    const b1 = must(await boards.createBoard({ name: "Uno" })), b2 = must(await boards.createBoard({ name: "Dos" }));
    const card = must(await boards.createCard(b1.databaseId, { title: "Compartida", columnId: "todo" }));
    must(await svc.addExistingPage(b2.databaseId, card.pageId));
    must(await boards.moveCard(b1.databaseId, card.pageId, "done", null));
    expect(await titles(b1, "done")).toEqual(["Compartida"]);
    expect(await titles(b2, "todo")).toEqual(["Compartida"]); // en el otro sigue «Por hacer»
    expect(await titles(b2, "done")).toEqual([]);
  });
});
