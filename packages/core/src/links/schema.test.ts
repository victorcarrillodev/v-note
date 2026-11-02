// T-357 (prueba primero): esquema de la tabla derivada `links`.
import { describe, it, expect, beforeEach } from "vitest";
import { createNodeSqliteStore } from "../../tests/support/nodeSqliteStore";
import { migrate } from "../db/migrate";
import { migrations } from "../db/migrations";
import type { SqlStore } from "../ports/sqlStore";

let db: SqlStore;
beforeEach(async () => {
  db = await createNodeSqliteStore(":memory:");
  expect((await migrate(db, migrations)).ok).toBe(true);
  await db.exec("INSERT INTO pages(id, position, created_at, updated_at) VALUES ('a','a0',0,0),('b','a1',0,0)");
});

describe("migración de enlaces (T-357)", () => {
  it("crea la tabla con las columnas del plan", async () => {
    expect((await db.query<{ name: string }>("PRAGMA table_info(links)")).map((c) => c.name)).toEqual(["from_page_id", "to_page_id"]);
  });
  it("un par origen-destino no se repite, y el origen debe existir", async () => {
    await db.exec("INSERT INTO links(from_page_id, to_page_id) VALUES ('a','b')");
    await expect(db.exec("INSERT INTO links(from_page_id, to_page_id) VALUES ('a','b')")).rejects.toThrow();
    await expect(db.exec("INSERT INTO links(from_page_id, to_page_id) VALUES ('zzz','b')")).rejects.toThrow();
  });
  it("el destino puede no existir (enlace roto tras borrar para siempre); borrar el origen borra sus filas", async () => {
    await db.exec("INSERT INTO links(from_page_id, to_page_id) VALUES ('a','ya-no-existe')");
    await db.exec("DELETE FROM pages WHERE id = 'a'");
    expect(await db.query("SELECT * FROM links")).toEqual([]);
  });
});
