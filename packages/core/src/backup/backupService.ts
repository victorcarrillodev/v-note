import { appError, err, ok, type Result } from "../result";
import type { Clock } from "../clock";
import type { AssetStore } from "../assets/assetStore";
import type { SqlStore } from "../ports/sqlStore";
import { GitHubClient, type BackupErrorKind, type FetchLike } from "./githubClient";
import { BackupWorkerClient, runBackupInWorker } from "./backupWorker";
import { runBackup, type BackupOptions, type BackupOutcome } from "./runBackup";
import { BackupScheduler, nextDueAt, validateFrequency, type BackupEvent } from "./scheduler";
import type { GitHubTokenStore } from "./tokenStore";

export type BackupSettings = { owner: string | null; repo: string | null; branch: string; frequencyDays: number; enabled: boolean; hasToken: boolean };
export type RunRecord = { id: number; startedAt: number; finishedAt: number; status: string; commitSha: string | null; errorKind: string | null; errorMessage: string | null };
export type BackupAlert =
  | { type: "failed"; kind: BackupErrorKind | string; message: string; retryable: boolean; suggestions?: ("USE_OTHER_REPO" | "REMOVE_HEAVY_ATTACHMENTS")[] }
  | { type: "needs_decision"; remoteHead: string | null };
export type BackupStatus = {
  connected: boolean; enabled: boolean; paused: boolean; lastSuccessAt: number | null; nextDueAt: number | null;
  retryAt: number | null; attempts: number; history: RunRecord[]; alert: BackupAlert | null;
};

const RETRYABLE = new Set(["OFFLINE", "RATE_LIMIT", "SERVER", "UNKNOWN"]);
const NAME = /^[A-Za-z0-9_.-]+$/;
const META = { owner: "backup_repo_owner", repo: "backup_repo_name", branch: "backup_branch", decision: "backup_pending_decision" } as const;

/** Servicio de respaldo de UN espacio de trabajo: conexión con GitHub, frecuencia, ejecución, estado y avisos (RF-14, RF-15, RF-16). */
export class BackupService {
  private scheduler: BackupScheduler;
  private listeners = new Set<() => void>();

  constructor(private d: {
    store: SqlStore; assets: AssetStore; clock: Clock; workspace: { id: string; name: string };
    tokens: GitHubTokenStore; fetch: FetchLike; log?: (m: string) => void;
    /** Si existe, el trabajo pesado del respaldo corre en un worker (RNF-12); si no, en este mismo hilo. */
    worker?: BackupWorkerClient;
  }) {
    this.scheduler = new BackupScheduler({ store: d.store, clock: d.clock, run: (o) => this.executeRun(o), onEvent: (e) => void this.onEvent(e) });
  }

  subscribe = (fn: () => void): (() => void) => { this.listeners.add(fn); return () => this.listeners.delete(fn); };
  private emit() { this.listeners.forEach((l) => l()); }

  private async meta(key: string) { return (await this.d.store.query<{ value: string }>("SELECT value FROM meta WHERE key = ?", [key]))[0]?.value ?? null; }
  private setMeta(key: string, value: string | null) {
    return value === null ? this.d.store.exec("DELETE FROM meta WHERE key = ?", [key]) : this.d.store.exec("INSERT OR REPLACE INTO meta(key, value) VALUES (?, ?)", [key, value]);
  }

  async getSettings(): Promise<BackupSettings> {
    const cfg = await this.scheduler.getConfig();
    return {
      owner: await this.meta(META.owner), repo: await this.meta(META.repo), branch: (await this.meta(META.branch)) ?? "main",
      frequencyDays: cfg.frequencyDays, enabled: cfg.enabled, hasToken: (await this.d.tokens.get()) !== null,
    };
  }

  /** Verifica token y repositorio ANTES de guardar nada. Un repositorio público exige confirmación explícita (RF-14). */
  async connect(i: { token: string; owner: string; repo: string; branch?: string; confirmPublic?: boolean }): Promise<Result<{ isPrivate: boolean; tokenPersisted: boolean }>> {
    const token = i.token.trim(), owner = i.owner.trim(), repo = i.repo.trim();
    if (token === "" || /\s/.test(token)) return err(appError("INVALID", "El token no puede estar vacío ni contener espacios", { field: "token" }));
    if (!NAME.test(owner)) return err(appError("INVALID", "El propietario del repositorio no es válido", { field: "owner" }));
    if (!NAME.test(repo)) return err(appError("INVALID", "El nombre del repositorio no es válido", { field: "repo" }));

    const check = await new GitHubClient({ fetch: this.d.fetch, token, owner, repo, ...(this.d.log ? { log: this.d.log } : {}) }).checkRepo();
    if (!check.ok) return err(appError("INVALID", check.error.message, { kind: check.error.kind }));
    if (!check.value.canPush) return err(appError("INVALID", "El token no tiene permiso de escritura en este repositorio", { kind: "NO_PERMISSION" }));
    if (!check.value.isPrivate && !i.confirmPublic) {
      return err(appError("NEEDS_CONFIRMATION", "El repositorio es público: tus notas serían visibles para cualquiera", { reason: "PUBLIC_REPO" }));
    }

    const stored = await this.d.tokens.set(token);
    if (!stored.ok) return stored;
    await this.setMeta(META.owner, owner);
    await this.setMeta(META.repo, repo);
    await this.setMeta(META.branch, i.branch ?? check.value.defaultBranch);
    await this.scheduler.configure({ enabled: true, frequencyDays: (await this.scheduler.getConfig()).frequencyDays });
    this.emit();
    return ok({ isPrivate: check.value.isPrivate, tokenPersisted: stored.value.persisted });
  }

