// T-112, T-113, T-114, T-116, T-117 (prueba primero): controlador de un espacio de trabajo (lógica de interfaz, sin componentes).
import { describe, it, expect, beforeEach } from "vitest";
import { FakeClock, QuickCapture, migrate, migrations, type SqlParam, type SqlStore } from "@vnote/core";
import { createNodeSqliteStore } from "../../../core/tests/support/nodeSqliteStore";
import { WorkspaceController } from "./controller";

let db: SqlStore;
let clock: FakeClock;
let c: WorkspaceController;
beforeEach(async () => {
  db = await createNodeSqliteStore(":memory:");
  await migrate(db, migrations);
  clock = new FakeClock(1_000);
  c = new WorkspaceController(db, clock);
  await c.refresh();
});
const titles = () => c.getSnapshot().tree.map((n) => n.page.title);
const must = <T>(r: { ok: boolean; value?: T; error?: unknown }): T => { if (!r.ok) throw new Error(JSON.stringify(r.error)); return r.value as T; };

describe("crear páginas (T-112)", () => {
  it("crea una página en la raíz, la selecciona y actualiza el árbol", async () => {
    const p = must(await c.createPage(null, "Inicio"));
    expect(titles()).toEqual(["Inicio"]);
    expect(c.getSnapshot().selectedId).toBe(p.id);
  });
  it("crea una subpágina y expande al padre", async () => {
    const a = must(await c.createPage(null, "A"));
    const b = must(await c.createPage(a.id, "B"));
    const snap = c.getSnapshot();
    expect(snap.tree[0]!.children.map((n) => n.page.id)).toEqual([b.id]);
    expect(snap.expanded.has(a.id)).toBe(true);
    expect(snap.selectedId).toBe(b.id);
  });
  it("notifica a los suscriptores en cada cambio y deja de hacerlo al cancelar", async () => {
    let calls = 0;
    const off = c.subscribe(() => calls++);
    await c.createPage(null, "A");
    expect(calls).toBeGreaterThan(0);
    off();
    const before = calls;
    await c.createPage(null, "B");
    expect(calls).toBe(before);
  });
  it("el snapshot es inmutable entre cambios (para React)", async () => {
    const s1 = c.getSnapshot();
    expect(c.getSnapshot()).toBe(s1);
    await c.createPage(null, "A");
    expect(c.getSnapshot()).not.toBe(s1);
  });
});

describe("mover (T-113, T-114)", () => {
  it("mover una página con sus hijas la deja bajo el nuevo padre y lo expande", async () => {
    const a = must(await c.createPage(null, "A")); const b = must(await c.createPage(null, "B")); must(await c.createPage(a.id, "A1"));
    const r = await c.movePage(a.id, b.id);
    expect(r.ok).toBe(true);
    expect(titles()).toEqual(["B"]);
    expect(c.getSnapshot().expanded.has(b.id)).toBe(true);
    expect(c.getSnapshot().tree[0]!.children[0]!.children[0]!.page.title).toBe("A1");
  });
  it("mover a un descendiente devuelve el error CYCLE sin cambiar nada", async () => {
    const a = must(await c.createPage(null, "A")); const a1 = must(await c.createPage(a.id, "A1"));
    const r = await c.movePage(a.id, a1.id);
    expect(r.ok === false && r.error.code).toBe("CYCLE");
    expect(c.getSnapshot().notice).toBe("MOVE_TO_DESCENDANT");
    c.dismissNotice();
    expect(c.getSnapshot().notice).toBeNull();
    expect(titles()).toEqual(["A"]);
    expect(c.getSnapshot().tree[0]!.children.map((n) => n.page.title)).toEqual(["A1"]);
  });
  it("reordenar entre hermanas", async () => {
    const a = must(await c.createPage(null, "A")); must(await c.createPage(null, "B")); const cc = must(await c.createPage(null, "C"));
    await c.movePage(cc.id, null, { afterId: null });
    expect(titles()).toEqual(["C", "A", "B"]);
    expect(a.id).toBeTruthy();
  });
});

