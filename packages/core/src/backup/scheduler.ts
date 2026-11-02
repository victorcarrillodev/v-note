import { appError, err, ok, type Result } from "../result";
import type { Clock } from "../clock";
import type { SqlStore } from "../ports/sqlStore";
import type { BackupError } from "./githubClient";
import type { BackupOptions, BackupOutcome } from "./runBackup";

const MIN = 60_000;
const DAY = 86_400_000;
/** Esperas entre reintentos tras un fallo recuperable (plan 6.4): 1, 5, 15 y 60 minutos; luego aviso. */
export const RETRY_DELAYS_MIN = [1, 5, 15, 60] as const;

export type BackupConfig = { enabled: boolean; frequencyDays: number };
export type BackupState = { lastSuccessAt: number | null; attempts: number; retryAt: number | null; nextAttemptAt: number | null; paused: boolean };
export type BackupEvent =
  | { type: "success" | "unchanged" | "cancelled" }
  | { type: "failed_will_retry"; error: BackupError; attempt: number; retryAt: number }
  | { type: "failed_final"; error: BackupError; nextAttemptAt: number }
  | { type: "needs_decision"; remoteHead: string | null };

/** Momento en que vence el siguiente respaldo: último éxito + frecuencia. Sin éxito previo vence ya (0). */
export const nextDueAt = (lastSuccessAt: number | null, frequencyDays: number): number =>
  lastSuccessAt === null ? 0 : lastSuccessAt + frequencyDays * DAY;

export function validateFrequency(days: number): Result<number> {
  return Number.isInteger(days) && days >= 1 && days <= 7
    ? ok(days)
    : err(appError("INVALID", "La frecuencia del respaldo debe ser de 1 a 7 días", { days }));
}

const KEYS = {
  enabled: "backup_enabled", freq: "backup_frequency_days", last: "last_backup_at",
  attempts: "backup_attempts", retryAt: "backup_retry_at", next: "backup_next_attempt_at", paused: "backup_paused",
} as const;

/**
 * Decide cuándo respaldar (RF-14, RF-15, RF-16). Todo el estado vive en la base, así que sobrevive a cerrar la aplicación:
 * al abrirla, si venció el plazo, se hace UN solo respaldo aunque hayan vencido varios (CL-19).
 */
export class BackupScheduler {
  private running = false;
  constructor(private d: {
    store: SqlStore;
    clock: Clock;
    run: (opts?: BackupOptions) => Promise<BackupOutcome>;
    onEvent: (e: BackupEvent) => void;
  }) {}

  private async get(key: string): Promise<string | null> {
    return (await this.d.store.query<{ value: string }>("SELECT value FROM meta WHERE key = ?", [key]))[0]?.value ?? null;
  }
  private set(key: string, value: string | null) {
    return value === null
      ? this.d.store.exec("DELETE FROM meta WHERE key = ?", [key])
      : this.d.store.exec("INSERT OR REPLACE INTO meta(key, value) VALUES (?, ?)", [key, value]);
  }
  private num = (v: string | null) => (v === null ? null : Number(v));

  async getConfig(): Promise<BackupConfig> {
    return { enabled: (await this.get(KEYS.enabled)) === "1", frequencyDays: this.num(await this.get(KEYS.freq)) ?? 1 };
  }

  async configure(c: BackupConfig): Promise<Result<BackupConfig>> {
    const f = validateFrequency(c.frequencyDays);
    if (!f.ok) return f;
    await this.set(KEYS.enabled, c.enabled ? "1" : "0");
    await this.set(KEYS.freq, String(c.frequencyDays));
    return ok(c);
  }

  async getState(): Promise<BackupState> {
    return {
      lastSuccessAt: this.num(await this.get(KEYS.last)),
      attempts: this.num(await this.get(KEYS.attempts)) ?? 0,
      retryAt: this.num(await this.get(KEYS.retryAt)),
      nextAttemptAt: this.num(await this.get(KEYS.next)),
      paused: (await this.get(KEYS.paused)) === "1",
    };
  }

  private async isDue(now: number, cfg: BackupConfig): Promise<boolean> {
    const s = await this.getState();
    if (s.paused) return false;
    if (s.retryAt !== null) return now >= s.retryAt;
    return now >= (s.nextAttemptAt ?? nextDueAt(s.lastSuccessAt, cfg.frequencyDays));
  }

  /** Se llama en cada tic (cada minuto) y al abrir la aplicación. Devuelve null si no tocaba o ya hay un respaldo en curso. */
  async onTick(): Promise<BackupOutcome | null> {
    if (this.running) return null;
    this.running = true; // se reserva de forma SÍNCRONA: dos tics seguidos nunca lanzan dos respaldos
    try {
      const cfg = await this.getConfig();
      if (!cfg.enabled || !(await this.isDue(this.d.clock.now(), cfg))) return null;
      return await this.execute(undefined, cfg);
    } finally {
      this.running = false;
    }
  }

  /** «Respaldar ahora»: ignora el plazo, el reintento pendiente y la pausa. */
  async runNow(opts?: BackupOptions): Promise<BackupOutcome | null> {
    if (this.running) return null;
    this.running = true;
    try {
      return await this.execute(opts, await this.getConfig());
    } finally {
      this.running = false;
    }
  }

  private async execute(opts: BackupOptions | undefined, cfg: BackupConfig): Promise<BackupOutcome> {
    await this.set(KEYS.paused, null);
    const outcome = await this.d.run(opts);
    await this.apply(outcome, cfg);
    return outcome;
  }

  private async apply(o: BackupOutcome, cfg: BackupConfig): Promise<void> {
    const now = this.d.clock.now();
    switch (o.status) {
      case "success":
      case "unchanged":
        await this.set(KEYS.last, String(now));
        for (const k of [KEYS.attempts, KEYS.retryAt, KEYS.next, KEYS.paused]) await this.set(k, null);
        this.d.onEvent({ type: o.status });
        return;
      case "needs_decision":
        await this.set(KEYS.paused, "1");
        await this.set(KEYS.retryAt, null);
        this.d.onEvent({ type: "needs_decision", remoteHead: o.remoteHead });
        return;
      case "cancelled":
        this.d.onEvent({ type: "cancelled" });
        return;
      case "failed": {
        const attempts = (this.num(await this.get(KEYS.attempts)) ?? 0) + 0;
        if (o.error.retryable && attempts < RETRY_DELAYS_MIN.length) {
          const retryAt = Math.max(now + RETRY_DELAYS_MIN[attempts]! * MIN, o.error.retryAt ?? 0);
          await this.set(KEYS.attempts, String(attempts + 1));
          await this.set(KEYS.retryAt, String(retryAt));
          this.d.onEvent({ type: "failed_will_retry", error: o.error, attempt: attempts + 1, retryAt });
        } else {
          const nextAttemptAt = now + cfg.frequencyDays * DAY;
          await this.set(KEYS.attempts, null);
          await this.set(KEYS.retryAt, null);
          await this.set(KEYS.next, String(nextAttemptAt));
          this.d.onEvent({ type: "failed_final", error: o.error, nextAttemptAt });
        }
      }
    }
  }
}
