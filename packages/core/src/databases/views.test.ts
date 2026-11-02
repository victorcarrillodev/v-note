// T-241, T-242 (prueba primero): vistas guardadas por base (CRUD) y vistas enlazadas que muestran los mismos datos en otra página.
import { describe, it, expect, beforeEach } from "vitest";
import { createNodeSqliteStore } from "../../tests/support/nodeSqliteStore";
import { FakeClock } from "../clock";
import { migrate } from "../db/migrate";
import { migrations } from "../db/migrations";
import { PageService } from "../pages/pageService";
import type { SqlStore } from "../ports/sqlStore";
import { DatabaseService } from "./databaseService";
import { ViewService } from "./viewService";

let db: SqlStore, svc: DatabaseService, views: ViewService, dbId: string, costo: string, estado: string;
const must = <T,>(r: { ok: boolean; value?: T; error?: { message: string } }): T => { if (!r.ok) throw new Error(r.error?.message); return r.value as T; };
beforeEach(async () => {
  db = await createNodeSqliteStore(":memory:");
  await migrate(db, migrations);
  const clock = new FakeClock(1_000);
  svc = new DatabaseService(db, clock);
  views = new ViewService(db);
  dbId = must(await svc.createDatabase({ name: "Base" })).id;
  costo = must(await svc.addProperty(dbId, { name: "Costo", type: "number" })).id;
  estado = must(await svc.addProperty(dbId, { name: "Estado", type: "status" })).id;
});

describe("vistas guardadas (T-241)", () => {
  it("la base nace con una vista de tabla; se pueden crear vistas de los seis tipos", async () => {
    expect((await views.list(dbId)).map((v) => v.type)).toEqual(["table"]);
    for (const type of ["list", "board", "gallery", "calendar", "timeline"] as const) must(await views.create(dbId, { name: type, type }));
    expect((await views.list(dbId)).map((v) => v.type)).toEqual(["table", "list", "board", "gallery", "calendar", "timeline"]);
  });
  it("rechaza tipos desconocidos y bases inexistentes", async () => {
    expect((await views.create(dbId, { name: "x", type: "mapa" as never })).ok).toBe(false);
    expect((await views.create("no-existe", { name: "x", type: "table" })).ok).toBe(false);
  });
  it("editar: cambia nombre y configuración (filtro, orden, agrupación, columnas visibles)", async () => {
    const v = must(await views.create(dbId, { name: "Caras", type: "table" }));
    const cfg = {
      filter: { type: "condition" as const, property: costo, op: "gt", value: 100 },
      sorts: [{ property: costo, direction: "desc" as const }],
      groupBy: estado,
      visibleProperties: [costo, estado],
    };
    const u = must(await views.update(v.id, { name: "Más caras", config: cfg }));
    expect(u.name).toBe("Más caras");
    expect(u.config).toEqual(cfg);
    expect(must(await views.get(v.id)).config).toEqual(cfg); // persiste
  });
  it("la configuración no puede referirse a propiedades que no existen", async () => {
    const v = must(await views.create(dbId, { name: "X", type: "table" }));
    expect((await views.update(v.id, { config: { sorts: [{ property: "zzz", direction: "asc" }] } })).ok).toBe(false);
    expect((await views.update(v.id, { config: { groupBy: "zzz" } })).ok).toBe(false);
    expect((await views.update(v.id, { config: { filter: { type: "condition", property: "zzz", op: "is", value: 1 } } })).ok).toBe(false);
    expect((await views.update(v.id, { config: { visibleProperties: ["zzz"] } })).ok).toBe(false);
  });
  it("«title» es una propiedad válida para filtrar, ordenar y mostrar", async () => {
    const v = must(await views.create(dbId, { name: "T", type: "table" }));
    must(await views.update(v.id, { config: { sorts: [{ property: "title", direction: "asc" }], filter: { type: "condition", property: "title", op: "contains", value: "a" } } }));
  });
  it("borrar: quita la vista, pero la última de la base no se puede borrar", async () => {
    const first = (await views.list(dbId))[0]!;
    const extra = must(await views.create(dbId, { name: "Otra", type: "list" }));
    must(await views.delete(extra.id));
    expect((await views.list(dbId)).map((v) => v.id)).toEqual([first.id]);
    expect((await views.delete(first.id)).ok).toBe(false);
  });
  it("reordenar vistas", async () => {
    const a = (await views.list(dbId))[0]!;
    const b = must(await views.create(dbId, { name: "B", type: "list" }));
    must(await views.move(b.id, null));
    expect((await views.list(dbId)).map((v) => v.id)).toEqual([b.id, a.id]);
  });
  it("las vistas borradas con la base desaparecen", async () => {
    await db.exec("DELETE FROM databases WHERE id = ?", [dbId]);
    expect((await db.query("SELECT * FROM views")).length).toBe(0);
  });
});

describe("ejecutar una vista (T-241/T-242)", () => {
  it("aplica filtro, orden y agrupación de la vista a las filas de la base", async () => {
    for (const [t, c] of [["barata", 10], ["media", 100], ["cara", 500], ["muy cara", 900]] as const) must(await svc.addRow(dbId, { title: t, values: { [costo]: c } }));
    const v = must(await views.create(dbId, { name: "Caras", type: "table" }));
    must(await views.update(v.id, { config: { filter: { type: "condition", property: costo, op: "gte", value: 100 }, sorts: [{ property: costo, direction: "desc" }] } }));
    const result = must(await views.run(svc, v.id));
    expect(result.rows.map((r) => r.title)).toEqual(["muy cara", "cara", "media"]);
    expect(result.groups).toBeNull();
    must(await views.update(v.id, { config: { groupBy: estado } }));
    const grouped = must(await views.run(svc, v.id));
    expect(grouped.groups!.map((g) => g.key)).toEqual(["todo", "in_progress", "done"]);
    expect(grouped.groups![0]!.rows).toHaveLength(4);
  });
  it("vistas enlazadas: dos vistas de la misma base en distintas páginas ven el mismo cambio (T-242)", async () => {
    const row = must(await svc.addRow(dbId, { title: "Fila", values: { [costo]: 10 } }));
    const original = (await views.list(dbId))[0]!;
    const enlazada = must(await views.create(dbId, { name: "Enlazada en otra página", type: "list" }));
    must(await svc.setCell(dbId, row.pageId, costo, 99));
    const a = must(await views.run(svc, original.id)), b = must(await views.run(svc, enlazada.id));
    expect(a.rows[0]!.values[costo]).toBe(99);
    expect(b.rows[0]!.values[costo]).toBe(99);
    must(await svc.addRow(dbId, { title: "Nueva" }));
    expect(must(await views.run(svc, original.id)).rows).toHaveLength(2);
    expect(must(await views.run(svc, enlazada.id)).rows).toHaveLength(2);
  });
  it("una vista inexistente devuelve NOT_FOUND", async () => {
    expect((await views.run(svc, "no-existe")).ok).toBe(false);
  });
  it("una vista cuya propiedad se borró sigue funcionando (se ignora lo que ya no existe)", async () => {
    const v = must(await views.create(dbId, { name: "X", type: "table" }));
    must(await views.update(v.id, { config: { sorts: [{ property: costo, direction: "asc" }], visibleProperties: [costo, estado] } }));
    must(await svc.deleteProperty(costo));
    const r = must(await views.run(svc, v.id));
    expect(r.visibleProperties).toEqual([estado]);
  });
});
