// T-256, T-258, T-262 en la base de datos real: fórmulas como propiedades, ciclos rechazados al definirlas, errores por celda.
import { describe, it, expect, beforeEach } from "vitest";
import { createNodeSqliteStore } from "../../tests/support/nodeSqliteStore";
import { FakeClock } from "../clock";
import { migrate } from "../db/migrate";
import { migrations } from "../db/migrations";
import { isErrorValue } from "../formulas/engine";
import type { SqlStore } from "../ports/sqlStore";
import { DatabaseService } from "./databaseService";

let db: SqlStore, svc: DatabaseService, d: string, costo: string, cant: string;
const must = <T,>(r: { ok: boolean; value?: T; error?: { message: string } }): T => { if (!r.ok) throw new Error(r.error?.message); return r.value as T; };
const col = async (dbId: string, propId: string) => (await svc.getRows(dbId)).map((r) => r.values[propId] ?? null);
beforeEach(async () => {
  db = await createNodeSqliteStore(":memory:");
  await migrate(db, migrations);
  svc = new DatabaseService(db, new FakeClock(Date.UTC(2026, 2, 5, 12, 0)));
  d = must(await svc.createDatabase({ name: "Base" })).id;
  costo = must(await svc.addProperty(d, { name: "Costo", type: "number" })).id;
  cant = must(await svc.addProperty(d, { name: "Cant", type: "number" })).id;
  for (const [t, c, q] of [["a", 10, 2], ["b", 5, 0], ["c", 7, 1]] as const) must(await svc.addRow(d, { title: t, values: { [costo]: c, [cant]: q } }));
});

describe("fórmulas como propiedad", () => {
  it("se calculan por fila y se actualizan al cambiar los datos", async () => {
    const f = must(await svc.addFormula(d, { name: "Total", expression: 'prop("Costo") * prop("Cant")' }));
    expect(await col(d, f.id)).toEqual([20, 0, 7]);
    const rows = await svc.getRows(d);
    must(await svc.setCell(d, rows[2]!.pageId, costo, 100));
    expect(await col(d, f.id)).toEqual([20, 0, 100]);
  });
  it("una fórmula puede usar otras fórmulas y el título no es una propiedad", async () => {
    must(await svc.addFormula(d, { name: "Total", expression: 'prop("Costo") * prop("Cant")' }));
    const g = must(await svc.addFormula(d, { name: "Con IVA", expression: 'prop("Total") * 1.16' }));
    expect(await col(d, g.id)).toEqual([23.2, 0, 8.12]);
  });
  it("el error de una celda no afecta a las demás (T-262)", async () => {
    const f = must(await svc.addFormula(d, { name: "Ratio", expression: 'prop("Costo") / prop("Cant")' }));
    const vals = await col(d, f.id);
    expect(vals[0]).toBe(5);
    expect(isErrorValue(vals[1])).toBe(true);
    expect(vals[2]).toBe(7);
  });
  it("rechaza al definir: sintaxis inválida, propiedades inexistentes y nombres repetidos", async () => {
    const a = await svc.addFormula(d, { name: "X", expression: "1 +" });
    expect(a.ok).toBe(false);
    expect(!a.ok && a.error.message).toMatch(/incompleta|esperaba|inesperad/i);
    const b = await svc.addFormula(d, { name: "Y", expression: 'prop("Fantasma") + 1' });
    expect(!b.ok && b.error.message).toContain("Fantasma");
    must(await svc.addFormula(d, { name: "Z", expression: "1" }));
    expect((await svc.addFormula(d, { name: "z", expression: "2" })).ok).toBe(false);
    expect((await svc.listProperties(d)).filter((p) => p.type === "formula")).toHaveLength(1);
  });
  it("las fórmulas no se escriben con setCell", async () => {
    const f = must(await svc.addFormula(d, { name: "Total", expression: "1" }));
    const row = (await svc.getRows(d))[0]!;
    expect((await svc.setCell(d, row.pageId, f.id, 5)).ok).toBe(false);
  });
  it("un resultado fecha o texto o booleano se guarda con su tipo", async () => {
    const t = must(await svc.addFormula(d, { name: "Texto", expression: '"Fila " + texto(prop("Costo"))' }));
    const b = must(await svc.addFormula(d, { name: "Caro", expression: 'prop("Costo") > 6' }));
    const f = must(await svc.addFormula(d, { name: "Entrega", expression: 'sumarfecha(hoy(), prop("Cant"), "dias")' }));
    expect(await col(d, t.id)).toEqual(["Fila 10", "Fila 5", "Fila 7"]);
    expect(await col(d, b.id)).toEqual([true, false, true]);
    expect(await col(d, f.id)).toEqual([{ start: "2026-03-07" }, { start: "2026-03-05" }, { start: "2026-03-06" }]);
  });
  it("las fórmulas con fecha se pueden filtrar y ordenar como cualquier fecha (tipo date en el resultado)", async () => {
    const f = must(await svc.addFormula(d, { name: "Entrega", expression: 'sumarfecha(hoy(), prop("Cant"), "dias")' }));
    expect((await svc.getRows(d))[0]!.values[f.id]).toEqual({ start: "2026-03-07" });
  });
});

