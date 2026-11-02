// T-405 y T-406 (prueba primero): reunir de la base las páginas a exportar, con o sin hijas, y la vista elegida de una base de datos.
import { describe, it, expect, beforeEach } from "vitest";
import { createNodeSqliteStore } from "../../tests/support/nodeSqliteStore";
import { para, updateFor } from "../../tests/support/builders";
import { migrate } from "../db/migrate";
import { migrations } from "../db/migrations";
import { FakeClock } from "../clock";
import { PageService } from "../pages/pageService";
import { PagesRepo } from "../pages/pagesRepo";
import { DatabaseService } from "../databases/databaseService";
import { ViewService } from "../databases/viewService";
import { MemoryAssetStore } from "../assets/memoryAssetStore";
import type { SqlStore } from "../ports/sqlStore";
import { collectExportPages, databaseViewProvider } from "./collect";
import { exportHtml } from "./exportDocument";

let db: SqlStore, clock: FakeClock, svc: PageService, repo: PagesRepo;
beforeEach(async () => {
  db = await createNodeSqliteStore(":memory:");
  await migrate(db, migrations);
  clock = new FakeClock(Date.UTC(2026, 2, 1));
  svc = new PageService(db, clock);
  repo = new PagesRepo(db, clock);
});
async function page(title: string, body: string, parentId: string | null = null) {
  const p = await svc.create({ title, parentId });
  if (!p.ok) throw new Error("x");
  await svc.saveUpdate(p.value.id, updateFor([para(body)]));
  return p.value;
}

describe("collectExportPages", () => {
  it("sin hijas devuelve solo la página, con su contenido", async () => {
    const root = await page("Raíz", "texto raíz");
    await page("Hija", "texto hija", root.id);
    const r = await collectExportPages(db, root.id, { withChildren: false });
    expect(r.ok && r.value.map((p) => [p.title, p.depth])).toEqual([["Raíz", 0]]);
    expect(r.ok && JSON.stringify(r.value[0]!.blocks)).toContain("texto raíz");
  });
  it("con hijas las devuelve en orden de lectura, con su profundidad", async () => {
    const root = await page("Raíz", "r");
    const a = await page("A", "a", root.id);
    await page("A1", "a1", a.id);
    await page("B", "b", root.id);
    const r = await collectExportPages(db, root.id, { withChildren: true });
    expect(r.ok && r.value.map((p) => [p.title, p.depth])).toEqual([["Raíz", 0], ["A", 1], ["A1", 2], ["B", 1]]);
  });
  it("no incluye hijas que están en la papelera", async () => {
    const root = await page("Raíz", "r");
    const a = await page("A", "a", root.id);
    await page("B", "b", root.id);
    await repo.trash(a.id);
    const r = await collectExportPages(db, root.id, { withChildren: true });
    expect(r.ok && r.value.map((p) => p.title)).toEqual(["Raíz", "B"]);
  });
  it("una página inexistente o en la papelera da error", async () => {
    expect((await collectExportPages(db, "nope", { withChildren: false })).ok).toBe(false);
    const p = await page("X", "x");
    await repo.trash(p.id);
    expect((await collectExportPages(db, p.id, { withChildren: false })).ok).toBe(false);
  });
  it("una página muy honda (1 000 niveles) se exporta sin desbordar la pila", async () => {
    let parent = (await page("n0", "x")).id;
    const root = parent;
    for (let i = 1; i < 1000; i++) parent = (await svc.create({ title: `n${i}`, parentId: parent }) as { ok: true; value: { id: string } }).value.id;
    const r = await collectExportPages(db, root, { withChildren: true });
    expect(r.ok && r.value.length).toBe(1000);
  });
});

describe("vista elegida de una base de datos (T-406)", () => {
  async function sampleDb() {
    const dbs = new DatabaseService(db, clock);
    const d = await dbs.createDatabase({ name: "Tareas" });
    if (!d.ok) throw new Error("x");
    const views = new ViewService(db);
    const prop = await dbs.addProperty(d.value.id, { name: "Hecho", type: "checkbox" });
    if (!prop.ok) throw new Error("p");
    const row1 = await dbs.addRow(d.value.id, { title: "Uno" });
    const row2 = await dbs.addRow(d.value.id, { title: "Dos" });
    if (!row1.ok || !row2.ok) throw new Error("r");
    await dbs.setCell(d.value.id, row1.value.pageId, prop.value.id, true);
    const filtered = await views.create(d.value.id, { name: "Hechas", type: "table", config: { filter: { type: "group", op: "and", filters: [{ type: "condition", property: prop.value.id, op: "is", value: true }] } } });
    return { dbs, d: d.value, views, view: filtered.ok ? filtered.value : null, prop: prop.value };
  }
  it("una página de base de datos exporta la vista elegida, con solo las filas que esa vista muestra", async () => {
    const { d, view } = await sampleDb();
    expect(view).not.toBeNull();
    const r = await collectExportPages(db, d.pageId!, { withChildren: false, viewId: view!.id });
    expect(r.ok).toBe(true);
    const out = await exportHtml({ pages: r.ok ? r.value : [] }, { assets: new MemoryAssetStore(), databaseView: databaseViewProvider(db, clock) });
    expect(out.status === "done" && out.html).toContain("<caption>Tareas · Hechas</caption>");
    expect(out.status === "done" && out.html).toContain("<td>Uno</td>");
    expect(out.status === "done" && out.html).not.toContain("<td>Dos</td>");
  });
  it("sin viewId usa la primera vista de la base", async () => {
    const { d } = await sampleDb();
    const r = await collectExportPages(db, d.pageId!, { withChildren: false });
    const out = await exportHtml({ pages: r.ok ? r.value : [] }, { assets: new MemoryAssetStore(), databaseView: databaseViewProvider(db, clock) });
    expect(out.status === "done" && out.html).toContain("<td>Uno</td>");
    expect(out.status === "done" && out.html).toContain("<td>Dos</td>");
  });
  it("una vista incrustada en una nota se exporta con la vista que el bloque indica", async () => {
    const { d, view } = await sampleDb();
    const blockHost = await page("Nota", "x");
    const dv = { id: "dv1", type: "databaseView", props: { databaseId: d.id, viewId: view!.id }, content: undefined, children: [] };
    const out = await exportHtml({ pages: [{ id: blockHost.id, title: "Nota", depth: 0, blocks: [dv] }] }, { assets: new MemoryAssetStore(), databaseView: databaseViewProvider(db, clock) });
    expect(out.status === "done" && out.html).toContain("Tareas · Hechas");
  });
  it("una vista que ya no existe deja un aviso y el resto se exporta", async () => {
    const dv = { id: "dv1", type: "databaseView", props: { databaseId: "x", viewId: "y" }, content: undefined, children: [] };
    const out = await exportHtml({ pages: [{ id: "p", title: "N", depth: 0, blocks: [dv] }] }, { assets: new MemoryAssetStore(), databaseView: databaseViewProvider(db, clock) });
    expect(out.status === "done" && out.report.warnings.length).toBe(1);
  });
});
