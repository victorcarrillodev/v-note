// T-226 (prueba primero): la migración de bases de datos crea el esquema del plan con sus restricciones.
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
  await db.exec("INSERT INTO pages(id, position, created_at, updated_at) VALUES ('p1','a0',0,0), ('p2','a1',0,0)");
});

describe("migración de bases de datos (T-226)", () => {
  it("crea las tablas con las columnas del plan", async () => {
    expect(await cols("databases")).toEqual(["id", "name", "page_id", "host_page_id", "created_at", "updated_at"]);
    expect(await cols("properties")).toEqual(["id", "database_id", "name", "type", "position", "config"]);
    expect(await cols("db_rows")).toEqual(["database_id", "page_id", "position", "created_at", "updated_at"]);
    expect(await cols("cell_values")).toEqual(["database_id", "page_id", "property_id", "value"]);
    expect(await cols("relation_links")).toEqual(["property_id", "from_page_id", "to_page_id"]);
    expect(await cols("views")).toEqual(["id", "database_id", "name", "type", "position", "config"]);
  });
  it("una base solo puede tener propiedades de tipos conocidos y vistas de los seis tipos", async () => {
    await db.exec("INSERT INTO databases(id, name, created_at, updated_at) VALUES ('d1','Base',0,0)");
    await expect(db.exec("INSERT INTO properties(id, database_id, name, type, position, config) VALUES ('x','d1','a','raro','a0','{}')")).rejects.toThrow();
    for (const [i, t] of ["table", "list", "board", "gallery", "calendar", "timeline"].entries()) {
      await db.exec("INSERT INTO views(id, database_id, name, type, position, config) VALUES (?, 'd1', 'v', ?, ?, '{}')", [`v${i}`, t, `a${i}`]);
    }
    await expect(db.exec("INSERT INTO views(id, database_id, name, type, position, config) VALUES ('vx','d1','v','mapa','z','{}')")).rejects.toThrow();
  });
  it("los nombres de propiedad son únicos dentro de una base, pero se pueden repetir entre bases", async () => {
    await db.exec("INSERT INTO databases(id, name, created_at, updated_at) VALUES ('d1','A',0,0), ('d2','B',0,0)");
    await db.exec("INSERT INTO properties(id, database_id, name, type, position, config) VALUES ('a','d1','Nombre','text','a0','{}')");
    await expect(db.exec("INSERT INTO properties(id, database_id, name, type, position, config) VALUES ('b','d1','Nombre','number','a1','{}')")).rejects.toThrow();
    await db.exec("INSERT INTO properties(id, database_id, name, type, position, config) VALUES ('c','d2','Nombre','text','a0','{}')");
  });
  it("una página puede estar en varias bases, pero solo una vez en cada una (CL-34)", async () => {
    await db.exec("INSERT INTO databases(id, name, created_at, updated_at) VALUES ('d1','A',0,0), ('d2','B',0,0)");
    await db.exec("INSERT INTO db_rows(database_id, page_id, position, created_at, updated_at) VALUES ('d1','p1','a0',0,0), ('d2','p1','a0',0,0)");
    await expect(db.exec("INSERT INTO db_rows(database_id, page_id, position, created_at, updated_at) VALUES ('d1','p1','a1',0,0)")).rejects.toThrow();
  });
  it("hay una sola celda por (base, página, propiedad) y exige fila y propiedad existentes", async () => {
    await db.exec("INSERT INTO databases(id, name, created_at, updated_at) VALUES ('d1','A',0,0)");
    await db.exec("INSERT INTO properties(id, database_id, name, type, position, config) VALUES ('a','d1','N','text','a0','{}')");
    await db.exec("INSERT INTO db_rows(database_id, page_id, position, created_at, updated_at) VALUES ('d1','p1','a0',0,0)");
    await db.exec("INSERT INTO cell_values(database_id, page_id, property_id, value) VALUES ('d1','p1','a','\"hola\"')");
    await expect(db.exec("INSERT INTO cell_values(database_id, page_id, property_id, value) VALUES ('d1','p1','a','\"otra\"')")).rejects.toThrow();
    await expect(db.exec("INSERT INTO cell_values(database_id, page_id, property_id, value) VALUES ('d1','p2','a','\"x\"')")).rejects.toThrow(); // p2 no es fila
    await expect(db.exec("INSERT INTO cell_values(database_id, page_id, property_id, value) VALUES ('d1','p1','zzz','\"x\"')")).rejects.toThrow();
  });
  it("borrar una propiedad o una fila borra sus valores en cascada; borrar una base borra todo lo suyo", async () => {
    await db.exec("INSERT INTO databases(id, name, created_at, updated_at) VALUES ('d1','A',0,0)");
    await db.exec("INSERT INTO properties(id, database_id, name, type, position, config) VALUES ('a','d1','N','text','a0','{}')");
    await db.exec("INSERT INTO db_rows(database_id, page_id, position, created_at, updated_at) VALUES ('d1','p1','a0',0,0), ('d1','p2','a1',0,0)");
    await db.exec("INSERT INTO cell_values(database_id, page_id, property_id, value) VALUES ('d1','p1','a','1'), ('d1','p2','a','2')");
    await db.exec("DELETE FROM db_rows WHERE page_id = 'p2'");
    expect((await db.query("SELECT * FROM cell_values")).length).toBe(1);
    await db.exec("DELETE FROM properties WHERE id = 'a'");
    expect((await db.query("SELECT * FROM cell_values")).length).toBe(0);
    await db.exec("INSERT INTO properties(id, database_id, name, type, position, config) VALUES ('b','d1','M','text','a0','{}')");
    await db.exec("DELETE FROM databases WHERE id = 'd1'");
    for (const t of ["properties", "db_rows", "views"]) expect((await db.query(`SELECT * FROM ${t}`)).length).toBe(0);
  });
  it("las páginas de una base pueden ser la página completa o estar dentro de una nota (anfitriona)", async () => {
    await db.exec("INSERT INTO databases(id, name, page_id, created_at, updated_at) VALUES ('full','Página completa','p1',0,0)");
    await db.exec("INSERT INTO databases(id, name, host_page_id, created_at, updated_at) VALUES ('inline','En línea','p2',0,0)");
    await expect(db.exec("INSERT INTO databases(id, name, page_id, created_at, updated_at) VALUES ('x','x','p1',0,0)")).rejects.toThrow(); // una página completa = una base
  });
  it("las migraciones son idempotentes: volver a migrar no cambia nada", async () => {
    const r = await migrate(db, migrations);
    expect(r.ok).toBe(true);
  });
  it("borrar definitivamente una página borra sus filas, valores, vínculos y las bases que la tenían como página", async () => {
    await db.exec("INSERT INTO databases(id, name, page_id, created_at, updated_at) VALUES ('own','Suya','p2',0,0), ('d1','A',NULL,0,0)");
    await db.exec("INSERT INTO properties(id, database_id, name, type, position, config) VALUES ('a','d1','N','text','a0','{}'), ('r','d1','Rel','relation','a1','{}')");
    await db.exec("INSERT INTO db_rows(database_id, page_id, position, created_at, updated_at) VALUES ('d1','p1','a0',0,0)");
    await db.exec("INSERT INTO cell_values(database_id, page_id, property_id, value) VALUES ('d1','p1','a','1')");
    await db.exec("INSERT INTO relation_links(property_id, from_page_id, to_page_id) VALUES ('r','p1','p2')");
    await db.exec("DELETE FROM pages WHERE id = 'p1'");
    for (const t of ["db_rows", "cell_values", "relation_links"]) expect((await db.query(`SELECT * FROM ${t}`)).length, t).toBe(0);
    await db.exec("DELETE FROM pages WHERE id = 'p2'");
    expect((await db.query("SELECT id FROM databases")).map((r) => (r as { id: string }).id)).toEqual(["d1"]);
  });
});
