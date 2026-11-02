import { err, ok, type Result } from "../result";

export const MAX_BLOB_BYTES = 100 * 1024 * 1024;

/** Lo mínimo de `fetch` que usa el cliente (se inyecta: el navegador, Tauri o el servidor falso de las pruebas). */
export type FetchLike = (url: string, init?: { method?: string; headers?: Record<string, string>; body?: string }) => Promise<{
  status: number;
  headers: { get(name: string): string | null };
  json(): Promise<any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  text(): Promise<string>;
}>;

export type BackupErrorKind =
  | "OFFLINE" | "AUTH" | "RATE_LIMIT" | "REPO_FULL" | "NO_PERMISSION" | "REPO_NOT_FOUND"
  | "REF_CONFLICT" | "INVALID" | "SERVER" | "UNKNOWN" | "TOO_LARGE" | "TREE_TRUNCATED";

export type BackupError = { kind: BackupErrorKind; message: string; status?: number; retryable: boolean; retryAt?: number };

/** Quita el token y cualquier cadena con forma de token de GitHub de un texto (RNF-6). */
export function redactToken(text: string, token: string): string {
  let out = text;
  if (token) out = out.split(token).join("***");
  return out
    .replace(/github_pat_[A-Za-z0-9_]{20,}/g, "***")
    .replace(/\bgh[pousr]_[A-Za-z0-9]{20,}/g, "***");
}

/** Clasifica una respuesta HTTP fallida según la tabla 6.4 del plan. `status` 0 = sin red. */
export function classifyHttpError(status: number, headers: { get(n: string): string | null }, message: string): Pick<BackupError, "kind" | "retryable" | "retryAt"> {
  if (status === 0) return { kind: "OFFLINE", retryable: true };
  if (status === 401) return { kind: "AUTH", retryable: false };
  if (status === 403) {
    if (headers.get("x-ratelimit-remaining") === "0" || /rate limit|abuse/i.test(message)) {
      const reset = Number(headers.get("x-ratelimit-reset"));
      const retryAfter = Number(headers.get("retry-after"));
      return { kind: "RATE_LIMIT", retryable: true, ...(reset ? { retryAt: reset * 1000 } : retryAfter ? { retryAt: Date.now() + retryAfter * 1000 } : {}) };
    }
    if (/data quota|repository size|too large|storage limit/i.test(message)) return { kind: "REPO_FULL", retryable: false };
    return { kind: "NO_PERMISSION", retryable: false };
  }
  if (status === 404) return { kind: "REPO_NOT_FOUND", retryable: false };
  if (status === 422) return /fast forward/i.test(message) ? { kind: "REF_CONFLICT", retryable: false } : { kind: "INVALID", retryable: false };
  if (status >= 500) return { kind: "SERVER", retryable: true };
  return { kind: "UNKNOWN", retryable: true };
}

const toBase64 = (b: Uint8Array) => {
  let s = "";
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(s);
};

export type TreeEntry = { path: string; sha: string | null };
export type RepoInfo = { isPrivate: boolean; defaultBranch: string; canPush: boolean };
export type CommitInfo = { treeSha: string; parents: string[]; message: string };
export type CommitSummary = { sha: string; message: string; date: string };

/** Cliente mínimo de la API Git de GitHub (blobs, árboles, commits, referencias). El token nunca sale en errores ni registros. */
export class GitHubClient {
  private base: string;
  private token: string;
  constructor(private o: { fetch: FetchLike; token: string; owner: string; repo: string; baseUrl?: string; log?: (m: string) => void }) {
    this.base = o.baseUrl ?? "https://api.github.com";
    this.token = o.token;
  }

  private clean = (s: string) => redactToken(s, this.token);

