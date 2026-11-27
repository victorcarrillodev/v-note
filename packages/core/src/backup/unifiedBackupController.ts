import type { Clock } from "../clock";
import type { AppBackupService } from "./appBackupService";
import type { BackupDestination, DestResult, SyncOutcome } from "./destination";
import { IdleBackupScheduler, type IdleSyncStatus } from "./idleScheduler";

export type UnifiedBackupState = "idle" | "syncing" | "ok" | "retrying" | "error";
export type UnifiedBackupStatus = { state: UnifiedBackupState; lastSyncAt: number | null; message?: string };

/**
 * Une el servicio de respaldo unificado, el destino elegido y el planificador de respaldo continuo.
 * La interfaz solo llama a `notifyChange` al editar y a `syncNow` desde el botón.
 */
export class UnifiedBackupController {
  private scheduler: IdleBackupScheduler;
  private current: UnifiedBackupStatus = { state: "idle", lastSyncAt: null };
  private listeners = new Set<(s: UnifiedBackupStatus) => void>();
  private continuous = false;
  /** Evita dos sincronizaciones simultáneas al pulsar el botón durante una automática. */
  private inFlight: Promise<SyncOutcome> | null = null;
  /** El destino conserva estado (ids remotos): se reutiliza hasta que cambie la configuración. */
  private dest: BackupDestination | null = null;

  constructor(
    private d: {
      service: Pick<AppBackupService, "syncTo" | "invalidateWorkspace" | "resetManifestCache">;
      destination: () => Promise<DestResult<BackupDestination>>;
      clock: Clock;
      debounceMs?: number;
      maxWaitMs?: number;
    },
  ) {
    this.scheduler = new IdleBackupScheduler({
      clock: d.clock,
      ...(d.debounceMs !== undefined ? { debounceMs: d.debounceMs } : {}),
      ...(d.maxWaitMs !== undefined ? { maxWaitMs: d.maxWaitMs } : {}),
      run: async (dirty) => toIdleStatus(await this.run(dirty)),
    });
    this.scheduler.setEnabled(false);
  }

  status(): UnifiedBackupStatus { return this.current; }

  onStatus(cb: (s: UnifiedBackupStatus) => void): () => void {
    this.listeners.add(cb);
    return () => void this.listeners.delete(cb);
  }

  setContinuous(on: boolean): void {
    this.continuous = on;
    this.scheduler.setEnabled(on);
  }

  /** Cambió el destino (o sus credenciales): el próximo respaldo compara contra el manifiesto del destino nuevo. */
  destinationChanged(): void {
    this.dest = null;
    this.d.service.resetManifestCache();
  }

  notifyChange(workspaceId: string): void {
    this.d.service.invalidateWorkspace(workspaceId);
    this.scheduler.notifyChange(workspaceId); // apagado: solo acumula; al activarlo se agenda
  }

  async syncNow(): Promise<SyncOutcome> {
    return this.run();
  }

  dispose(): void { this.scheduler.dispose(); }

  private set(s: UnifiedBackupStatus): void {
    this.current = s;
    for (const l of this.listeners) l(s);
  }

  private run(dirty?: ReadonlySet<string>): Promise<SyncOutcome> {
    if (this.inFlight) return this.inFlight;
    this.inFlight = this.execute(dirty).finally(() => { this.inFlight = null; });
    return this.inFlight;
  }

  private async execute(dirty?: ReadonlySet<string>): Promise<SyncOutcome> {
    this.set({ ...this.current, state: "syncing" });
    let dest: Awaited<ReturnType<typeof this.d.destination>>;
    try {
      dest = this.dest ? ({ ok: true, value: this.dest } as const) : await this.d.destination();
    } catch (e) {
      dest = { ok: false, error: { kind: "UNKNOWN", message: e instanceof Error ? e.message : String(e), retryable: true } };
    }
    if (dest.ok) this.dest = dest.value;
    if (!dest.ok) {
      this.set({ state: dest.error.retryable && this.continuous ? "retrying" : "error", lastSyncAt: this.current.lastSyncAt, message: dest.error.message });
      return { status: "failed", error: dest.error };
    }
    let outcome: SyncOutcome;
    try {
      outcome = await this.d.service.syncTo(dest.value, dirty ? { dirtyWorkspaceIds: dirty } : {});
    } catch (e) {
      const error = { kind: "UNKNOWN" as const, message: e instanceof Error ? e.message : String(e), retryable: true };
      this.set({ state: this.continuous ? "retrying" : "error", lastSyncAt: this.current.lastSyncAt, message: error.message });
      return { status: "failed", error };
    }
    if (outcome.status === "success" || outcome.status === "unchanged") {
      this.set({ state: "ok", lastSyncAt: this.d.clock.now() });
    } else if (outcome.status === "failed") {
      this.set({ state: outcome.error.retryable && this.continuous ? "retrying" : "error", lastSyncAt: this.current.lastSyncAt, message: outcome.error.message });
    } else {
      this.set({ ...this.current, state: "idle" });
    }
    return outcome;
  }
}

function toIdleStatus(o: SyncOutcome): IdleSyncStatus {
  if (o.status === "success") return "success";
  if (o.status === "unchanged" || o.status === "cancelled") return "unchanged";
  return o.error.retryable ? "retryable_error" : "fatal_error";
}
