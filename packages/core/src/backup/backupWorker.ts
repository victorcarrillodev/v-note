import type { Clock } from "../clock";
import type { AssetStore } from "../assets/assetStore";
import type { SqlStore } from "../ports/sqlStore";
import type { Port } from "../formulas/engineWorker";
import { GitHubClient, type FetchLike } from "./githubClient";
import {
  finalizeBackup, publishSnapshot, recordBackupRun, snapshotWorkspace,
  type BackupOptions, type BackupOutcome, type PublishInput,
} from "./runBackup";

/** Datos de conexión que viajan al worker solo en memoria (el token nunca se escribe en disco). */
export type Connection = { token: string; owner: string; repo: string; baseUrl?: string };
type Req =
  | { type: "publish"; id: number; connection: Connection; input: Omit<PublishInput, "files"> & { files: [string, Uint8Array][] }; onExternalChange?: "ask" | "continue" }
  | { type: "cancel"; id: number };

/**
 * Lado del worker: recibe la instantánea ya serializada y hace el trabajo pesado (huellas, diferencias, subida, commit).
 * Una cancelación se atiende entre una subida y la siguiente, de modo que la rama nunca avanza a medias (CL-17).
 */
export function serveBackup(port: Port, o: { fetch?: FetchLike } = {}): void {
  const running = new Map<number, AbortController>();
  port.addEventListener("message", (e) => {
    const m = e.data as Req;
    if (m.type === "cancel") { running.get(m.id)?.abort(); return; }
    const ac = new AbortController();
    running.set(m.id, ac);
    void (async () => {
      let result: BackupOutcome;
      try {
        const fetchFn = o.fetch ?? ((url, init) => (globalThis.fetch as unknown as FetchLike)(url, init));
        const client = new GitHubClient({ fetch: fetchFn, token: m.connection.token, owner: m.connection.owner, repo: m.connection.repo, ...(m.connection.baseUrl ? { baseUrl: m.connection.baseUrl } : {}) });
        result = await publishSnapshot({ ...m.input, files: new Map(m.input.files) }, client, { signal: ac.signal, ...(m.onExternalChange ? { onExternalChange: m.onExternalChange } : {}) });
      } catch (err) {
        result = { status: "failed", error: { kind: "UNKNOWN", message: err instanceof Error ? err.message : String(err), retryable: true } };
      } finally { running.delete(m.id); }
      port.postMessage({ id: m.id, result });
    })();
  });
  port.start?.();
}

/** Lado de la interfaz: pide un respaldo y puede cancelarlo. */
export class BackupWorkerClient {
  private seq = 0;
  private waiting = new Map<number, (r: BackupOutcome) => void>();
  constructor(private port: Port) {
    port.addEventListener("message", (e) => {
      const m = e.data as { id: number; result: BackupOutcome };
      this.waiting.get(m.id)?.(m.result);
      this.waiting.delete(m.id);
    });
    port.start?.();
  }
  publish(connection: Connection, input: PublishInput, opts: Pick<BackupOptions, "onExternalChange" | "signal"> = {}): Promise<BackupOutcome> {
    if (opts.signal?.aborted) return Promise.resolve({ status: "cancelled" });
    const id = ++this.seq;
    return new Promise((resolve) => {
      this.waiting.set(id, resolve);
      opts.signal?.addEventListener("abort", () => this.port.postMessage({ type: "cancel", id } satisfies Req), { once: true });
      this.port.postMessage({
        type: "publish", id, connection,
        input: { ...input, files: [...input.files] },
        ...(opts.onExternalChange ? { onExternalChange: opts.onExternalChange } : {}),
      } satisfies Req);
    });
  }
}

export type WorkerBackupDeps = {
  store: SqlStore; assets: AssetStore; clock: Clock; workspace: { id: string; name: string };
  worker: BackupWorkerClient; connection: Connection; branch?: string;
};

/** Respaldo completo (RF-15): la base se lee aquí, el trabajo pesado ocurre en el worker y aquí solo se anota el resultado. */
export async function runBackupInWorker(deps: WorkerBackupDeps, opts: BackupOptions = {}): Promise<BackupOutcome> {
  const startedAt = deps.clock.now();
  const outcome = await execute(deps, opts);
  await recordBackupRun(deps, startedAt, outcome);
  return outcome;
}

async function execute(deps: WorkerBackupDeps, opts: BackupOptions): Promise<BackupOutcome> {
  if (opts.signal?.aborted) return { status: "cancelled" };
  const snap = await snapshotWorkspace(deps, opts);
  if ("status" in snap) return snap;
  const last = await deps.store.query<{ value: string }>("SELECT value FROM meta WHERE key = ?", ["backup_last_commit"]);
  const outcome = await deps.worker.publish(
    deps.connection,
    { files: snap.files, skipped: snap.skipped, lastKnown: last[0]?.value ?? null, nowMs: deps.clock.now(), branch: deps.branch ?? "main" },
    opts,
  );
  await finalizeBackup(deps.store, deps.clock, outcome);
  return outcome;
}
