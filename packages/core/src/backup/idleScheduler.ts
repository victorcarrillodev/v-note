import type { Clock } from "../clock";

export type IdleSyncStatus = "success" | "unchanged" | "retryable_error" | "fatal_error";

const RETRY_DELAYS_MS = [60_000, 300_000, 900_000, 3_600_000] as const;

/**
 * Planificador de respaldo continuo tras dejar de escribir:
 * - Espera `debounceMs` (por defecto 12 s) desde la última edición.
 * - Garantiza un tope `maxWaitMs` (60 s) si la persona escribe sin pausas largas.
 * - Coalesce ediciones que llegan mientras hay una sincronización en curso sin duplicar trabajos.
 */
export class IdleBackupScheduler {
  private dirty = new Set<string>();
  private firstDirtyAt: number | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private running = false;
  private pendingWhileRunning = false;
  private retryCount = 0;
  private enabled = true;
  private readonly debounceMs: number;
  private readonly maxWaitMs: number;

  constructor(
    private d: {
      clock: Clock;
      run: (dirtyWorkspaceIds: ReadonlySet<string>) => Promise<IdleSyncStatus>;
      debounceMs?: number;
      maxWaitMs?: number;
      scheduleIdle?: (cb: () => void) => void;
    },
  ) {
    this.debounceMs = d.debounceMs ?? 12_000;
    this.maxWaitMs = d.maxWaitMs ?? 60_000;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) this.clearTimer();
    else if (this.dirty.size > 0 && !this.running) this.schedule(this.computeDelay());
  }

  notifyChange(workspaceId: string): void {
    this.dirty.add(workspaceId);
    if (this.firstDirtyAt === null) this.firstDirtyAt = this.d.clock.now();
    if (!this.enabled) return;
    if (this.running) {
      this.pendingWhileRunning = true;
      return;
    }
    this.schedule(this.computeDelay());
  }

  async flush(): Promise<IdleSyncStatus | null> {
    this.clearTimer();
    if (this.running || this.dirty.size === 0) return null;
    return this.execute();
  }

  dispose(): void {
    this.clearTimer();
  }

  private computeDelay(): number {
    if (this.firstDirtyAt === null) return this.debounceMs;
    const elapsed = Math.max(0, this.d.clock.now() - this.firstDirtyAt);
    const remaining = Math.max(0, this.maxWaitMs - elapsed);
    return Math.min(this.debounceMs, remaining);
  }

  private clearTimer(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private schedule(delayMs: number): void {
    this.clearTimer();
    this.timer = setTimeout(() => {
      this.timer = null;
      if (this.d.scheduleIdle) this.d.scheduleIdle(() => void this.execute());
      else void this.execute();
    }, delayMs);
  }

  private async execute(): Promise<IdleSyncStatus> {
    if (this.running || this.dirty.size === 0) return "unchanged";
    this.running = true;
    this.pendingWhileRunning = false;
    const batch = new Set(this.dirty);
    this.dirty.clear();
    this.firstDirtyAt = null;

    let status: IdleSyncStatus;
    try {
      status = await this.d.run(batch);
    } catch {
      status = "retryable_error";
    } finally {
      this.running = false;
    }

    if (status === "retryable_error") {
      for (const id of batch) this.dirty.add(id);
      if (this.firstDirtyAt === null) this.firstDirtyAt = this.d.clock.now();
      const delay = RETRY_DELAYS_MS[Math.min(this.retryCount, RETRY_DELAYS_MS.length - 1)]!;
      this.retryCount++;
      if (this.enabled) this.schedule(delay);
      return status;
    }

    this.retryCount = 0;
    if ((this.pendingWhileRunning || this.dirty.size > 0) && this.enabled) {
      this.schedule(this.computeDelay());
    }
    return status;
  }
}