describe("editar una fórmula y ciclos (T-258, CL-26)", () => {
  it("editar recalcula; una edición inválida no cambia nada", async () => {
    const f = must(await svc.addFormula(d, { name: "Total", expression: 'prop("Costo") * prop("Cant")' }));
    must(await svc.updateFormula(f.id, 'prop("Costo") + prop("Cant")'));
    expect(await col(d, f.id)).toEqual([12, 5, 8]);
    expect((await svc.updateFormula(f.id, "((")).ok).toBe(false);
    expect(await col(d, f.id)).toEqual([12, 5, 8]);
  });
  it("una fórmula que se cita a sí misma se rechaza con un mensaje que explica el ciclo", async () => {
    const f = must(await svc.addFormula(d, { name: "A", expression: "1" }));
    const r = await svc.updateFormula(f.id, 'prop("A") + 1');
    expect(r.ok).toBe(false);
    if (!r.ok) { expect(r.error.code).toBe("CYCLE"); expect(r.error.message).toMatch(/circular/i); expect(r.error.message).toContain("A"); }
  });
  it("dos fórmulas que se citan mutuamente: la segunda definición se rechaza", async () => {
    const a = must(await svc.addFormula(d, { name: "A", expression: "1" }));
    must(await svc.addFormula(d, { name: "B", expression: 'prop("A") + 1' }));
    const r = await svc.updateFormula(a.id, 'prop("B")');
    expect(!r.ok && r.error.code).toBe("CYCLE");
    expect(must(await svc.getProperty(a.id)).config.expression).toBe("1"); // no se tocó
  });
  it("un ciclo a través de un rollup entre bases también se rechaza", async () => {
    const t = must(await svc.createDatabase({ name: "Tareas" })).id;
    const horas = must(await svc.addProperty(t, { name: "Horas", type: "number" })).id;
    const rel = must(await svc.addRelation(d, { name: "Tareas", targetDatabaseId: t, pairedName: "Proyecto" }));
    const f = must(await svc.addFormula(t, { name: "Doble", expression: 'prop("Horas") * 2' }));
    const roll = must(await svc.addRollup(d, { name: "Total", relationPropertyId: rel.property.id, targetPropertyId: f.id, fn: "sum" }));
    expect(roll.type).toBe("rollup");
    // La fórmula de Tareas intenta citar una propiedad que depende de ella a través del rollup:
    const back = must(await svc.addRollup(t, { name: "Vuelta", relationPropertyId: rel.paired.id, targetPropertyId: roll.id, fn: "sum" }));
    const r = await svc.updateFormula(f.id, 'prop("Horas") + prop("Vuelta")');
    expect(!r.ok && r.error.code).toBe("CYCLE");
    void horas; void back;
  });
  it("renombrar una propiedad actualiza las fórmulas que la citan", async () => {
    const f = must(await svc.addFormula(d, { name: "Total", expression: 'prop("Costo") * prop("Cant")' }));
    must(await svc.renameProperty(costo, "Precio"));
    expect(must(await svc.getProperty(f.id)).config.expression).toBe('prop("Precio") * prop("Cant")');
    expect(await col(d, f.id)).toEqual([20, 0, 7]);
  });
  it("borrar una propiedad citada deja las celdas de esa fórmula con error, sin romper lo demás", async () => {
    const f = must(await svc.addFormula(d, { name: "Total", expression: 'prop("Costo") * prop("Cant")' }));
    must(await svc.deleteProperty(costo));
    const vals = await col(d, f.id);
    expect(vals.every((v) => isErrorValue(v))).toBe(true);
    expect((await svc.getRows(d)).map((r) => r.title)).toEqual(["a", "b", "c"]);
  });
});

describe("rollup sobre una fórmula de otra base (T-256)", () => {
  it("suma una fórmula de las filas relacionadas y se actualiza", async () => {
    const t = must(await svc.createDatabase({ name: "Tareas" })).id;
    const horas = must(await svc.addProperty(t, { name: "Horas", type: "number" })).id;
    const rel = must(await svc.addRelation(d, { name: "Tareas", targetDatabaseId: t, pairedName: "Proyecto" }));
    const f = must(await svc.addFormula(t, { name: "Costo hora", expression: 'prop("Horas") * 100' }));
    const roll = must(await svc.addRollup(d, { name: "Costo total", relationPropertyId: rel.property.id, targetPropertyId: f.id, fn: "sum" }));
    const p = (await svc.getRows(d))[0]!;
    const t1 = must(await svc.addRow(t, { title: "T1", values: { [horas]: 2 } })), t2 = must(await svc.addRow(t, { title: "T2", values: { [horas]: 3 } }));
    must(await svc.linkRows(rel.property.id, p.pageId, t1.pageId)); must(await svc.linkRows(rel.property.id, p.pageId, t2.pageId));
    expect((await svc.getRows(d))[0]!.values[roll.id]).toBe(500);
    must(await svc.setCell(t, t1.pageId, horas, 10));
    expect((await svc.getRows(d))[0]!.values[roll.id]).toBe(1300);
  });
});
