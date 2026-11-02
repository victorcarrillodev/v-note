import type { SqlExecutor, SqlParam, SqlStore } from "./sqlStore";

/**
 * Base común de los adaptadores con UNA conexión remota (nativo por IPC, web por Worker):
 * serializa el acceso para que una transacción en curso bloquee las demás sentencias y garantiza commit/rollback.
 */
export abstract class QueuedSqlStore implements SqlStore {
  private tail: Promise<unknown> = Promise.resolve();

  protected abstract rawExec(sql: string, params?: readonly SqlParam[]): Promise<void>;
  protected abstract rawQuery<T extends Record<string, unknown>>(sql: string, params?: readonly SqlParam[]): Promise<T[]>;
  protected abstract rawBegin(): Promise<void>;
  protected abstract rawCommit(): Promise<void>;
  protected abstract rawRollback(): Promise<void>;
  protected abstract rawClose(): Promise<void>;

  private executor: SqlExecutor = {
    exec: (sql, params) => this.rawExec(sql, params),
    query: <T extends Record<string, unknown>>(sql: string, params?: readonly SqlParam[]) => this.rawQuery<T>(sql, params),
  };

  private enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.tail.then(fn, fn);
    this.tail = run.catch(() => undefined);
    return run;
  }

  exec(sql: string, params?: readonly SqlParam[]): Promise<void> {
    return this.enqueue(() => this.rawExec(sql, params));
  }

  query<T extends Record<string, unknown> = Record<string, unknown>>(sql: string, params?: readonly SqlParam[]): Promise<T[]> {
    return this.enqueue(() => this.rawQuery<T>(sql, params));
  }

  transaction<T>(fn: (tx: SqlExecutor) => Promise<T>): Promise<T> {
    return this.enqueue(async () => {
      await this.rawBegin();
      try {
        const value = await fn(this.executor);
        await this.rawCommit();
        return value;
      } catch (e) {
        await this.rawRollback().catch(() => undefined);
        throw e;
      }
    });
  }

  close(): Promise<void> {
    return this.enqueue(() => this.rawClose());
  }
}
