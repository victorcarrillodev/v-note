// T-244…T-248 (prueba primero): relaciones bidireccionales entre bases y rollups sobre las filas relacionadas.
import { describe, it, expect, beforeEach } from "vitest";
import { createNodeSqliteStore } from "../../tests/support/nodeSqliteStore";
import { FakeClock } from "../clock";
import { migrate } from "../db/migrate";
import { migrations } from "../db/migrations";
import { PagesRepo } from "../pages/pagesRepo";
import type { SqlStore } from "../ports/sqlStore";
import { DatabaseService } from "./databaseService";

let db: SqlStore, svc: DatabaseService, repo: PagesRepo;
let proyectos: string, tareas: string;
const must = <T,>(r: { ok: boolean; value?: T; error?: { message: string } }): T => { if (!r.ok) throw new Error(r.error?.message); return r.value as T; };
beforeEach(async () => {
  db = await createNodeSqliteStore(":memory:");
  await migrate(db, migrations);
  const clock = new FakeClock(1_000);
  svc = new DatabaseService(db, clock);
  repo = new PagesRepo(db, clock);
  proyectos = must(await svc.createDatabase({ name: "Proyectos" })).id;
  tareas = must(await svc.createDatabase({ name: "Tareas" })).id;
});
const rowsOf = async (dbId: string) => svc.getRows(dbId);

describe("relación bidireccional (T-244)", () => {
  it("crea dos propiedades emparejadas, una en cada base", async () => {
    const rel = must(await svc.addRelation(proyectos, { name: "Tareas", targetDatabaseId: tareas, pairedName: "Proyecto" }));
    expect(rel.property.type).toBe("relation");
    expect(rel.paired.databaseId).toBe(tareas);
    expect(rel.paired.name).toBe("Proyecto");
    expect(rel.property.config).toMatchObject({ targetDatabaseId: tareas, pairedPropertyId: rel.paired.id });
    expect(rel.paired.config).toMatchObject({ targetDatabaseId: proyectos, pairedPropertyId: rel.property.id });
  });
  it("vincular una fila se ve desde ambos lados", async () => {
    const rel = must(await svc.addRelation(proyectos, { name: "Tareas", targetDatabaseId: tareas, pairedName: "Proyecto" }));
    const p = must(await svc.addRow(proyectos, { title: "P1" })), t1 = must(await svc.addRow(tareas, { title: "T1" })), t2 = must(await svc.addRow(tareas, { title: "T2" }));
    must(await svc.linkRows(rel.property.id, p.pageId, t1.pageId)); must(await svc.linkRows(rel.property.id, p.pageId, t2.pageId));
    expect((await rowsOf(proyectos))[0]!.values[rel.property.id]).toEqual([t1.pageId, t2.pageId]);
    const back = await rowsOf(tareas);
    expect(back.find((r) => r.pageId === t1.pageId)!.values[rel.paired.id]).toEqual([p.pageId]);
    expect(back.find((r) => r.pageId === t2.pageId)!.values[rel.paired.id]).toEqual([p.pageId]);
  });
  it("también se puede vincular desde el lado emparejado", async () => {
    const rel = must(await svc.addRelation(proyectos, { name: "Tareas", targetDatabaseId: tareas, pairedName: "Proyecto" }));
    const p = must(await svc.addRow(proyectos, { title: "P1" })), t = must(await svc.addRow(tareas, { title: "T1" }));
    must(await svc.linkRows(rel.paired.id, t.pageId, p.pageId));
    expect((await rowsOf(proyectos))[0]!.values[rel.property.id]).toEqual([t.pageId]);
  });
  it("vincular dos veces lo mismo no duplica; desvincular lo quita en ambos lados", async () => {
    const rel = must(await svc.addRelation(proyectos, { name: "Tareas", targetDatabaseId: tareas, pairedName: "Proyecto" }));
    const p = must(await svc.addRow(proyectos, { title: "P1" })), t = must(await svc.addRow(tareas, { title: "T1" }));
    must(await svc.linkRows(rel.property.id, p.pageId, t.pageId)); must(await svc.linkRows(rel.property.id, p.pageId, t.pageId));
    expect((await db.query("SELECT * FROM relation_links")).length).toBe(2); // uno por lado
    must(await svc.unlinkRows(rel.property.id, p.pageId, t.pageId));
    expect((await rowsOf(proyectos))[0]!.values[rel.property.id] ?? []).toEqual([]);
    expect((await rowsOf(tareas))[0]!.values[rel.paired.id] ?? []).toEqual([]);
  });
  it("solo se pueden vincular filas de la base correcta", async () => {
    const rel = must(await svc.addRelation(proyectos, { name: "Tareas", targetDatabaseId: tareas, pairedName: "Proyecto" }));
    const p = must(await svc.addRow(proyectos, { title: "P1" })), p2 = must(await svc.addRow(proyectos, { title: "P2" }));
    expect((await svc.linkRows(rel.property.id, p.pageId, p2.pageId)).ok).toBe(false); // destino en la base equivocada
    expect((await svc.linkRows(rel.property.id, "no-existe", p2.pageId)).ok).toBe(false);
  });
  it("una relación puede ser de una base consigo misma (subtareas)", async () => {
    const rel = must(await svc.addRelation(tareas, { name: "Subtareas", targetDatabaseId: tareas, pairedName: "Tarea madre" }));
    const a = must(await svc.addRow(tareas, { title: "A" })), b = must(await svc.addRow(tareas, { title: "B" }));
    must(await svc.linkRows(rel.property.id, a.pageId, b.pageId));
    const rows = await rowsOf(tareas);
    expect(rows.find((r) => r.pageId === a.pageId)!.values[rel.property.id]).toEqual([b.pageId]);
    expect(rows.find((r) => r.pageId === b.pageId)!.values[rel.paired.id]).toEqual([a.pageId]);
  });
  it("las celdas de relación no se escriben con setCell", async () => {
    const rel = must(await svc.addRelation(proyectos, { name: "Tareas", targetDatabaseId: tareas, pairedName: "Proyecto" }));
    const p = must(await svc.addRow(proyectos, { title: "P1" }));
    expect((await svc.setCell(proyectos, p.pageId, rel.property.id, ["x"])).ok).toBe(false);
  });
  it("borrar una propiedad de relación borra también la pareja y los vínculos", async () => {
    const rel = must(await svc.addRelation(proyectos, { name: "Tareas", targetDatabaseId: tareas, pairedName: "Proyecto" }));
    const p = must(await svc.addRow(proyectos, { title: "P1" })), t = must(await svc.addRow(tareas, { title: "T1" }));
    must(await svc.linkRows(rel.property.id, p.pageId, t.pageId));
    must(await svc.deleteProperty(rel.property.id));
    expect((await svc.listProperties(tareas)).some((x) => x.id === rel.paired.id)).toBe(false);
    expect((await db.query("SELECT * FROM relation_links")).length).toBe(0);
  });
  it("una base destino inexistente se rechaza", async () => {
    expect((await svc.addRelation(proyectos, { name: "X", targetDatabaseId: "no-existe", pairedName: "Y" })).ok).toBe(false);
  });
});

