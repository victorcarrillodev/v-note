// T-227, T-228, T-229…T-236 (prueba primero): bases de datos, propiedades, filas y celdas, pertenencia múltiple y papelera.
import { describe, it, expect, beforeEach } from "vitest";
import { createNodeSqliteStore } from "../../tests/support/nodeSqliteStore";
import { FakeClock } from "../clock";
import { migrate } from "../db/migrate";
import { migrations } from "../db/migrations";
import { PageService } from "../pages/pageService";
import { PagesRepo } from "../pages/pagesRepo";
import type { SqlStore } from "../ports/sqlStore";
import { DatabaseService } from "./databaseService";

let db: SqlStore, clock: FakeClock, svc: DatabaseService, pages: PageService, repo: PagesRepo;
const must = <T,>(r: { ok: boolean; value?: T; error?: { message: string } }): T => { if (!r.ok) throw new Error(r.error?.message); return r.value as T; };
beforeEach(async () => {
  db = await createNodeSqliteStore(":memory:");
  await migrate(db, migrations);
  clock = new FakeClock(1_000);
  svc = new DatabaseService(db, clock);
  pages = new PageService(db, clock);
  repo = new PagesRepo(db, clock);
});

describe("crear una base de datos (T-227)", () => {
  it("como página completa: crea una página de tipo «database» y la base la tiene como página", async () => {
    const d = must(await svc.createDatabase({ name: "Proyectos" }));
    expect(d.name).toBe("Proyectos");
    expect(d.pageId).not.toBeNull();
    expect(d.hostPageId).toBeNull();
    const page = must(await repo.get(d.pageId!));
    expect(page.kind).toBe("database");
    expect(page.title).toBe("Proyectos");
  });
  it("en línea: queda dentro de una nota anfitriona y no crea página propia", async () => {
    const host = must(await pages.create({ title: "Mi nota" }));
    const d = must(await svc.createDatabase({ name: "Tareas", hostPageId: host.id }));
    expect(d.pageId).toBeNull();
    expect(d.hostPageId).toBe(host.id);
    expect((await db.query("SELECT id FROM pages")).length).toBe(1);
  });
  it("una nota anfitriona inexistente se rechaza", async () => {
    expect((await svc.createDatabase({ name: "X", hostPageId: "no-existe" })).ok).toBe(false);
  });
  it("nace con una vista de tabla por defecto", async () => {
    const d = must(await svc.createDatabase({ name: "A" }));
    const views = await db.query<{ type: string }>("SELECT type FROM views WHERE database_id = ?", [d.id]);
    expect(views.map((v) => v.type)).toEqual(["table"]);
  });
  it("puede colgar de una página padre en el árbol", async () => {
    const parent = must(await pages.create({ title: "Carpeta" }));
    const d = must(await svc.createDatabase({ name: "Hija", parentId: parent.id }));
    expect(must(await repo.get(d.pageId!)).parentId).toBe(parent.id);
  });
});

