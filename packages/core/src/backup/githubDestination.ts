import { err, ok } from "../result";
import {
  MANIFEST_PATH,
  type BackupDestination,
  type DestinationInfo,
  type DestResult,
  type FileChange,
  type RemoteManifest,
  type SyncReceipt,
} from "./destination";
import { GitHubClient, type BackupError, type FetchLike } from "./githubClient";

const enc = new TextEncoder();
const dec = new TextDecoder();

/**
 * Destino en un repositorio de GitHub: cada sincronización es UN commit que solo toca los archivos cambiados
 * (sin forzar la rama), así el historial sirve de versiones y no se crean copias duplicadas.
 */
export class GitHubDestination implements BackupDestination {
  readonly kind = "github" as const;
  private client: GitHubClient;
  private branch: string | null;
  private readonly label: string;

  constructor(d: { fetch: FetchLike; token: string; owner: string; repo: string; branch?: string; baseUrl?: string }) {
    this.client = new GitHubClient({ fetch: d.fetch, token: d.token, owner: d.owner, repo: d.repo, ...(d.baseUrl ? { baseUrl: d.baseUrl } : {}) });
    this.branch = d.branch ?? null;
    this.label = `${d.owner}/${d.repo}`;
  }

  private async resolveBranch(): Promise<DestResult<string>> {
    if (this.branch) return ok(this.branch);
    const info = await this.client.checkRepo();
    if (!info.ok) return info;
    this.branch = info.value.defaultBranch;
    return ok(this.branch);
  }

  async checkConnection(): Promise<DestResult<DestinationInfo>> {
    const info = await this.client.checkRepo();
    if (!info.ok) return info;
    if (!info.value.canPush) return err({ kind: "NO_PERMISSION", message: "El token no puede escribir en el repositorio", retryable: false });
    return ok({ kind: "github", label: this.label, writable: true });
  }

  /** Lee el árbol de la cabeza y devuelve {ruta → blob} (o null si el repositorio está vacío). */
  private async headFiles(branch: string): Promise<DestResult<{ head: string; tree: Map<string, string> } | null>> {
    const head = await this.client.getHead(branch);
    if (!head.ok) return head;
    if (!head.value) return ok(null);
    const commit = await this.client.getCommit(head.value);
    if (!commit.ok) return commit;
    const tree = await this.client.listTree(commit.value.treeSha);
    if (!tree.ok) return tree;
    return ok({ head: head.value, tree: tree.value });
  }

  async readManifest(): Promise<DestResult<RemoteManifest | null>> {
    const b = await this.resolveBranch();
    if (!b.ok) return b;
    const files = await this.headFiles(b.value);
    if (!files.ok) return files;
    const sha = files.value?.tree.get(MANIFEST_PATH);
    if (!sha) return ok(null);
    const blob = await this.client.getBlob(sha);
    if (!blob.ok) return blob;
    try {
      return ok(JSON.parse(dec.decode(blob.value)) as RemoteManifest);
    } catch (e) {
      return err({ kind: "INVALID", message: e instanceof Error ? e.message : "Manifiesto ilegible", retryable: false });
    }
  }

  async applyChanges(
    ops: { put: FileChange[]; remove: string[]; nextManifest: RemoteManifest },
    opts?: { signal?: AbortSignal },
  ): Promise<DestResult<SyncReceipt>> {
    const b = await this.resolveBranch();
    if (!b.ok) return b;
    const current = await this.headFiles(b.value);
    if (!current.ok) return current;

    const entries: { path: string; sha: string | null }[] = [];
    let uploaded = 0;
    let updated = 0;
    const all: FileChange[] = [
      ...ops.put,
      { path: MANIFEST_PATH, bytes: enc.encode(JSON.stringify(ops.nextManifest)), sha256: "", size: 0 },
    ];
    for (const f of all) {
      if (opts?.signal?.aborted) return err({ kind: "UNKNOWN", message: "Cancelado", retryable: false });
      const blob = await this.client.createBlob(f.bytes);
      if (!blob.ok) return blob;
      entries.push({ path: f.path, sha: blob.value });
      if (f.path !== MANIFEST_PATH) (current.value?.tree.has(f.path) ? updated++ : uploaded++);
    }
    for (const p of ops.remove) entries.push({ path: p, sha: null });

    const parentTree = current.value ? (await this.client.getCommit(current.value.head)) : null;
    if (parentTree && !parentTree.ok) return parentTree;
    const tree = await this.client.createTree(entries, parentTree?.ok ? parentTree.value.treeSha : undefined);
    if (!tree.ok) return tree;
    const commit = await this.client.createCommit({
      message: `Respaldo ${new Date(ops.nextManifest.updatedAt).toISOString()}`,
      tree: tree.value,
      parents: current.value ? [current.value.head] : [],
    });
    if (!commit.ok) return commit;
    const moved: DestResult<undefined> = current.value
      ? await this.client.updateRef(b.value, commit.value)
      : await this.client.createRef(b.value, commit.value);
    // La rama se movió por fuera entre leer y avanzar (sin force): no se pierde nada; el próximo intento relee la cabeza.
    if (!moved.ok) return moved.error.kind === "REF_CONFLICT" ? err({ ...moved.error, retryable: true }) : moved;
    return ok({ manifest: ops.nextManifest, uploaded, updated, removed: ops.remove.length });
  }

  async downloadAll(): Promise<DestResult<Map<string, Uint8Array>>> {
    const b = await this.resolveBranch();
    if (!b.ok) return b;
    const files = await this.headFiles(b.value);
    if (!files.ok) return files;
    const out = new Map<string, Uint8Array>();
    for (const [path, sha] of files.value?.tree ?? []) {
      if (path === MANIFEST_PATH) continue;
      const blob = await this.client.getBlob(sha);
      if (!blob.ok) return blob;
      out.set(path, blob.value);
    }
    return ok(out);
  }
}

export type { BackupError };