describe("quitar el vínculo al eliminar la fila relacionada (T-245)", () => {
  it("quitar la fila de su base elimina el vínculo en el otro lado", async () => {
    const rel = must(await svc.addRelation(proyectos, { name: "Tareas", targetDatabaseId: tareas, pairedName: "Proyecto" }));
    const p = must(await svc.addRow(proyectos, { title: "P1" })), t = must(await svc.addRow(tareas, { title: "T1" }));
    must(await svc.linkRows(rel.property.id, p.pageId, t.pageId));
    must(await svc.removeFromDatabase(tareas, t.pageId));
    expect((await rowsOf(proyectos))[0]!.values[rel.property.id] ?? []).toEqual([]);
  });
  it("la página en la papelera desaparece del vínculo, y vuelve al restaurarla", async () => {
    const rel = must(await svc.addRelation(proyectos, { name: "Tareas", targetDatabaseId: tareas, pairedName: "Proyecto" }));
    const p = must(await svc.addRow(proyectos, { title: "P1" })), t = must(await svc.addRow(tareas, { title: "T1" }));
    must(await svc.linkRows(rel.property.id, p.pageId, t.pageId));
    must(await repo.trash(t.pageId));
    expect((await rowsOf(proyectos))[0]!.values[rel.property.id] ?? []).toEqual([]);
    must(await repo.restore(t.pageId));
    expect((await rowsOf(proyectos))[0]!.values[rel.property.id]).toEqual([t.pageId]);
  });
  it("el borrado definitivo limpia el vínculo", async () => {
    const rel = must(await svc.addRelation(proyectos, { name: "Tareas", targetDatabaseId: tareas, pairedName: "Proyecto" }));
    const p = must(await svc.addRow(proyectos, { title: "P1" })), t = must(await svc.addRow(tareas, { title: "T1" }));
    must(await svc.linkRows(rel.property.id, p.pageId, t.pageId));
    must(await repo.trash(t.pageId));
    must(await repo.deletePermanently(t.pageId, { confirm: true }));
    expect((await db.query("SELECT * FROM relation_links")).length).toBe(0);
  });
});

