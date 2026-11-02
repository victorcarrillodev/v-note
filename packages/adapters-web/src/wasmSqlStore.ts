import { QueuedSqlStore, type SqlParam } from "@vnote/core";

/** Lo mínimo de un Worker que usa el cliente (permite un "worker" de bucle local en las pruebas). */
export interface WorkerLike {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onmessage: ((this: any, e: any) => any) | null;
  postMessage(msg: unknown): void;
  terminate(): void;
}

type Req = { id: number; op: "open" | "unlink" | "exec" | "query" | "begin" | "commit" | "rollback" | "close"; path?: string; sql?: string; params?: readonly SqlParam[] };
type Res = { id: number; ok: true; rows?: Record<string, unknown>[] } | { id: number; ok: false; error: string };

/** Subconjunto del objeto de base de datos de sqlite-wasm (oo1.DB / OpfsSAHPoolDb) que se necesita. */
export interface DbLike {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  exec(opts: any): any;
  close(): void;
}

/** Lógica del lado del worker: recibe peticiones y las ejecuta sobre la base. Separada del `self.onmessage` para poder probarla en Node. */
export function createWorkerHost(openDb: (path: string) => Promise<DbLike>, removeDb?: (path: string) => Promise<void>): (req: Req) => Promise<Res> {
  let db: DbLike | undefined;
  return async (req) => {
    try {
      if (req.op === "open") {
        db = await openDb(req.path ?? ":memory:");
        db.exec("PRAGMA foreign_keys = ON");
        return { id: req.id, ok: true };
      }
      if (req.op === "unlink") {
        if (!removeDb) throw new Error("este worker no puede borrar bases");
        await removeDb(req.path ?? "");
        return { id: req.id, ok: true };
      }
      if (!db) throw new Error("base de datos no abierta");
      switch (req.op) {
        case "exec":
          if (req.params && req.params.length) db.exec({ sql: req.sql!, bind: req.params as unknown[] });
          else db.exec(req.sql!);
          return { id: req.id, ok: true };
        case "query": {
          const rows = db.exec({ sql: req.sql!, bind: (req.params ?? []) as unknown[], rowMode: "object", returnValue: "resultRows" }) as Record<string, unknown>[];
          return { id: req.id, ok: true, rows };
        }
        case "begin": db.exec("BEGIN"); return { id: req.id, ok: true };
        case "commit": db.exec("COMMIT"); return { id: req.id, ok: true };
        case "rollback": db.exec("ROLLBACK"); return { id: req.id, ok: true };
        case "close": db.close(); db = undefined; return { id: req.id, ok: true };
      }
    } catch (e) {
      return { id: req.id, ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  };
}

/** SqlStore sobre SQLite WASM que vive en un Worker (plan D-2, D-4). */
export class WasmSqlStore extends QueuedSqlStore {
  private nextId = 0;
  private pending = new Map<number, { resolve: (r: Res) => void }>();

  private constructor(private worker: WorkerLike) {
    super();
    worker.onmessage = (e) => {
      const p = this.pending.get(e.data.id);
      if (!p) return;
      this.pending.delete(e.data.id);
      p.resolve(e.data as Res);
    };
  }

  /** Pide al worker borrar una base de OPFS que no está abierta. */
  static async unlink(worker: WorkerLike, path: string): Promise<void> {
    const store = new WasmSqlStore(worker);
    await store.call({ op: "unlink", path });
    worker.terminate();
  }

  static async open(worker: WorkerLike, path: string): Promise<WasmSqlStore> {
    const store = new WasmSqlStore(worker);
    await store.call({ op: "open", path });
    return store;
  }

  private call(req: Omit<Req, "id">): Promise<Res & { ok: true }> {
    const id = ++this.nextId;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve: (r) => (r.ok ? resolve(r) : reject(new Error(r.error))) });
      this.worker.postMessage({ ...req, id });
    });
  }

  protected async rawExec(sql: string, params?: readonly SqlParam[]): Promise<void> { await this.call({ op: "exec", sql, ...(params ? { params } : {}) }); }
  protected async rawQuery<T extends Record<string, unknown>>(sql: string, params?: readonly SqlParam[]): Promise<T[]> {
    const r = await this.call({ op: "query", sql, ...(params ? { params } : {}) });
    return (r.rows ?? []) as T[];
  }
  protected async rawBegin(): Promise<void> { await this.call({ op: "begin" }); }
  protected async rawCommit(): Promise<void> { await this.call({ op: "commit" }); }
  protected async rawRollback(): Promise<void> { await this.call({ op: "rollback" }); }
  protected async rawClose(): Promise<void> {
    await this.call({ op: "close" });
    this.worker.terminate();
  }
}
