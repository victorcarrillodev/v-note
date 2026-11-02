// T-043 (prueba primero): migración 001 crea meta y pages.
import { describe, it, expect } from "vitest";
import { createNodeSqliteStore } from "../../tests/support/nodeSqliteStore";
import { migrate } from "./migrate";
import { migrations } from "./migrations";

describe("migración 001", () => {
  it("crea las tablas meta y pages con las columnas del plan", async () => {
    const db = await createNodeSqliteStore(":memory:");
    expect((await migrate(db, migrations)).ok).toBe(true);
    const cols = async (t: string) => (await db.query<{ name: string }>(`PRAGMA table_info(${t})`)).map((c) => c.name);
    expect(await cols("meta")).toEqual(["key", "value"]);
    expect(await cols("pages")).toEqual([
      "id", "parent_id", "position", "title", "icon", "cover", "kind", "favorite", "created_at", "updated_at", "deleted_at", "deleted_root_id",
    ]);
  });
  it("rechaza tipos de página desconocidos y padres inexistentes", async () => {
    const db = await createNodeSqliteStore(":memory:");
    await migrate(db, migrations);
    await expect(db.exec("INSERT INTO pages(id, position, kind, created_at, updated_at) VALUES ('a','a0','raro',0,0)")).rejects.toThrow();
    await expect(db.exec("INSERT INTO pages(id, parent_id, position, created_at, updated_at) VALUES ('a','zzz','a0',0,0)")).rejects.toThrow();
  });
});
