// T-243 (RNF-11): consultas sobre una base de 50 000 filas dentro del presupuesto.
import { describe, it, expect, beforeAll } from "vitest";
import { createNodeSqliteStore } from "../../tests/support/nodeSqliteStore";
import { FakeClock } from "../clock";
import { migrate } from "../db/migrate";
import { migrations } from "../db/migrations";
import type { SqlStore } from "../ports/sqlStore";
import { DatabaseService } from "./databaseService";
import { applyQuery, groupRows, type QueryRow } from "./query";
import type { Property } from "./databaseService";

const N = 50_000;
let db: SqlStore, svc: DatabaseService, dbId: string, props: Property[], rows: QueryRow[];
const time = async <T,>(f: () => Promise<T> | T): Promise<[T, number]> => { const t = performance.now(); const r = await f(); return [r, performance.now() - t]; };
const must = <T,>(r: { ok: boolean; value?: T }): T => { if (!r.ok) throw new Error("x"); return r.value as T; };
let loadMs = 0;

beforeAll(async () => {
  db = await createNodeSqliteStore(":memory:");
  await migrate(db, migrations);
  svc = new DatabaseService(db, new FakeClock(1_000));
  dbId = must(await svc.createDatabase({ name: "Grande" })).id;
  const costo = must(await svc.addProperty(dbId, { name: "Costo", type: "number" })).id;
  const estado = must(await svc.addProperty(dbId, { name: "Estado", type: "status" })).id;
  const prio = must(await svc.addProperty(dbId, { name: "Prioridad", type: "select", config: { options: [{ id: "a", name: "Alta" }, { id: "m", name: "Media" }, { id: "b", name: "Baja" }] } })).id;
  const fecha = must(await svc.addProperty(dbId, { name: "Fecha", type: "date" })).id;
  // Carga masiva directa (la API fila a fila se mide en otras pruebas)
  await db.transaction(async (tx) => {
    for (let i = 0; i < N; i++) {
      const id = `p${i}`;
      await tx.exec("INSERT INTO pages(id, parent_id, position, title, kind, created_at, updated_at) VALUES (?, NULL, ?, ?, 'note', 1, 1)", [id, String(i).padStart(6, "0"), `Fila ${i} ${i % 7 === 0 ? "urgente" : "normal"}`]);
      await tx.exec("INSERT INTO db_rows(database_id, page_id, position, created_at, updated_at) VALUES (?, ?, ?, 1, 1)", [dbId, id, String(i).padStart(6, "0")]);
      await tx.exec("INSERT INTO cell_values(database_id, page_id, property_id, value) VALUES (?, ?, ?, ?), (?, ?, ?, ?), (?, ?, ?, ?), (?, ?, ?, ?)", [
        dbId, id, costo, String((i * 37) % 1000), dbId, id, estado, JSON.stringify(["todo", "in_progress", "done"][i % 3]),
        dbId, id, prio, JSON.stringify(["a", "m", "b"][i % 3]), dbId, id, fecha, JSON.stringify({ start: `2026-0${(i % 9) + 1}-${String((i % 28) + 1).padStart(2, "0")}` }),
      ]);
    }
  });
  props = await svc.listProperties(dbId);
  const [r, ms] = await time(() => svc.getRows(dbId));
  rows = r; loadMs = ms;
}, 600_000);

describe(`consultas con ${N} filas (RNF-11)`, () => {
  it("hay 50 000 filas cargadas", () => expect(rows.length).toBe(N));
  it("cargar todas las filas con sus valores tarda menos de 5 s", () => expect(loadMs).toBeLessThan(5000));
  it("filtrar con un grupo AND/OR tarda menos de 500 ms", async () => {
    const costo = props.find((p) => p.name === "Costo")!.id, estado = props.find((p) => p.name === "Estado")!.id;
    const [out, ms] = await time(() => applyQuery(rows, props, { filter: { type: "group", op: "and", filters: [
      { type: "condition", property: costo, op: "gte", value: 500 },
      { type: "group", op: "or", filters: [{ type: "condition", property: estado, op: "is", value: "done" }, { type: "condition", property: "title", op: "contains", value: "urgente" }] },
    ] } }));
    expect(out.length).toBeGreaterThan(1000);
    expect(ms).toBeLessThan(500);
  });
  it("ordenar por dos propiedades tarda menos de 1 s", async () => {
    const costo = props.find((p) => p.name === "Costo")!.id, prio = props.find((p) => p.name === "Prioridad")!.id;
    const [out, ms] = await time(() => applyQuery(rows, props, { sorts: [{ property: prio, direction: "asc" }, { property: costo, direction: "desc" }] }));
    expect(out).toHaveLength(N);
    expect(ms).toBeLessThan(1000);
  });
  it("agrupar por estado tarda menos de 300 ms", async () => {
    const estado = props.find((p) => p.name === "Estado")!.id;
    const [g, ms] = await time(() => groupRows(rows, props, estado));
    expect(g.map((x) => x.rows.length)).toEqual([16667, 16667, 16666]);
    expect(ms).toBeLessThan(300);
  });
  it("la vista completa (filtro + orden + grupo) tarda menos de 1,5 s", async () => {
    const costo = props.find((p) => p.name === "Costo")!.id, estado = props.find((p) => p.name === "Estado")!.id;
    const [, ms] = await time(() => {
      const filtered = applyQuery(rows, props, { filter: { type: "condition", property: costo, op: "lt", value: 800 }, sorts: [{ property: costo, direction: "desc" }] });
      return groupRows(filtered, props, estado);
    });
    expect(ms).toBeLessThan(1500);
  });
});
