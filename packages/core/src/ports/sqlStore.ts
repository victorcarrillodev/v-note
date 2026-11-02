export type SqlParam = string | number | bigint | null | Uint8Array;

export interface SqlExecutor {
  exec(sql: string, params?: readonly SqlParam[]): Promise<void>;
  query<T extends Record<string, unknown> = Record<string, unknown>>(sql: string, params?: readonly SqlParam[]): Promise<T[]>;
}

/** Puerto de almacenamiento: una base SQLite por espacio de trabajo (plan D-1). Asíncrono porque los adaptadores usan IPC o workers. */
export interface SqlStore extends SqlExecutor {
  /** Ejecuta `fn` en una transacción: confirma si termina bien y revierte (relanzando el error) si falla. */
  transaction<T>(fn: (tx: SqlExecutor) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}