describe("propiedades (T-228)", () => {
  let dbId: string;
  beforeEach(async () => { dbId = must(await svc.createDatabase({ name: "Base" })).id; });

  it("crear: devuelve la propiedad con su tipo y configuración por defecto, y las lista en orden", async () => {
    const a = must(await svc.addProperty(dbId, { name: "Estado", type: "status" }));
    must(await svc.addProperty(dbId, { name: "Prioridad", type: "select" }));
    must(await svc.addProperty(dbId, { name: "Costo", type: "number" }));
    expect(a.config.options).toHaveLength(3);
    expect((await svc.listProperties(dbId)).map((p) => p.name)).toEqual(["Estado", "Prioridad", "Costo"]);
  });
  it("rechaza nombres vacíos o repetidos (sin distinguir mayúsculas) y tipos desconocidos", async () => {
    must(await svc.addProperty(dbId, { name: "Costo", type: "number" }));
    expect((await svc.addProperty(dbId, { name: "  ", type: "text" })).ok).toBe(false);
    expect((await svc.addProperty(dbId, { name: "costo", type: "text" })).ok).toBe(false);
    expect((await svc.addProperty(dbId, { name: "Raro", type: "mapa" as never })).ok).toBe(false);
  });
  it("renombrar: cambia el nombre y respeta la unicidad", async () => {
    const a = must(await svc.addProperty(dbId, { name: "A", type: "text" }));
    must(await svc.addProperty(dbId, { name: "B", type: "text" }));
    expect(must(await svc.renameProperty(a.id, "Nuevo")).name).toBe("Nuevo");
    expect((await svc.renameProperty(a.id, "b")).ok).toBe(false);
    expect((await svc.renameProperty("zzz", "X")).ok).toBe(false);
  });
  it("ordenar: mover una propiedad al inicio, al final o tras otra", async () => {
    const [a, b, c] = [must(await svc.addProperty(dbId, { name: "A", type: "text" })), must(await svc.addProperty(dbId, { name: "B", type: "text" })), must(await svc.addProperty(dbId, { name: "C", type: "text" }))];
    const names = async () => (await svc.listProperties(dbId)).map((p) => p.name).join("");
    must(await svc.moveProperty(c.id, null)); expect(await names()).toBe("CAB");
    must(await svc.moveProperty(c.id, undefined)); expect(await names()).toBe("ABC");
    must(await svc.moveProperty(a.id, b.id)); expect(await names()).toBe("BAC");
  });
  it("borrar: quita la propiedad y los valores de esa columna, sin tocar las demás", async () => {
    const a = must(await svc.addProperty(dbId, { name: "A", type: "text" }));
    const b = must(await svc.addProperty(dbId, { name: "B", type: "text" }));
    const row = must(await svc.addRow(dbId, { title: "Fila" }));
    must(await svc.setCell(dbId, row.pageId, a.id, "uno")); must(await svc.setCell(dbId, row.pageId, b.id, "dos"));
    must(await svc.deleteProperty(a.id));
    const rows = await svc.getRows(dbId);
    expect(rows[0]!.values).toEqual({ [b.id]: "dos" });
    expect((await svc.listProperties(dbId)).map((p) => p.name)).toEqual(["B"]);
  });
  it("cambiar las opciones de una selección limpia los valores que usaban una opción eliminada", async () => {
    const p = must(await svc.addProperty(dbId, { name: "Prio", type: "select", config: { options: [{ id: "a", name: "Alta" }, { id: "b", name: "Baja" }] } }));
    const r1 = must(await svc.addRow(dbId, { title: "1" })), r2 = must(await svc.addRow(dbId, { title: "2" }));
    must(await svc.setCell(dbId, r1.pageId, p.id, "a")); must(await svc.setCell(dbId, r2.pageId, p.id, "b"));
    must(await svc.updatePropertyConfig(p.id, { options: [{ id: "b", name: "Baja (renombrada)" }] }));
    const rows = await svc.getRows(dbId);
    expect(rows.find((r) => r.pageId === r1.pageId)!.values[p.id] ?? null).toBeNull();
    expect(rows.find((r) => r.pageId === r2.pageId)!.values[p.id]).toBe("b");
  });
});