describe("acciones de página (T-115, T-116)", () => {
  it("renombrar, ícono y portada", async () => {
    const a = must(await c.createPage(null, "A"));
    await c.renamePage(a.id, "Nuevo"); await c.setIcon(a.id, "📓"); await c.setCover(a.id, "asset:x");
    expect(c.getSnapshot().tree[0]!.page).toMatchObject({ title: "Nuevo", icon: "📓", cover: "asset:x" });
  });
  it("favoritas: marcar y desmarcar actualiza la lista de favoritos", async () => {
    const a = must(await c.createPage(null, "A"));
    await c.toggleFavorite(a.id);
    expect(c.getSnapshot().favorites.map((p) => p.id)).toEqual([a.id]);
    await c.toggleFavorite(a.id);
    expect(c.getSnapshot().favorites).toEqual([]);
  });
  it("migas de pan de la página seleccionada", async () => {
    const a = must(await c.createPage(null, "A")); const b = must(await c.createPage(a.id, "B")); must(await c.createPage(b.id, "C"));
    expect(c.getSnapshot().breadcrumbs.map((p) => p.title)).toEqual(["A", "B"]);
  });
  it("duplicar con y sin subpáginas", async () => {
    const a = must(await c.createPage(null, "A")); must(await c.createPage(a.id, "A1"));
    await c.duplicate(a.id, { withChildren: false });
    await c.duplicate(a.id, { withChildren: true });
    expect(titles()).toEqual(["A", "A", "A"]);
    const counts = c.getSnapshot().tree.map((n) => n.children.length);
    expect(counts.sort()).toEqual([0, 1, 1]);
  });
});

describe("papelera (T-117)", () => {
  it("eliminar manda a la papelera con 30 días; restaurar la devuelve", async () => {
    const a = must(await c.createPage(null, "A"));
    await c.trashPage(a.id);
    expect(titles()).toEqual([]);
    expect(c.getSnapshot().trash.map((t) => [t.page.title, t.daysLeft])).toEqual([["A", 30]]);
    expect(c.getSnapshot().selectedId).toBeNull();
    await c.restore(a.id);
    expect(titles()).toEqual(["A"]);
    expect(c.getSnapshot().trash).toEqual([]);
  });
  it("el borrado definitivo exige confirmación", async () => {
    const a = must(await c.createPage(null, "A")); await c.trashPage(a.id);
    const no = await c.deleteForever(a.id, false);
    expect(no.ok === false && no.error.code).toBe("NEEDS_CONFIRMATION");
    expect(c.getSnapshot().trash).toHaveLength(1);
    expect((await c.deleteForever(a.id, true)).ok).toBe(true);
    expect(c.getSnapshot().trash).toEqual([]);
  });
  it("vaciar la papelera exige confirmación", async () => {
    const a = must(await c.createPage(null, "A")); const b = must(await c.createPage(null, "B"));
    await c.trashPage(a.id); await c.trashPage(b.id);
    expect((await c.emptyTrash(false)).ok).toBe(false);
    expect((await c.emptyTrash(true)).ok).toBe(true);
    expect(c.getSnapshot().trash).toEqual([]);
  });
  it("purga automática al refrescar: lo que lleva 30 días se borra", async () => {
    const a = must(await c.createPage(null, "A")); await c.trashPage(a.id);
    clock.advance(31 * 86_400_000);
    await c.refresh();
    expect(c.getSnapshot().trash).toEqual([]);
  });
});

/** Base que retrasa la PRIMERA lectura del árbol, como ocurre con la latencia real del puente nativo. */
function slowFirstTreeRead(real: SqlStore, ms: number): SqlStore {
  let delayed = false;
  return {
    ...real,
    exec: real.exec.bind(real),
    transaction: real.transaction.bind(real),
    close: real.close.bind(real),
    query: (async (sql: string, params?: readonly SqlParam[]) => {
      const rows = await real.query(sql, params);
      if (!delayed && /FROM pages WHERE deleted_at IS NULL ORDER BY position/.test(sql)) {
        delayed = true;
        await new Promise((r) => setTimeout(r, ms));
      }
      return rows;
    }) as SqlStore["query"],
  };
}

