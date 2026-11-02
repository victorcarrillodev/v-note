// T-039: suite de contrato de SqlStore. La ejecutan TODOS los adaptadores (pruebas, nativo, web) para garantizar el mismo comportamiento.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { SqlStore } from "./sqlStore";

export function runSqlStoreContract(name: string, create: () => Promise<SqlStore>) {
  describe(`contrato SqlStore: ${name}`, () => {
    let db: SqlStore;
    beforeEach(async () => {
      db = await create();
      await db.exec("CREATE TABLE t(id INTEGER PRIMARY KEY, v TEXT)");
    });
    afterEach(async () => {
      await db.close();
    });

    it("exec y query con parámetros enlazados", async () => {
      await db.exec("INSERT INTO t(v) VALUES (?), (?)", ["a", "b"]);
      expect(await db.query<{ v: string }>("SELECT v FROM t WHERE v = ?", ["b"])).toEqual([{ v: "b" }]);
    });
    it("los parámetros no se interpretan como SQL (inyección)", async () => {
      await db.exec("INSERT INTO t(v) VALUES (?)", ["x'); DROP TABLE t; --"]);
      expect((await db.query("SELECT * FROM t")).length).toBe(1);
    });
    it("query devuelve filas como objetos y una lista vacía si no hay resultados", async () => {
      expect(await db.query("SELECT * FROM t")).toEqual([]);
      await db.exec("INSERT INTO t(id, v) VALUES (1, 'z')");
      expect(await db.query("SELECT id, v FROM t")).toEqual([{ id: 1, v: "z" }]);
    });
    it("transaction confirma cuando termina bien y devuelve el valor", async () => {
      const r = await db.transaction(async (tx) => {
        await tx.exec("INSERT INTO t(v) VALUES ('a')");
        return 42;
      });
      expect(r).toBe(42);
      expect((await db.query("SELECT * FROM t")).length).toBe(1);
    });
    it("transaction revierte todo y relanza el error si la función falla", async () => {
      await expect(
        db.transaction(async (tx) => {
          await tx.exec("INSERT INTO t(v) VALUES ('a')");
          throw new Error("falla a propósito");
        }),
      ).rejects.toThrow("falla a propósito");
      expect(await db.query("SELECT * FROM t")).toEqual([]);
    });
    it("una sentencia inválida dentro de la transacción la revierte", async () => {
      await expect(
        db.transaction(async (tx) => {
          await tx.exec("INSERT INTO t(v) VALUES ('a')");
          await tx.exec("INSERT INTO no_existe(v) VALUES ('b')");
        }),
      ).rejects.toThrow();
      expect(await db.query("SELECT * FROM t")).toEqual([]);
    });
    it("el texto completo (FTS5) está disponible y resalta fragmentos", async () => {
      await db.exec("CREATE VIRTUAL TABLE page_text USING fts5(title, body)");
      await db.exec("INSERT INTO page_text(title, body) VALUES (?, ?)", ["Receta", "tortillas de maiz y frijoles"]);
      const hits = await db.query<{ title: string }>("SELECT title FROM page_text WHERE page_text MATCH ?", ["tortillas"]);
      expect(hits).toEqual([{ title: "Receta" }]);
      const s = await db.query<{ s: string }>("SELECT snippet(page_text, 1, '<b>', '</b>', '…', 8) AS s FROM page_text WHERE page_text MATCH ?", ["frijoles"]);
      expect(s[0]?.s).toContain("<b>frijoles</b>");
    });
    it("las claves foráneas están activadas", async () => {
      await db.exec("CREATE TABLE hijo(id INTEGER PRIMARY KEY, padre INTEGER REFERENCES t(id))");
      await expect(db.exec("INSERT INTO hijo(padre) VALUES (999)")).rejects.toThrow();
    });
  });
}