  async disconnect(): Promise<void> {
    await this.d.tokens.clear();
    for (const k of Object.values(META)) await this.setMeta(k, null);
    await this.scheduler.configure({ enabled: false, frequencyDays: (await this.scheduler.getConfig()).frequencyDays });
    this.emit();
  }

  async setFrequency(days: number): Promise<Result<number>> {
    const v = validateFrequency(days);
    if (!v.ok) return v;
    await this.scheduler.configure({ enabled: (await this.scheduler.getConfig()).enabled, frequencyDays: days });
    this.emit();
    return v;
  }

  private async executeRun(opts?: BackupOptions): Promise<BackupOutcome> {
    const token = await this.d.tokens.get();
    const owner = await this.meta(META.owner), repo = await this.meta(META.repo);
    if (!token || !owner || !repo) return { status: "failed", error: { kind: "UNKNOWN", message: "El respaldo no está configurado: falta el token o el repositorio", retryable: false } };
    const branch = (await this.meta(META.branch)) ?? "main";
    const outcome = this.d.worker
      ? await runBackupInWorker({ store: this.d.store, assets: this.d.assets, clock: this.d.clock, workspace: this.d.workspace, worker: this.d.worker, connection: { token, owner, repo }, branch }, opts)
      : await runBackup(
          { store: this.d.store, assets: this.d.assets, client: new GitHubClient({ fetch: this.d.fetch, token, owner, repo, ...(this.d.log ? { log: this.d.log } : {}) }), clock: this.d.clock, workspace: this.d.workspace, branch },
          opts,
        );
    if (outcome.status === "needs_decision") await this.setMeta(META.decision, outcome.remoteHead ?? "");
    else if (outcome.status === "success" || outcome.status === "unchanged") await this.setMeta(META.decision, null);
    return outcome;
  }

  private async onEvent(_e: BackupEvent) { this.emit(); }

  /** «Respaldar ahora» (también sirve de «Reintentar»). */
  async runNow(opts?: BackupOptions): Promise<BackupOutcome | null> {
    const out = await this.scheduler.runNow(opts);
    this.emit();
    return out;
  }

  /** Se llama en cada tic. */
  async tick(): Promise<void> {
    const out = await this.scheduler.onTick();
    if (out) this.emit();
  }

  /** Decisión ante un cambio externo en el repositorio: continuar encima de él, o cancelar y dejar el respaldo automático en pausa. */
  async resolveExternalChange(decision: "continue" | "cancel"): Promise<void> {
    if (decision === "continue") {
      await this.runNow({ onExternalChange: "continue" });
      return;
    }
    await this.setMeta(META.decision, null); // el respaldo automático queda en pausa hasta que se pulse «Respaldar ahora»
    this.emit();
  }

  async getStatus(): Promise<BackupStatus> {
    const cfg = await this.scheduler.getConfig();
    const st = await this.scheduler.getState();
    const owner = await this.meta(META.owner), repo = await this.meta(META.repo);
    const rows = await this.d.store.query<{ id: number; started_at: number; finished_at: number; status: string; commit_sha: string | null; error_kind: string | null; error_message: string | null }>(
      "SELECT id, started_at, finished_at, status, commit_sha, error_kind, error_message FROM backup_runs ORDER BY id DESC LIMIT 20",
    );
    const history: RunRecord[] = rows.map((r) => ({ id: r.id, startedAt: r.started_at, finishedAt: r.finished_at, status: r.status, commitSha: r.commit_sha, errorKind: r.error_kind, errorMessage: r.error_message }));

    let alert: BackupAlert | null = null;
    const decision = await this.meta(META.decision);
    const last = rows[0];
    if (decision !== null) alert = { type: "needs_decision", remoteHead: decision === "" ? null : decision };
    else if (last?.status === "failed") {
      const kind = last.error_kind ?? "UNKNOWN";
      alert = { type: "failed", kind, message: last.error_message ?? "", retryable: RETRYABLE.has(kind), ...(kind === "REPO_FULL" ? { suggestions: ["USE_OTHER_REPO", "REMOVE_HEAVY_ATTACHMENTS"] as ("USE_OTHER_REPO" | "REMOVE_HEAVY_ATTACHMENTS")[] } : {}) };
    }

    const connected = Boolean(owner && repo);
    const due = st.nextAttemptAt ?? nextDueAt(st.lastSuccessAt, cfg.frequencyDays);
    return {
      connected, enabled: cfg.enabled && connected, paused: st.paused, lastSuccessAt: st.lastSuccessAt,
      nextDueAt: connected && cfg.enabled && st.retryAt === null && !st.paused ? due : null,
      retryAt: st.retryAt, attempts: st.attempts, history, alert,
    };
  }
}
