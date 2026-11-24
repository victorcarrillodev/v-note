// T-372, T-374, T-375, T-376, T-378, T-379 (núcleo; prueba primero): captura rápida — borrador continuo, bandeja, espacio predeterminado y conversión.
import { describe, it, expect, beforeEach } from "vitest";
import { createNodeSqliteStore } from "../../tests/support/nodeSqliteStore";
import { MemoryConfigStore, MemoryWorkspaceStorage } from "../../tests/support/memoryPorts";
import { FakeClock } from "../clock";
import { migrate } from "../db/migrate";
import { migrations } from "../db/migrations";
import { BoardService } from "../databases/boardService";
import { DatabaseService } from "../databases/databaseService";
import { ViewService } from "../databases/viewService";
import { fromYjs } from "../blocks/fromYjs";
import { DocStore } from "../docs/docStore";
import { PagesRepo } from "../pages/pagesRepo";
import type { SqlStore } from "../ports/sqlStore";
import { WorkspaceManager } from "../workspaces/workspaceManager";
import { QuickCapture, resolveCaptureTarget } from "./quickCapture";

let db: SqlStore, clock: FakeClock, cap: QuickCapture, repo: PagesRepo;
const must = <T,>(r: { ok: boolean; value?: T; error?: { message: string } }): T => { if (!r.ok) throw new Error(r.error?.message); return r.value as T; };
beforeEach(async () => {
  db = await createNodeSqliteStore(":memory:");
  expect((await migrate(db, migrations)).ok).toBe(true);
  clock = new FakeClock(5_000);
  cap = new QuickCapture(db, clock, "Bandeja de entrada");
  repo = new PagesRepo(db, clock);
});

describe("migración del borrador (T-372)", () => {
  it("crea la tabla con una sola fila posible", async () => {
    expect((await db.query<{ name: string }>("PRAGMA table_info(quick_capture_draft)")).map((c) => c.name)).toEqual(["id", "text", "updated_at"]);
    await db.exec("INSERT INTO quick_capture_draft(id, text, updated_at) VALUES (1, 'a', 0)");
    await expect(db.exec("INSERT INTO quick_capture_draft(id, text, updated_at) VALUES (2, 'b', 0)")).rejects.toThrow();
  });
});

describe("borrador continuo (T-374, T-376)", () => {
  it("existe tras cada edición y se recupera en la siguiente apertura", async () => {
    expect(await cap.getDraft()).toBeNull();
    await cap.saveDraft("comprar");
    expect(await cap.getDraft()).toBe("comprar");
    await cap.saveDraft("comprar leche");
    expect(await cap.getDraft()).toBe("comprar leche");
    expect(await new QuickCapture(db, clock, "x").getDraft()).toBe("comprar leche"); // otra instancia = otra apertura
  });
  it("un texto vacío o solo espacios borra el borrador; descartar también", async () => {
    await cap.saveDraft("algo"); await cap.saveDraft("   ");
    expect(await cap.getDraft()).toBeNull();
    await cap.saveDraft("otra"); await cap.discardDraft();
    expect(await cap.getDraft()).toBeNull();
  });
});

describe("confirmar guarda en la bandeja (T-375, CL-16)", () => {
  it("crea una nota hija de la Bandeja con el texto completo y limpia el borrador", async () => {
    await cap.saveDraft("Llamar a Ana\nsobre el contrato");
    const note = must(await cap.confirm("Llamar a Ana\nsobre el contrato"));
    expect(note.title).toBe("Llamar a Ana");
    const inbox = (await repo.children(null)).find((p) => p.title === "Bandeja de entrada")!;
    expect((await cap.inboxNotes()).map((p) => p.id)).toEqual([note.id]);
    expect(note.parentId).toBe(inbox.id);
    const doc = must(await new DocStore(db, clock).load(note.id));
    expect(fromYjs(doc.getXmlFragment("doc")).map((b) => (b.content as { text: string }[]).map((t) => t.text).join(""))).toEqual(["Llamar a Ana", "sobre el contrato"]);
    expect(await cap.getDraft()).toBeNull();
  });
  it("las notas se listan de la más reciente a la más antigua; la bandeja se recrea si estaba en la papelera", async () => {
    const a = must(await cap.confirm("primera")); clock.advance(10);
    const inbox = (await repo.children(null)).find((p) => p.title === "Bandeja de entrada")!;
    must(await repo.trash(inbox.id));
    const b = must(await cap.confirm("segunda"));
    expect(b.parentId).not.toBe(inbox.id);
    const notes = await cap.inboxNotes();
    expect(notes.map((p) => p.title)).toEqual(["segunda"]);
    expect(a.title).toBe("primera");
  });
  it("rechaza un texto vacío sin crear nada", async () => {
    const r = await cap.confirm("  \n ");
    expect(r.ok).toBe(false);
    expect(await repo.children(null)).toEqual([]);
  });
  it("el título se recorta a 80 caracteres pero el texto se conserva entero", async () => {
    const long = "x".repeat(200);
    const n = must(await cap.confirm(long));
    expect(n.title).toHaveLength(80);
    const doc = must(await new DocStore(db, clock).load(n.id));
    expect(fromYjs(doc.getXmlFragment("doc"))[0]!.content).toEqual([{ type: "text", text: long, styles: {} }]);
  });
});

