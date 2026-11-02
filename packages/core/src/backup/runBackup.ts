import type { Clock } from "../clock";
import type { AssetStore } from "../assets/assetStore";
import type { SqlStore } from "../ports/sqlStore";
import { gitBlobSha, gitTreeSha } from "./gitHash";
import { GitHubClient, type BackupError } from "./githubClient";
import { serializeWorkspace } from "./serialize";

export type BackupDeps = {
  store: SqlStore;
  assets: AssetStore;
  client: GitHubClient;
  clock: Clock;
  workspace: { id: string; name: string };
  branch?: string;
};
export type BackupOptions = {
  /** Qué hacer si la rama cambió por fuera desde el último respaldo (CL-18). Por defecto: preguntar. */
  onExternalChange?: "ask" | "continue";
  signal?: AbortSignal;
  maxAssetBytes?: number;
};
export type Skipped = { hash: string; size: number }[];
export type BackupOutcome =
  | { status: "success"; commit: string; uploaded: number; removed: number; pagesChanged: number; skipped: Skipped }
  | { status: "unchanged"; skipped: Skipped }
  | { status: "needs_decision"; remoteHead: string | null; lastKnown: string | null }
  | { status: "cancelled" }
  | { status: "failed"; error: BackupError };

const pad = (n: number) => String(n).padStart(2, "0");

/** «Respaldo automático 2026-10-30 14:00 · 3 páginas modificadas» (fecha en UTC, determinista). */
export function commitMessage(ms: number, pages: number): string {
  const d = new Date(ms);
  const when = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
  const what = pages === 0 ? "sin páginas modificadas" : pages === 1 ? "1 página modificada" : `${pages} páginas modificadas`;
  return `Respaldo automático ${when} · ${what}`;
}

const getMeta = async (s: SqlStore, key: string) => (await s.query<{ value: string }>("SELECT value FROM meta WHERE key = ?", [key]))[0]?.value ?? null;
const setMeta = (s: SqlStore, key: string, value: string) => s.exec("INSERT OR REPLACE INTO meta(key, value) VALUES (?, ?)", [key, value]);

/**
 * Ejecuta un respaldo completo (RF-15, RF-16). Solo LEE los datos del espacio; lo único que escribe es el historial de respaldos.
 * La rama avanza al final y sin forzar: ante cualquier fallo no queda a medias y se puede repetir.
 */
export async function runBackup(deps: BackupDeps, opts: BackupOptions = {}): Promise<BackupOutcome> {
  const startedAt = deps.clock.now();
  const outcome = await execute(deps, opts);
  await recordBackupRun(deps, startedAt, outcome);
  return outcome;
}

async function execute(deps: BackupDeps, opts: BackupOptions): Promise<BackupOutcome> {
  const { store, assets, client, clock } = deps;
  const branch = deps.branch ?? "main";

  const snap = await snapshotWorkspace(deps, opts);
  if ("status" in snap) return snap;
  const outcome = await publishSnapshot(
    { files: snap.files, skipped: snap.skipped, lastKnown: await getMeta(store, "backup_last_commit"), nowMs: clock.now(), branch },
    client,
    opts,
  );
  await finalizeBackup(store, clock, outcome);
  return outcome;
}

/** Lee el espacio y lo serializa. Es lo único que toca la base y los adjuntos (por eso corre en el hilo que los posee). */
export async function snapshotWorkspace(
  deps: Pick<BackupDeps, "store" | "assets" | "workspace">,
  opts: Pick<BackupOptions, "maxAssetBytes">,
): Promise<Snapshot | BackupOutcome> {
  try {
    const s = await serializeWorkspace(deps, deps.workspace, opts.maxAssetBytes === undefined ? {} : { maxAssetBytes: opts.maxAssetBytes });
    return { files: s.files, skipped: s.skipped };
  } catch (e) {
    return { status: "failed", error: { kind: "UNKNOWN", message: `No se pudo preparar el respaldo: ${e instanceof Error ? e.message : String(e)}`, retryable: false } };
  }
}

/** Tras un éxito, recuerda el último commit y la hora (lo demás no cambia). */
export async function finalizeBackup(store: SqlStore, clock: Clock, outcome: BackupOutcome): Promise<void> {
  if (outcome.status !== "success") return;
  await setMeta(store, "backup_last_commit", outcome.commit);
  await setMeta(store, "last_backup_at", String(clock.now()));
}

export type Snapshot = { files: Map<string, Uint8Array>; skipped: Skipped };
export type PublishInput = Snapshot & { lastKnown: string | null; nowMs: number; branch: string };