describe("concurrencia (se detectó en el e2e del editor)", () => {
  it("una recarga antigua que termina tarde no pisa los cambios más recientes del árbol", async () => {
    const slow = new WorkspaceController(slowFirstTreeRead(db, 60), clock);
    const a = must(await new WorkspaceController(db, clock).createPage(null, "Sin título"));
    const stale = slow.refresh(); // lee el árbol ANTES del renombrado y tarda en terminar
    await new Promise((r) => setTimeout(r, 5));
    await new WorkspaceController(db, clock).renamePage(a.id, "Renombrada");
    await slow.refresh(); // recarga posterior: ve el renombrado
    await stale; // la antigua termina al final
    expect(slow.getSnapshot().tree.map((n) => n.page.title)).toEqual(["Renombrada"]);
  });
  it("una recarga no revierte una selección posterior", async () => {
    const slow = new WorkspaceController(slowFirstTreeRead(db, 60), clock);
    const writer = new WorkspaceController(db, clock);
    const a = must(await writer.createPage(null, "A"));
    const b = must(await writer.createPage(null, "B"));
    await slow.select(a.id);
    const stale = slow.refresh();
    await new Promise((r) => setTimeout(r, 5));
    await slow.select(b.id);
    await stale;
    expect(slow.getSnapshot().selectedId).toBe(b.id);
  });
  it("crear y renombrar seguidos dejan el nombre final y la selección", async () => {
    const created = must(await c.createPage(null, ""));
    await c.renamePage(created.id, "Final");
    expect(c.getSnapshot().tree.map((n) => n.page.title)).toEqual(["Final"]);
    expect(c.getSnapshot().selectedId).toBe(created.id);
  });
});

describe("enlaces entre páginas (T-359, T-361, T-362, T-363)", () => {
  it("findPages busca por título (con y sin texto) y excluye lo eliminado", async () => {
    const a = must(await c.createPage(null, "Proyecto Alfa"));
    must(await c.createPage(null, "Proyecto Beta"));
    const g = must(await c.createPage(null, "Gamma"));
    must(await c.trashPage(g.id));
    expect((await c.findPages("proy")).map((p) => p.title).sort()).toEqual(["Proyecto Alfa", "Proyecto Beta"]);
    expect((await c.findPages("")).map((p) => p.title).sort()).toEqual(["Proyecto Alfa", "Proyecto Beta"]);
    expect((await c.findPages("alfa")).map((p) => p.id)).toEqual([a.id]);
    expect(await c.findPages("zzz")).toEqual([]);
  });
  it("resolveLink refleja renombrar, papelera y restauración; backlinks lista quién enlaza", async () => {
    const a = must(await c.createPage(null, "A"));
    const b = must(await c.createPage(null, "B"));
    expect(await c.backlinks(b.id)).toEqual([]);
    await db.exec("INSERT INTO links(from_page_id, to_page_id) VALUES (?, ?)", [a.id, b.id]);
    expect((await c.backlinks(b.id)).map((p) => p.title)).toEqual(["A"]);
    await c.renamePage(b.id, "B2");
    expect(await c.resolveLink(b.id)).toEqual({ state: "ok", id: b.id, title: "B2" });
    await c.trashPage(b.id);
    expect((await c.resolveLink(b.id)).state).toBe("trashed");
    must(await c.restore(b.id));
    expect((await c.resolveLink(b.id)).state).toBe("ok");
    expect((await c.resolveLink("no-existe")).state).toBe("missing");
  });
});

describe("notas de la bandeja (T-379)", () => {
  it("reconoce una nota de la bandeja y la mueve a otra página", async () => {
    const dest = must(await c.createPage(null, "Proyectos"));
    const note = must(await new QuickCapture(db, clock, "Bandeja").confirm("idea suelta"));
    expect(await c.isInboxNote(note.id)).toBe(true);
    expect(await c.isInboxNote(dest.id)).toBe(false);
    must(await c.moveInboxNote(note.id, dest.id));
    expect(await c.isInboxNote(note.id)).toBe(false);
    await c.refresh();
    expect(c.getSnapshot().tree.find((n) => n.page.id === dest.id)!.children.map((n) => n.page.id)).toEqual([note.id]);
  });
  it("la convierte en tarjeta de un tablero", async () => {
    const board = must(await c.createDatabase(null, "board"));
    const dbId = (await c.listDatabases())[0]!.id;
    const note = must(await new QuickCapture(db, clock, "Bandeja").confirm("pagar luz"));
    must(await c.inboxToCard(note.id, dbId));
    expect(await c.isInboxNote(note.id)).toBe(false);
    expect(board.kind).toBe("board");
  });
});