describe("Markdown ligero en la captura (captura-markdown)", () => {
  it("convierte marcadores de línea en bloques y quita el marcador del título", async () => {
    const note = must(await cap.confirm("# Plan\n- uno\n* dos\n1. tres\n- [ ] pendiente\n- [x] hecho\ntexto"));
    expect(note.title).toBe("Plan");
    const doc = must(await new DocStore(db, clock).load(note.id));
    const blocks = fromYjs(doc.getXmlFragment("doc"));
    const text = (b: { content: unknown }) => (b.content as { text: string }[]).map((t) => t.text).join("");
    expect(blocks.map((b) => [b.type, text(b)])).toEqual([
      ["heading", "Plan"], ["bulletListItem", "uno"], ["bulletListItem", "dos"], ["numberedListItem", "tres"],
      ["checkListItem", "pendiente"], ["checkListItem", "hecho"], ["paragraph", "texto"],
    ]);
    expect(blocks[0]!.props).toMatchObject({ level: 1 });
    expect(blocks[4]!.props).toMatchObject({ checked: false });
    expect(blocks[5]!.props).toMatchObject({ checked: true });
  });
  it("sin marcadores el comportamiento no cambia", async () => {
    const note = must(await cap.confirm("Llamar a Ana"));
    expect(note.title).toBe("Llamar a Ana");
  });
});

describe("mover o convertir una nota de la bandeja (T-379)", () => {
  it("moverla a otro lugar del árbol la saca de la bandeja", async () => {
    const dest = must(await repo.create({ title: "Proyectos" }));
    const n = must(await cap.confirm("idea"));
    must(await cap.moveNote(n.id, dest.id));
    expect(await cap.inboxNotes()).toEqual([]);
    expect((await repo.children(dest.id)).map((p) => p.id)).toEqual([n.id]);
    const m = must(await cap.confirm("otra"));
    must(await cap.moveNote(m.id, null));
    expect((await repo.children(null)).some((p) => p.id === m.id)).toBe(true);
  });
  it("convertirla en tarjeta la añade a un tablero (primera columna por defecto) y la saca de la bandeja", async () => {
    const boards = new BoardService(new DatabaseService(db, clock), new ViewService(db));
    const board = must(await boards.createBoard({ name: "Tareas" }));
    const n = must(await cap.confirm("pagar luz"));
    must(await cap.toCard(n.id, board.databaseId));
    expect(await cap.inboxNotes()).toEqual([]);
    const data = must(await boards.read(board.databaseId));
    const firstColumn = data.columns[0]!;
    expect(firstColumn.cards.map((c) => c.pageId)).toContain(n.id);
  });
  it("solo se pueden mover notas que están en la bandeja", async () => {
    const p = must(await repo.create({ title: "Suelta" }));
    expect((await cap.moveNote(p.id, null)).ok).toBe(false);
  });
});

describe("espacio de destino (T-377, T-378, CL-30)", () => {
  let mgr: WorkspaceManager;
  beforeEach(() => { mgr = new WorkspaceManager(new MemoryConfigStore(), new MemoryWorkspaceStorage(), clock); });
  it("sin espacios no hay destino", async () => {
    expect(await resolveCaptureTarget(mgr)).toEqual({ status: "empty" });
  });
  it("el primer espacio es el predeterminado; se puede cambiar", async () => {
    const a = must(await mgr.create({ name: "A" })), b = must(await mgr.create({ name: "B" }));
    expect(await resolveCaptureTarget(mgr)).toEqual({ status: "ready", workspace: expect.objectContaining({ id: a.id }) });
    must(await mgr.setCaptureDefault(b.id));
    expect(await resolveCaptureTarget(mgr)).toEqual({ status: "ready", workspace: expect.objectContaining({ id: b.id }) });
  });
  it("si el predeterminado se eliminó, pide elegir otro entre los que quedan", async () => {
    const a = must(await mgr.create({ name: "A" })); const b = must(await mgr.create({ name: "B" }));
    must(await mgr.delete(a.id, { typedName: "A" }));
    const r = await resolveCaptureTarget(mgr);
    expect(r.status).toBe("choose");
    if (r.status === "choose") expect(r.workspaces.map((w) => w.id)).toEqual([b.id]);
    must(await mgr.setCaptureDefault(b.id));
    expect((await resolveCaptureTarget(mgr)).status).toBe("ready");
  });
});