describe("filas y celdas (T-229…T-234)", () => {
  let dbId: string;
  beforeEach(async () => { dbId = must(await svc.createDatabase({ name: "Base" })).id; });

  it("una fila nueva es una página completa hija de la base, con título", async () => {
    const r = must(await svc.addRow(dbId, { title: "Tarea 1" }));
    const page = must(await repo.get(r.pageId));
    expect(page.title).toBe("Tarea 1");
    expect(page.kind).toBe("note");
    const rows = await svc.getRows(dbId);
    expect(rows.map((x) => x.title)).toEqual(["Tarea 1"]);
  });
  it("las filas conservan el orden de creación", async () => {
    for (const t of ["a", "b", "c"]) must(await svc.addRow(dbId, { title: t }));
    expect((await svc.getRows(dbId)).map((r) => r.title)).toEqual(["a", "b", "c"]);
  });
  it("setCell valida por tipo y guarda el valor normalizado", async () => {
    const n = must(await svc.addProperty(dbId, { name: "Costo", type: "number" }));
    const r = must(await svc.addRow(dbId, { title: "x" }));
    expect(must(await svc.setCell(dbId, r.pageId, n.id, "42"))).toBe(42);
    expect((await svc.setCell(dbId, r.pageId, n.id, "abc")).ok).toBe(false);
    expect((await svc.getRows(dbId))[0]!.values[n.id]).toBe(42); // el valor inválido no pisó al válido
  });
  it("vaciar la celda la elimina", async () => {
    const t = must(await svc.addProperty(dbId, { name: "Nota", type: "text" }));
    const r = must(await svc.addRow(dbId, { title: "x" }));
    must(await svc.setCell(dbId, r.pageId, t.id, "hola"));
    must(await svc.setCell(dbId, r.pageId, t.id, ""));
    expect((await svc.getRows(dbId))[0]!.values[t.id] ?? null).toBeNull();
    expect((await db.query("SELECT * FROM cell_values")).length).toBe(0);
  });
  it("las propiedades calculadas no se escriben", async () => {
    const c = must(await svc.addProperty(dbId, { name: "Creado", type: "created_time" }));
    const r = must(await svc.addRow(dbId, { title: "x" }));
    expect((await svc.setCell(dbId, r.pageId, c.id, "2026-01-01")).ok).toBe(false);
  });
  it("las fechas automáticas salen de la creación y de la última edición", async () => {
    const created = must(await svc.addProperty(dbId, { name: "Creado", type: "created_time" }));
    const edited = must(await svc.addProperty(dbId, { name: "Editado", type: "last_edited_time" }));
    const t = must(await svc.addProperty(dbId, { name: "Nota", type: "text" }));
    const r = must(await svc.addRow(dbId, { title: "x" }));
    const t0 = new Date(clock.now()).toISOString();
    clock.advance(60_000);
    must(await svc.setCell(dbId, r.pageId, t.id, "cambio"));
    const row = (await svc.getRows(dbId))[0]!;
    expect(row.values[created.id]).toBe(t0);
    expect(row.values[edited.id]).toBe(new Date(clock.now()).toISOString());
  });
  it("estado: una fila nueva empieza en «Por hacer» y puede pasar por los tres estados (T-234)", async () => {
    const s = must(await svc.addProperty(dbId, { name: "Estado", type: "status" }));
    const r = must(await svc.addRow(dbId, { title: "x" }));
    const val = async () => (await svc.getRows(dbId))[0]!.values[s.id];
    expect(await val()).toBe("todo");
    must(await svc.setCell(dbId, r.pageId, s.id, "in_progress")); expect(await val()).toBe("in_progress");
    must(await svc.setCell(dbId, r.pageId, s.id, "done")); expect(await val()).toBe("done");
    must(await svc.setCell(dbId, r.pageId, s.id, "todo")); expect(await val()).toBe("todo");
  });
  it("addRow acepta valores iniciales y rechaza la fila entera si alguno es inválido (sin dejar una página a medias)", async () => {
    const n = must(await svc.addProperty(dbId, { name: "Costo", type: "number" }));
    must(await svc.addRow(dbId, { title: "ok", values: { [n.id]: 5 } }));
    const antes = (await db.query("SELECT id FROM pages")).length;
    expect((await svc.addRow(dbId, { title: "mal", values: { [n.id]: "no" } })).ok).toBe(false);
    expect((await db.query("SELECT id FROM pages")).length).toBe(antes);
  });
});

