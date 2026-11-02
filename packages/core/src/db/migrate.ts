import { appError, err, ok, type Result } from "../result";
import type { SqlExecutor, SqlStore } from "../ports/sqlStore";

export type Migration = { version: number; name: string; up: (tx: SqlExecutor) => Promise<void> };
export type MigrateOptions = {
  /** Se llama una sola vez, antes de la primera migración pendiente, para copiar la base (plan D-32). Si lanza, no se migra. */
  beforeMigrate?: (info: { from: number; to: number }) => Promise<void>;
};
export type MigrateOutcome = { from: number; to: number; applied: number[] };

const userVersion = async (db: SqlExecutor): Promise<number> => {
  const rows = await db.query<{ user_version: number }>("PRAGMA user_version");
  return rows[0]?.user_version ?? 0;
};

/** Aplica las migraciones pendientes, cada una en su propia transacción atómica. */
export async function migrate(db: SqlStore, migrations: readonly Migration[], options: MigrateOptions = {}): Promise<Result<MigrateOutcome>> {
  const sorted = [...migrations].sort((a, b) => a.version - b.version);
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i]!.version !== i + 1) {
      return err(appError("INVALID", "Las migraciones deben tener versiones consecutivas desde 1 sin repetir", { version: sorted[i]!.version }));
    }
  }
  const latest = sorted.length;
  const from = await userVersion(db);
  if (from > latest) {
    return err(appError("UNSUPPORTED_VERSION", "La base de datos es de una versión más nueva que la soportada", { found: from, supported: latest }));
  }
  const pending = sorted.filter((m) => m.version > from);
  if (pending.length === 0) return ok({ from, to: from, applied: [] });

  try {
    await options.beforeMigrate?.({ from, to: latest });
  } catch (e) {
    return err(appError("STORAGE", "No se pudo hacer la copia previa a la migración; no se migró nada", { cause: String(e) }));
  }

  const applied: number[] = [];
  for (const m of pending) {
    try {
      await db.transaction(async (tx) => {
        await m.up(tx);
        await tx.exec(`PRAGMA user_version = ${m.version}`);
      });
      applied.push(m.version);
    } catch (e) {
      return err(appError("STORAGE", `Falló la migración ${m.version} (${m.name})`, { version: m.version, cause: String(e) }));
    }
  }
  return ok({ from, to: latest, applied });
}
