import { appError, err, ok, type Result } from "../result";
import type { AssetStore } from "../assets/assetStore";
import type { Workspace, WorkspaceManager } from "../workspaces/workspaceManager";
import { GitHubClient, type CommitSummary, type FetchLike } from "./githubClient";
import { listBackups, readBackup, restoreFromFiles, validateBackup } from "./restore";

const dec = new TextDecoder();
const backupName = (files: Map<string, Uint8Array>): string => {
  try { return String(JSON.parse(dec.decode(files.get("workspace.json"))).name || "Respaldo"); } catch { return "Respaldo"; }
};

type AssetsFor = (location: string) => AssetStore;

/** Crea un espacio nuevo con el contenido del respaldo. Si algo falla, no queda ningún espacio a medias. */
export async function restoreAsNewWorkspace(
  mgr: WorkspaceManager, assetsFor: AssetsFor, files: Map<string, Uint8Array>, opts: { name?: string } = {},
): Promise<Result<{ workspace: Workspace; pages: number }>> {
  const valid = await validateBackup(files);
  if (!valid.ok) return valid; // se valida TODO antes de crear nada
  const name = (opts.name ?? `${backupName(files)} (restaurado)`).trim();
  const created = await mgr.create({ name });
  if (!created.ok) return created;
  const opened = await mgr.open(created.value.id);
  if (!opened.ok) { await mgr.delete(created.value.id, { typedName: name }); return opened; }
  const restored = await restoreFromFiles(files, { store: opened.value.store, assets: assetsFor(created.value.location) });
  if (!restored.ok) {
    await mgr.delete(created.value.id, { typedName: created.value.name });
    return restored;
  }
  return ok({ workspace: created.value, pages: restored.value.pages });
}

export type ReplacementInfo = { workspaceName: string; currentPages: number; backupPages: number; lastBackupAt: number | null; hasNoBackup: boolean };

/** Lo que se sustituiría al reemplazar un espacio, para mostrarlo antes de pedir confirmación (RF-17). */
export async function describeReplacement(mgr: WorkspaceManager, workspaceId: string, files: Map<string, Uint8Array>): Promise<Result<ReplacementInfo>> {
  const opened = await mgr.open(workspaceId);
  if (!opened.ok) return opened;
  const prep = await mgr.prepareDelete(workspaceId);
  if (!prep.ok) return prep;
  const n = (await opened.value.store.query<{ n: number }>("SELECT count(*) AS n FROM pages"))[0]?.n ?? 0;
  let backupPages = 0;
  try { backupPages = Number(JSON.parse(dec.decode(files.get("workspace.json"))).pageCount) || 0; } catch { /* se validará al restaurar */ }
  return ok({ workspaceName: opened.value.workspace.name, currentPages: n, backupPages, lastBackupAt: prep.value.lastBackupAt, hasNoBackup: prep.value.hasNoBackup });
}

/**
 * Reemplaza un espacio por el contenido de un respaldo. El contenido nuevo se construye APARTE y solo al final se intercambia:
 * si algo falla o se cancela, el espacio original queda intacto (constitución, art. 5).
 */
export async function replaceWorkspace(
  mgr: WorkspaceManager, oldId: string, assetsFor: AssetsFor, files: Map<string, Uint8Array>, opts: { confirmName: string },
): Promise<Result<{ workspace: Workspace }>> {
  const list = await mgr.list();
  if (!list.ok) return list;
  const old = list.value.find((w) => w.id === oldId);
  if (!old) return err(appError("NOT_FOUND", "El espacio de trabajo no existe", { id: oldId }));
  if (opts.confirmName !== old.name) return err(appError("NEEDS_CONFIRMATION", "Debes escribir el nombre exacto del espacio para reemplazarlo", { id: oldId }));

  const staged = await restoreAsNewWorkspace(mgr, assetsFor, files, { name: `${old.name} (restaurando)` });
  if (!staged.ok) return staged;
  const deleted = await mgr.delete(old.id, { typedName: old.name });
  if (!deleted.ok) {
    await mgr.delete(staged.value.workspace.id, { typedName: staged.value.workspace.name });
    return deleted;
  }
  const renamed = await mgr.rename(staged.value.workspace.id, old.name);
  if (!renamed.ok) return renamed;
  if (old.isCaptureDefault) await mgr.setCaptureDefault(renamed.value.id);
  return ok({ workspace: { ...renamed.value, isCaptureDefault: old.isCaptureDefault } });
}

const NAME = /^[A-Za-z0-9_.-]+$/;

/** Origen de restauración sin ningún espacio abierto (primer inicio en un equipo nuevo). El token vive solo en memoria. */
export class RestoreSource {
  private client: GitHubClient | null = null;
  private branch = "main";
  constructor(private d: { fetch: FetchLike; log?: (m: string) => void }) {}

  async connect(i: { token: string; owner: string; repo: string; confirmPublic?: boolean }): Promise<Result<{ isPrivate: boolean }>> {
    const token = i.token.trim(), owner = i.owner.trim(), repo = i.repo.trim();
    if (!token || /\s/.test(token)) return err(appError("INVALID", "El token no puede estar vacío ni contener espacios"));
    if (!NAME.test(owner) || !NAME.test(repo)) return err(appError("INVALID", "El propietario o el repositorio no son válidos"));
    const client = new GitHubClient({ fetch: this.d.fetch, token, owner, repo, ...(this.d.log ? { log: this.d.log } : {}) });
    const check = await client.checkRepo();
    if (!check.ok) return err(appError("INVALID", check.error.message, { kind: check.error.kind }));
    if (!check.value.isPrivate && !i.confirmPublic) return err(appError("NEEDS_CONFIRMATION", "El repositorio es público", { reason: "PUBLIC_REPO" }));
    this.client = client;
    this.branch = check.value.defaultBranch;
    return ok({ isPrivate: check.value.isPrivate });
  }

  private need(): Result<GitHubClient> {
    return this.client ? ok(this.client) : err(appError("INVALID", "Primero conecta con GitHub"));
  }

  async listPoints(): Promise<Result<CommitSummary[]>> {
    const c = this.need();
    return c.ok ? listBackups(c.value, this.branch) : c;
  }

  async read(sha: string): Promise<Result<Map<string, Uint8Array>>> {
    const c = this.need();
    return c.ok ? readBackup(c.value, sha) : c;
  }

  /** Olvida las credenciales de memoria. */
  forget(): void { this.client = null; }
}
