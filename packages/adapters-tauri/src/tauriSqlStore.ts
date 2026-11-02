import { QueuedSqlStore, type SqlParam } from "@vnote/core";

export type Invoke = (cmd: string, args?: Record<string, unknown> | Uint8Array, options?: { headers: Record<string, string> }) => Promise<unknown>;

const toBase64 = (b: Uint8Array): string => {
  let s = "";
  for (const byte of b) s += String.fromCharCode(byte);
  return btoa(s);
};
const fromBase64 = (s: string): Uint8Array => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

/** Codifica un parámetro SQL al formato JSON del puente nativo (binarios como `{ $blob }`). */
export function encodeParam(v: SqlParam | undefined): unknown {
  if (v === undefined || v === null) return null;
  if (v instanceof Uint8Array) return { $blob: toBase64(v) };
  if (typeof v === "bigint") {
    if (v > BigInt(Number.MAX_SAFE_INTEGER) || v < BigInt(Number.MIN_SAFE_INTEGER)) throw new Error("El entero es demasiado grande y perdería precisión");
    return Number(v);
  }
  return v;
}

export function decodeValue(v: unknown): unknown {
  if (v && typeof v === "object" && "$blob" in (v as object)) return fromBase64((v as { $blob: string }).$blob);
  return v;
}

/** SqlStore sobre los comandos nativos de Tauri (Rust + rusqlite). */
export class TauriSqlStore extends QueuedSqlStore {
  private constructor(private invoke: Invoke, private handle: number) {
    super();
  }

  static async open(invoke: Invoke, path: string): Promise<TauriSqlStore> {
    const handle = (await invoke("db_open", { path })) as number;
    return new TauriSqlStore(invoke, handle);
  }

  protected async rawExec(sql: string, params: readonly SqlParam[] = []): Promise<void> {
    await this.invoke("db_exec", { handle: this.handle, sql, params: params.map(encodeParam) });
  }
  protected async rawQuery<T extends Record<string, unknown>>(sql: string, params: readonly SqlParam[] = []): Promise<T[]> {
    const rows = (await this.invoke("db_query", { handle: this.handle, sql, params: params.map(encodeParam) })) as Record<string, unknown>[];
    return rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, decodeValue(v)]))) as T[];
  }
  protected async rawBegin(): Promise<void> { await this.invoke("db_begin", { handle: this.handle }); }
  protected async rawCommit(): Promise<void> { await this.invoke("db_commit", { handle: this.handle }); }
  protected async rawRollback(): Promise<void> { await this.invoke("db_rollback", { handle: this.handle }); }
  protected async rawClose(): Promise<void> { await this.invoke("db_close", { handle: this.handle }); }
}
