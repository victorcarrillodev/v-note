// T-385 (prueba primero): esquema de import_reports.
import { describe, it, expect, beforeEach } from "vitest";
import { createNodeSqliteStore } from "../../tests/support/nodeSqliteStore";
import { migrate } from "../db/migrate";
import { migrations } from "../db/migrations";
import type { SqlStore } from "../ports/sqlStore";

let db: SqlStore;
beforeEach(async () => {
  db = await createNodeSqliteStore(":memory:");
  expect((await migrate(db, migrations)).ok).toBe(true);
  await db.exec("INSERT INTO pages(id, position, created_at, updated_at) VALUES ('p','a0',0,0)");
});
describe("tabla del informe de importación (T-385)", () => {
  it("tiene las columnas del plan, un informe por contenedor y se borra con la página", async () => {
    expect((await db.query<{ name: string }>("PRAGMA table_info(import_reports)")).map((c) => c.name)).toEqual(["id", "container_page_id", "source", "created_at", "imported", "approximated", "omitted", "broken_links", "details"]);
    await db.exec("INSERT INTO import_reports VALUES ('r1','p','notion',0,1,2,3,4,'{}')");
    await expect(db.exec("INSERT INTO import_reports VALUES ('r2','p','notion',0,1,2,3,4,'{}')")).rejects.toThrow();
    await expect(db.exec("INSERT INTO import_reports VALUES ('r3','p','otro',0,1,2,3,4,'{}')")).rejects.toThrow();
    await db.exec("DELETE FROM pages WHERE id = 'p'");
    expect(await db.query("SELECT * FROM import_reports")).toEqual([]);
  });
});
