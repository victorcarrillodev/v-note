// T-289 (prueba primero): esquema de tasks y reminder_state.
import { describe, it, expect, beforeEach } from "vitest";
import { createNodeSqliteStore } from "../../tests/support/nodeSqliteStore";
import { migrate } from "../db/migrate";
import { migrations } from "../db/migrations";
import type { SqlStore } from "../ports/sqlStore";

let db: SqlStore;
const cols = async (t: string) => (await db.query<{ name: string }>(`PRAGMA table_info(${t})`)).map((c) => c.name);
beforeEach(async () => {
  db = await createNodeSqliteStore(":memory:");
  expect((await migrate(db, migrations)).ok).toBe(true);
  await db.exec("INSERT INTO pages(id, position, created_at, updated_at) VALUES ('p1','a0',0,0)");
});

describe("migración de tareas y recordatorios (T-289)", () => {
  it("crea las tablas con las columnas del plan", async () => {
    expect(await cols("tasks")).toEqual(["id", "source", "page_id", "block_id", "database_id", "title", "due", "remind_at", "recurrence", "done", "updated_at", "start_time", "duration_min"]);
    expect(await cols("reminder_state")).toEqual(["task_id", "occurrence", "state", "snoozed_until", "updated_at"]);
  });
  it("la fuente solo puede ser casilla, tarjeta o fila, y la tarea necesita una página existente", async () => {
    const ins = (id: string, source: string, page = "p1") => db.exec("INSERT INTO tasks(id, source, page_id, title, done, updated_at) VALUES (?, ?, ?, 't', 0, 0)", [id, source, page]);
    await ins("a", "checkbox"); await ins("b", "card"); await ins("c", "row");
    await expect(ins("d", "otra")).rejects.toThrow();
    await expect(ins("e", "row", "no-existe")).rejects.toThrow();
  });
  it("borrar la página borra sus tareas; el estado de recordatorio no depende de la tabla derivada", async () => {
    await db.exec("INSERT INTO tasks(id, source, page_id, title, done, updated_at) VALUES ('t1','checkbox','p1','x',0,0)");
    await db.exec("INSERT INTO reminder_state(task_id, occurrence, state, updated_at) VALUES ('t1','2026-03-05T09:00','fired',0)");
    await db.exec("DELETE FROM pages WHERE id = 'p1'");
    expect((await db.query("SELECT * FROM tasks")).length).toBe(0);
    expect((await db.query("SELECT * FROM reminder_state")).length).toBe(1); // se limpia al reindexar; la tabla derivada se puede reconstruir sin perderlo
  });
  it("el estado solo puede ser disparado, pospuesto o descartado, uno por tarea", async () => {
    const st = (s: string) => db.exec("INSERT OR REPLACE INTO reminder_state(task_id, occurrence, state, updated_at) VALUES ('t1','2026-03-05T09:00',?,0)", [s]);
    await st("fired"); await st("snoozed"); await st("dismissed");
    await expect(st("raro")).rejects.toThrow();
    expect((await db.query("SELECT * FROM reminder_state")).length).toBe(1);
  });
});
