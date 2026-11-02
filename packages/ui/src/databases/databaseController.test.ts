// Controlador de una base de datos para la interfaz: carga, edita celdas, propiedades y vistas, y notifica cambios.
import { describe, it, expect } from "vitest";
import { FakeClock, migrate, migrations, DatabaseService } from "@vnote/core";
import { createNodeSqliteStore } from "../../../core/tests/support/nodeSqliteStore";
import { DatabaseController } from "./databaseController";

async function setup() {
  const store = await createNodeSqliteStore(":memory:");
  await migrate(store, migrations);
  const clock = new FakeClock(1_000);
  const dbs = new DatabaseService(store, clock);
  const d = await dbs.createDatabase({ name: "Gastos" });
  if (!d.ok) throw new Error("x");
  const c = await DatabaseController.forPage(store, clock, d.value.pageId!);
  if (!c) throw new Error("sin controlador");
  return { store, clock, dbs, c, dbId: d.value.id, pageId: d.value.pageId! };
}
const must = <T,>(r: { ok: boolean; value?: T; error?: { message: string } }): T => { if (!r.ok) throw new Error(r.error?.message); return r.value as T; };

describe("DatabaseController", () => {
  it("forPage devuelve null si la página no es una base de datos", async () => {
    const { store, clock } = await setup();
    expect(await DatabaseController.forPage(store, clock, "no-existe")).toBeNull();
  });
  it("carga la base con su vista de tabla activa y sin filas", async () => {
    const { c } = await setup();
    const s = c.getSnapshot();
    expect(s.database?.name).toBe("Gastos");
    expect(s.views.map((v) => v.type)).toEqual(["table"]);
    expect(s.activeViewId).toBe(s.views[0]!.id);
    expect(s.result?.rows).toEqual([]);
  });
  it("añadir filas y propiedades y editar celdas actualiza el resultado y avisa a los suscriptores", async () => {
    const { c } = await setup();
    let calls = 0;
    c.subscribe(() => calls++);
    const prop = must(await c.addProperty({ name: "Monto", type: "number" }));
    must(await c.addRow("Café"));
    const row = c.getSnapshot().result!.rows[0]!;
    expect(row.title).toBe("Café");
    must(await c.setCell(row.pageId, prop.id, "45.5"));
    expect(c.getSnapshot().result!.rows[0]!.values[prop.id]).toBe(45.5);
    expect(calls).toBeGreaterThanOrEqual(3);
  });
  it("una celda inválida devuelve el error y no cambia el valor", async () => {
    const { c } = await setup();
    const prop = must(await c.addProperty({ name: "Monto", type: "number" }));
    must(await c.addRow("x"));
    const row = c.getSnapshot().result!.rows[0]!;
    must(await c.setCell(row.pageId, prop.id, 3));
    const r = await c.setCell(row.pageId, prop.id, "abc");
    expect(r.ok).toBe(false);
    expect(c.getSnapshot().result!.rows[0]!.values[prop.id]).toBe(3);
  });
  it("renombrar el título de una fila", async () => {
    const { c } = await setup();
    must(await c.addRow("viejo"));
    const row = c.getSnapshot().result!.rows[0]!;
    must(await c.setTitle(row.pageId, "nuevo"));
    expect(c.getSnapshot().result!.rows[0]!.title).toBe("nuevo");
  });
  it("renombrar y borrar propiedades", async () => {
    const { c } = await setup();
    const p = must(await c.addProperty({ name: "A", type: "text" }));
    must(await c.renameProperty(p.id, "B"));
    expect(c.getSnapshot().properties.map((x) => x.name)).toEqual(["B"]);
    must(await c.deleteProperty(p.id));
    expect(c.getSnapshot().properties).toEqual([]);
  });
  it("crear vistas, cambiar de vista y actualizar filtro, orden y agrupación de la vista activa", async () => {
    const { c } = await setup();
    const monto = must(await c.addProperty({ name: "Monto", type: "number" }));
    for (const [t, v] of [["a", 5], ["b", 50], ["c", 20]] as const) { must(await c.addRow(t)); const r = c.getSnapshot().result!.rows.at(-1)!; must(await c.setCell(r.pageId, monto.id, v)); }
    const lista = must(await c.createView("list", "Lista"));
    await c.setActiveView(lista.id);
    expect(c.getSnapshot().activeViewId).toBe(lista.id);
    must(await c.updateViewConfig({ sorts: [{ property: monto.id, direction: "desc" }], filter: { type: "condition", property: monto.id, op: "gte", value: 10 } }));
    expect(c.getSnapshot().result!.rows.map((r) => r.title)).toEqual(["b", "c"]);
    must(await c.updateViewConfig({ filter: undefined as never, sorts: [] }));
    expect(c.getSnapshot().result!.rows).toHaveLength(3);
  });
  it("borrar una vista pasa a otra; la última no se puede borrar", async () => {
    const { c } = await setup();
    const v = must(await c.createView("list", "Otra"));
    await c.setActiveView(v.id);
    must(await c.deleteView(v.id));
    expect(c.getSnapshot().views).toHaveLength(1);
    expect(c.getSnapshot().activeViewId).toBe(c.getSnapshot().views[0]!.id);
    expect((await c.deleteView(c.getSnapshot().views[0]!.id)).ok).toBe(false);
  });
  it("la lectura consistente: una recarga tardía no pisa un cambio más reciente", async () => {
    const { c } = await setup();
    const p = must(await c.addProperty({ name: "T", type: "text" }));
    must(await c.addRow("x"));
    const row = c.getSnapshot().result!.rows[0]!;
    const slow = c.refresh();
    must(await c.setCell(row.pageId, p.id, "último"));
    await slow;
    expect(c.getSnapshot().result!.rows[0]!.values[p.id]).toBe("último");
  });
});