  private async request<T>(method: string, path: string, body?: unknown, map?: (json: any, status: number) => T): Promise<Result<T, BackupError>> { // eslint-disable-line @typescript-eslint/no-explicit-any
    const repoPath = `/repos/${this.o.owner}/${this.o.repo}${path}`;
    let res;
    try {
      res = await this.o.fetch(`${this.base}${repoPath}`, {
        method,
        headers: { authorization: `Bearer ${this.token}`, accept: "application/vnd.github+json", "x-github-api-version": "2022-11-28", "content-type": "application/json" },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    } catch (e) {
      const message = this.clean(e instanceof Error ? e.message : String(e));
      this.o.log?.(`${method} ${repoPath} -> sin conexión: ${message}`);
      return err({ kind: "OFFLINE", message, retryable: true });
    }
    this.o.log?.(`${method} ${repoPath} -> ${res.status}`);
    let json: any = null; // eslint-disable-line @typescript-eslint/no-explicit-any
    try { json = await res.json(); } catch { /* cuerpo vacío */ }
    if (res.status >= 200 && res.status < 300) return ok(map ? map(json, res.status) : (json as T));
    const message = this.clean(String(json?.message ?? `HTTP ${res.status}`));
    return err({ ...classifyHttpError(res.status, res.headers, message), message, status: res.status });
  }

  checkRepo() {
    return this.request("GET", "", undefined, (j): RepoInfo => ({ isPrivate: Boolean(j.private), defaultBranch: String(j.default_branch ?? "main"), canPush: Boolean(j.permissions?.push) }));
  }

  /** Cabeza de la rama, o null si la rama o el repositorio (vacío) todavía no existen. */
  async getHead(branch: string): Promise<Result<string | null, BackupError>> {
    const r = await this.request<string | null>("GET", `/git/ref/heads/${encodeURIComponent(branch)}`, undefined, (j) => String(j.object.sha));
    if (!r.ok && (r.error.status === 404 || r.error.status === 409)) return ok(null);
    return r;
  }

  getCommit(sha: string) {
    return this.request("GET", `/git/commits/${sha}`, undefined, (j): CommitInfo => ({ treeSha: String(j.tree.sha), parents: (j.parents ?? []).map((p: { sha: string }) => p.sha), message: String(j.message ?? "") }));
  }

  /** Contenido completo del árbol como {ruta → huella de blob}. Si GitHub lo trunca no se puede comparar con seguridad. */
  async listTree(treeSha: string): Promise<Result<Map<string, string>, BackupError>> {
    const r = await this.request<{ truncated: boolean; tree: { path: string; type: string; sha: string }[] }>("GET", `/git/trees/${treeSha}?recursive=1`);
    if (!r.ok) return r;
    if (r.value.truncated) return err({ kind: "TREE_TRUNCATED", message: "El repositorio es demasiado grande para listarse completo", retryable: false });
    return ok(new Map(r.value.tree.filter((e) => e.type === "blob").map((e) => [e.path, e.sha])));
  }

  async createBlob(data: Uint8Array): Promise<Result<string, BackupError>> {
    if (data.length > MAX_BLOB_BYTES) return err({ kind: "TOO_LARGE", message: "El archivo supera el límite de 100 MB de GitHub", retryable: false });
    return this.request("POST", "/git/blobs", { content: toBase64(data), encoding: "base64" }, (j) => String(j.sha));
  }

  /** Contenido de un blob (para restaurar). */
  getBlob(sha: string) {
    return this.request("GET", `/git/blobs/${sha}`, undefined, (j): Uint8Array => Uint8Array.from(atob(String(j.content).replace(/\n/g, "")), (c) => c.charCodeAt(0)));
  }

  createTree(entries: TreeEntry[], baseTree?: string) {
    return this.request("POST", "/git/trees", {
      ...(baseTree ? { base_tree: baseTree } : {}),
      tree: entries.map((e) => ({ path: e.path, mode: "100644", type: "blob", sha: e.sha })),
    }, (j) => String(j.sha));
  }

  createCommit(c: { message: string; tree: string; parents: string[] }) {
    return this.request("POST", "/git/commits", c, (j) => String(j.sha));
  }

  createRef(branch: string, sha: string) {
    return this.request("POST", "/git/refs", { ref: `refs/heads/${branch}`, sha }, () => undefined);
  }

  /** Avanza la rama SIN forzar: si alguien la movió por fuera, falla con REF_CONFLICT y no se pierde nada. */
  updateRef(branch: string, sha: string) {
    return this.request("PATCH", `/git/refs/heads/${encodeURIComponent(branch)}`, { sha, force: false }, () => undefined);
  }

  listCommits(branch: string, perPage = 30) {
    return this.request("GET", `/commits?sha=${encodeURIComponent(branch)}&per_page=${perPage}`, undefined, (j): CommitSummary[] =>
      (j as { sha: string; commit: { message: string; committer: { date: string } } }[]).map((c) => ({ sha: c.sha, message: c.commit.message, date: c.commit.committer.date })),
    );
  }
}