describe("pertenencia múltiple (T-235, CL-34)", () => {
  it("una página puede estar en varias bases con valores independientes", async () => {
    const d1 = must(await svc.createDatabase({ name: "Uno" })), d2 = must(await svc.createDatabase({ name: "Dos" }));
    const s1 = must(await svc.addProperty(d1.id, { name: "Estado", type: "status" }));
    const s2 = must(await svc.addProperty(d2.id, { name: "Estado", type: "status" }));
    const r = must(await svc.addRow(d1.id, { title: "Compartida" }));
    must(await svc.addExistingPage(d2.id, r.pageId));
    must(await svc.setCell(d1.id, r.pageId, s1.id, "done"));
    expect((await svc.getRows(d1.id))[0]!.values[s1.id]).toBe("done");
    expect((await svc.getRows(d2.id))[0]!.values[s2.id]).toBe("todo"); // el otro estado no se movió
    expect((await svc.databasesOf(r.pageId)).map((d) => d.name).sort()).toEqual(["Dos", "Uno"]);
  });
  it("no se puede añadir dos veces a la misma base, ni una página inexistente", async () => {
    const d = must(await svc.createDatabase({ name: "A" }));
    const r = must(await svc.addRow(d.id, { title: "x" }));
    expect((await svc.addExistingPage(d.id, r.pageId)).ok).toBe(false);
    expect((await svc.addExistingPage(d.id, "no-existe")).ok).toBe(false);
  });
  it("setCell rechaza una propiedad de otra base", async () => {
    const d1 = must(await svc.createDatabase({ name: "Uno" })), d2 = must(await svc.createDatabase({ name: "Dos" }));
    const p2 = must(await svc.addProperty(d2.id, { name: "T", type: "text" }));
    const r = must(await svc.addRow(d1.id, { title: "x" }));
    expect((await svc.setCell(d1.id, r.pageId, p2.id, "v")).ok).toBe(false);
  });
  it("quitar una página de una base no la borra ni la quita de las otras", async () => {
    const d1 = must(await svc.createDatabase({ name: "Uno" })), d2 = must(await svc.createDatabase({ name: "Dos" }));
    const r = must(await svc.addRow(d1.id, { title: "x" }));
    must(await svc.addExistingPage(d2.id, r.pageId));
    must(await svc.removeFromDatabase(d1.id, r.pageId));
    expect(await svc.getRows(d1.id)).toHaveLength(0);
    expect(await svc.getRows(d2.id)).toHaveLength(1);
    expect(must(await repo.get(r.pageId)).deletedAt).toBeNull();
  });
});

describe("eliminar una página que está en varias bases (T-236, CL-7)", () => {
  it("advierte en cuántas bases está y, al eliminarla, desaparece de todas; al restaurarla vuelve a todas", async () => {
    const d1 = must(await svc.createDatabase({ name: "Uno" })), d2 = must(await svc.createDatabase({ name: "Dos" }));
    const r = must(await svc.addRow(d1.id, { title: "x" }));
    must(await svc.addExistingPage(d2.id, r.pageId));
    const warning = must(await svc.describePageRemoval(r.pageId));
    expect(warning.databases.map((d) => d.name).sort()).toEqual(["Dos", "Uno"]);
    expect(warning.needsWarning).toBe(true);
    must(await repo.trash(r.pageId));
    expect(await svc.getRows(d1.id)).toHaveLength(0);
    expect(await svc.getRows(d2.id)).toHaveLength(0);
    must(await repo.restore(r.pageId));
    expect(await svc.getRows(d1.id)).toHaveLength(1);
    expect(await svc.getRows(d2.id)).toHaveLength(1);
  });
  it("una página en una sola base no necesita advertencia", async () => {
    const d = must(await svc.createDatabase({ name: "Uno" }));
    const r = must(await svc.addRow(d.id, { title: "x" }));
    expect(must(await svc.describePageRemoval(r.pageId)).needsWarning).toBe(false);
  });
  it("el borrado definitivo limpia filas y valores", async () => {
    const d = must(await svc.createDatabase({ name: "Uno" }));
    const p = must(await svc.addProperty(d.id, { name: "T", type: "text" }));
    const r = must(await svc.addRow(d.id, { title: "x" }));
    must(await svc.setCell(d.id, r.pageId, p.id, "v"));
    must(await repo.trash(r.pageId));
    must(await repo.deletePermanently(r.pageId, { confirm: true }));
    expect((await db.query("SELECT * FROM db_rows")).length).toBe(0);
    expect((await db.query("SELECT * FROM cell_values")).length).toBe(0);
  });
});
