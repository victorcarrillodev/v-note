// Adaptador de PRUEBAS sobre node:sqlite (Node 24). Los adaptadores reales son el nativo (Rust) y el web (WASM).
import { DatabaseSync } from "node:sqlite";
import type { SqlExecutor, SqlParam, SqlStore } from "../../src/ports/sqlStore";

export async function createNodeSqliteStore(path: string): Promise<SqlStore> {
  const db = new DatabaseSync(path);
  db.exec("PRAGMA foreign_keys = ON");
  const run = (sql: string, params: readonly SqlParam[] = []) => db.prepare(sql).run(...(params as never[]));
  const all = (sql: string, params: readonly SqlParam[] = []) => db.prepare(sql).all(...(params as never[]));

  const executor: SqlExecutor = {
    async exec(sql, params) {
      if (params && params.length) run(sql, params);
      else db.exec(sql);
    },
    async query<T extends Record<string, unknown>>(sql: string, params?: readonly SqlParam[]) {
      return all(sql, params) as unknown as T[];
    },
  };

  return {
    ...executor,
    async transaction<T>(fn: (tx: SqlExecutor) => Promise<T>) {
      db.exec("BEGIN");
      try {
        const value = await fn(executor);
        db.exec("COMMIT");
        return value;
      } catch (e) {
        db.exec("ROLLBACK");
        throw e;
      }
    },
    async close() {
      db.close();
    },
  };
}