describe("rollup (T-246, T-247, T-248)", () => {
  let rel: Awaited<ReturnType<typeof setup>>;
  async function setup() {
    const r = must(await svc.addRelation(proyectos, { name: "Tareas", targetDatabaseId: tareas, pairedName: "Proyecto" }));
    const horas = must(await svc.addProperty(tareas, { name: "Horas", type: "number" }));
    const p = must(await svc.addRow(proyectos, { title: "P1" }));
    const ts = [] as { pageId: string }[];
    for (const [title, h] of [["T1", 2], ["T2", 4], ["T3", 9]] as const) {
      const t = must(await svc.addRow(tareas, { title, values: { [horas.id]: h } }));
      must(await svc.linkRows(r.property.id, p.pageId, t.pageId));
      ts.push(t);
    }
    return { rel: r, horas, p, ts };
  }
  const roll = async (fn: string, target?: string) => {
    const r = await setup();
    const rp = must(await svc.addRollup(proyectos, { name: "R", relationPropertyId: r.rel.property.id, ...(fn === "count" ? {} : { targetPropertyId: target ?? r.horas.id }), fn: fn as never }));
    return { ...r, rp, value: async () => (await rowsOf(proyectos))[0]!.values[rp.id] };
  };

  it("contar las filas relacionadas (T-246)", async () => expect(await (await roll("count")).value()).toBe(3));
  it("sumar (T-246)", async () => expect(await (await roll("sum")).value()).toBe(15));
  it("promedio, mínimo y máximo (T-247)", async () => {
    const r = await setup();
    const mk = async (fn: "avg" | "min" | "max") => must(await svc.addRollup(proyectos, { name: fn, relationPropertyId: r.rel.property.id, targetPropertyId: r.horas.id, fn }));
    const [a, mi, ma] = [await mk("avg"), await mk("min"), await mk("max")];
    const row = (await rowsOf(proyectos))[0]!;
    expect([row.values[a.id], row.values[mi.id], row.values[ma.id]]).toEqual([5, 2, 9]);
  });
  it("sin filas relacionadas: contar y sumar dan 0; promedio, mínimo y máximo quedan vacíos", async () => {
    const r = must(await svc.addRelation(proyectos, { name: "Tareas", targetDatabaseId: tareas, pairedName: "Proyecto" }));
    const horas = must(await svc.addProperty(tareas, { name: "Horas", type: "number" }));
    const p = must(await svc.addRow(proyectos, { title: "Vacío" }));
    const mk = async (fn: string, withTarget: boolean) => must(await svc.addRollup(proyectos, { name: fn, relationPropertyId: r.property.id, ...(withTarget ? { targetPropertyId: horas.id } : {}), fn: fn as never }));
    const [c, s, a, mi, ma] = [await mk("count", false), await mk("sum", true), await mk("avg", true), await mk("min", true), await mk("max", true)];
    const row = (await rowsOf(proyectos)).find((x) => x.pageId === p.pageId)!;
    expect([row.values[c.id], row.values[s.id], row.values[a.id] ?? null, row.values[mi.id] ?? null, row.values[ma.id] ?? null]).toEqual([0, 0, null, null, null]);
  });
  it("las celdas vacías del origen no cuentan en promedio, mínimo ni máximo", async () => {
    const r = await roll("avg");
    must(await svc.setCell(tareas, r.ts[2]!.pageId, r.horas.id, "")); // T3 queda vacía
    expect(await r.value()).toBe(3);
  });
  it("se recalcula al cambiar un valor relacionado (T-248)", async () => {
    const r = await roll("sum");
    expect(await r.value()).toBe(15);
    must(await svc.setCell(tareas, r.ts[0]!.pageId, r.horas.id, 100));
    expect(await r.value()).toBe(113);
  });
  it("se recalcula al añadir, quitar o enviar a la papelera filas relacionadas (T-248)", async () => {
    const r = await roll("count");
    const t4 = must(await svc.addRow(tareas, { title: "T4" }));
    must(await svc.linkRows(r.rel.property.id, r.p.pageId, t4.pageId));
    expect(await r.value()).toBe(4);
    must(await svc.unlinkRows(r.rel.property.id, r.p.pageId, r.ts[0]!.pageId));
    expect(await r.value()).toBe(3);
    must(await repo.trash(r.ts[1]!.pageId));
    expect(await r.value()).toBe(2);
  });
  it("valida la definición: la relación debe ser de esta base, el destino numérico y la función conocida", async () => {
    const r = must(await svc.addRelation(proyectos, { name: "Tareas", targetDatabaseId: tareas, pairedName: "Proyecto" }));
    const texto = must(await svc.addProperty(tareas, { name: "Nota", type: "text" }));
    const horas = must(await svc.addProperty(tareas, { name: "Horas", type: "number" }));
    expect((await svc.addRollup(proyectos, { name: "a", relationPropertyId: r.paired.id, targetPropertyId: horas.id, fn: "sum" })).ok).toBe(false); // relación de la otra base
    expect((await svc.addRollup(proyectos, { name: "b", relationPropertyId: r.property.id, targetPropertyId: texto.id, fn: "sum" })).ok).toBe(false); // no numérico
    expect((await svc.addRollup(proyectos, { name: "c", relationPropertyId: r.property.id, targetPropertyId: horas.id, fn: "mediana" as never })).ok).toBe(false);
    expect((await svc.addRollup(proyectos, { name: "d", relationPropertyId: r.property.id, fn: "sum" })).ok).toBe(false); // falta la propiedad destino
    expect((await svc.addRollup(proyectos, { name: "e", relationPropertyId: "no-existe", fn: "count" })).ok).toBe(false);
  });
  it("el rollup no se escribe con setCell", async () => {
    const r = await roll("count");
    expect((await svc.setCell(proyectos, r.p.pageId, r.rp.id, 3)).ok).toBe(false);
  });
});