/**
 * Compara huellas, sube lo distinto y avanza la rama sin forzar. No usa la base de datos: solo recibe la instantánea y habla con GitHub,
 * así puede correr en un worker (RNF-12). La rama avanza al final: ante cualquier fallo no queda a medias y se puede repetir.
 */
export async function publishSnapshot(input: PublishInput, client: GitHubClient, opts: Pick<BackupOptions, "onExternalChange" | "signal">): Promise<BackupOutcome> {
  const branch = input.branch;
  const aborted = () => opts.signal?.aborted === true;
  const fail = (error: BackupError): BackupOutcome => ({ status: "failed", error });
  const { skipped } = input;

  const local = new Map<string, string>();
  for (const [path, bytes] of input.files) local.set(path, await gitBlobSha(bytes));
  const localTree = await gitTreeSha(local);
  if (aborted()) return { status: "cancelled" };

  const head = await client.getHead(branch);
  if (!head.ok) return fail(head.error);

  let remote = new Map<string, string>();
  let baseTree: string | undefined;
  if (head.value) {
    const commit = await client.getCommit(head.value);
    if (!commit.ok) return fail(commit.error);
    baseTree = commit.value.treeSha;
    const tree = await client.listTree(baseTree);
    if (!tree.ok) return fail(tree.error);
    remote = tree.value;

    const lastKnown = input.lastKnown;
    const external = lastKnown === null ? remote.size > 0 : head.value !== lastKnown;
    if (external && opts.onExternalChange !== "continue") return { status: "needs_decision", remoteHead: head.value, lastKnown };
    if (baseTree === localTree) return { status: "unchanged", skipped };
  }

  const entries: { path: string; sha: string | null }[] = [];
  const toUpload = new Map<string, Uint8Array>(); // huella -> contenido (una sola vez por contenido)
  const changedPaths: string[] = [];
  for (const [path, sha] of local) {
    if (remote.get(path) === sha) continue;
    changedPaths.push(path);
    entries.push({ path, sha });
    if (!toUpload.has(sha)) toUpload.set(sha, input.files.get(path)!);
  }
  let removed = 0;
  for (const path of remote.keys()) if (!local.has(path)) { entries.push({ path, sha: null }); changedPaths.push(path); removed++; }

  for (const [sha, bytes] of toUpload) {
    if (aborted()) return { status: "cancelled" };
    const blob = await client.createBlob(bytes);
    if (!blob.ok) return fail(blob.error);
    if (blob.value !== sha) return fail({ kind: "INVALID", message: "GitHub devolvió una huella distinta a la esperada", retryable: false });
  }
  if (aborted()) return { status: "cancelled" };

  const tree = await client.createTree(entries, baseTree);
  if (!tree.ok) return fail(tree.error);
  const pagesChanged = new Set(changedPaths.filter((p) => p.startsWith("data/")).map((p) => p)).size;
  const commit = await client.createCommit({ message: commitMessage(input.nowMs, pagesChanged), tree: tree.value, parents: head.value ? [head.value] : [] });
  if (!commit.ok) return fail(commit.error);
  if (aborted()) return { status: "cancelled" };

  const moved = head.value ? await client.updateRef(branch, commit.value) : await client.createRef(branch, commit.value);
  if (!moved.ok) {
    // Alguien movió la rama justo ahora: se trata como cambio externo (nada se pierde).
    if (moved.error.kind === "REF_CONFLICT" || (moved.error.kind === "INVALID" && moved.error.status === 422)) {
      return { status: "needs_decision", remoteHead: head.value, lastKnown: input.lastKnown };
    }
    return fail(moved.error);
  }

  return { status: "success", commit: commit.value, uploaded: toUpload.size, removed, pagesChanged, skipped };
}

export async function recordBackupRun(deps: Pick<BackupDeps, "store" | "clock">, startedAt: number, o: BackupOutcome): Promise<void> {
  const err = o.status === "failed" ? o.error : null;
  await deps.store.exec(
    "INSERT INTO backup_runs(started_at, finished_at, status, commit_sha, files_uploaded, files_removed, error_kind, error_message, skipped_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [
      startedAt, deps.clock.now(), o.status,
      o.status === "success" ? o.commit : null,
      o.status === "success" ? o.uploaded : null,
      o.status === "success" ? o.removed : null,
      err?.kind ?? null, err?.message ?? null,
      o.status === "success" || o.status === "unchanged" ? JSON.stringify(o.skipped) : null,
    ],
  );
}
