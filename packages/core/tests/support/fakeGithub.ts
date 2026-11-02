// Servidor GitHub FALSO en memoria (API Git de bajo nivel) con inyección de errores, para probar el respaldo sin red (plan sección 9).
import { gitBlobSha, gitTreeSha } from "../../src/backup/gitHash";
import type { FetchLike } from "../../src/backup/githubClient";

type Flat = Map<string, string>; // ruta -> huella de blob
type Injection = { match: RegExp; status: number; body: unknown; headers?: Record<string, string>; times: number };
const enc = new TextEncoder();

export class FakeGithub {
  isPrivate = true;
  canPush = true;
  defaultBranch = "main";
  maxRepoBytes = Infinity;
  offline = false;
  token = "ghp_TESTTOKEN0123456789abcdefghijklmnop";
  blobs = new Map<string, Uint8Array>();
  trees = new Map<string, Flat>();
  commits = new Map<string, { tree: string; parents: string[]; message: string; date: string }>();
  refs = new Map<string, string>();
  requests: { method: string; url: string; headers: Record<string, string>; body?: unknown }[] = [];
  private injections: Injection[] = [];
  private seq = 0;
  private repoBytes = 0;

  inject(i: Omit<Injection, "times"> & { times?: number }) { this.injections.push({ times: 1, ...i }); }
  clearInjections() { this.injections.length = 0; }
  headSha(branch = "main") { return this.refs.get(branch) ?? null; }
  /** Simula que alguien más empujó un commit a la rama por fuera. */
  async externalCommit(files: Record<string, string>, branch = "main", message = "cambio externo") {
    const flat: Flat = new Map(this.refs.has(branch) ? this.trees.get(this.commits.get(this.refs.get(branch)!)!.tree)! : []);
    for (const [p, c] of Object.entries(files)) { const b = enc.encode(c); const sha = await gitBlobSha(b); this.blobs.set(sha, b); flat.set(p, sha); }
    const treeSha = await gitTreeSha(flat);
    this.trees.set(treeSha, flat);
    const sha = await gitBlobSha(enc.encode(`commit ${++this.seq} ${treeSha} ${message}`));
    this.commits.set(sha, { tree: treeSha, parents: this.refs.has(branch) ? [this.refs.get(branch)!] : [], message, date: new Date(2026, 0, this.seq).toISOString() });
    this.refs.set(branch, sha);
    return sha;
  }

  fetch: FetchLike = async (url, init = {}) => {
    const method = init.method ?? "GET";
    const headers = Object.fromEntries(Object.entries(init.headers ?? {}).map(([k, v]) => [k.toLowerCase(), String(v)]));
    const body = typeof init.body === "string" ? JSON.parse(init.body) : undefined;
    this.requests.push({ method, url, headers, body });
    if (this.offline) throw new TypeError("Failed to fetch");
    const path = new URL(url).pathname;
    const key = `${method} ${path}`;
    const inj = this.injections.find((i) => i.times > 0 && i.match.test(key));
    if (inj) { inj.times--; return this.res(inj.status, inj.body, inj.headers); }
    if (headers.authorization !== `Bearer ${this.token}`) return this.res(401, { message: `Bad credentials (${headers.authorization ?? ""})` });

    const m = path.match(/^\/repos\/([^/]+)\/([^/]+)(\/.*)?$/);
    if (!m) return this.res(404, { message: "Not Found" });
    const rest = m[3] ?? "";
    if (rest === "" && method === "GET") return this.res(200, { private: this.isPrivate, default_branch: this.defaultBranch, permissions: { push: this.canPush } });
    if (!this.canPush && method !== "GET") return this.res(403, { message: "Resource not accessible by personal access token" });

    let r: RegExpMatchArray | null;
    if ((r = rest.match(/^\/git\/ref\/heads\/(.+)$/)) && method === "GET") {
      const sha = this.refs.get(decodeURIComponent(r[1]!));
      if (sha) return this.res(200, { object: { sha } });
      return this.refs.size === 0 && this.commits.size === 0 ? this.res(409, { message: "Git Repository is empty." }) : this.res(404, { message: "Not Found" });
    }
    if ((r = rest.match(/^\/git\/commits\/([0-9a-f]+)$/)) && method === "GET") {
      const c = this.commits.get(r[1]!);
      return c ? this.res(200, { sha: r[1], tree: { sha: c.tree }, parents: c.parents.map((sha) => ({ sha })), message: c.message }) : this.res(404, { message: "Not Found" });
    }
    if ((r = rest.match(/^\/git\/trees\/([0-9a-f]+)$/)) && method === "GET") {
      const t = this.trees.get(r[1]!);
      return t ? this.res(200, { sha: r[1], truncated: false, tree: [...t].map(([p, sha]) => ({ path: p, mode: "100644", type: "blob", sha })) }) : this.res(404, { message: "Not Found" });
    }
    if ((r = rest.match(/^\/git\/blobs\/([0-9a-f]+)$/)) && method === "GET") {
      const b = this.blobs.get(r[1]!);
      return b ? this.res(200, { sha: r[1], encoding: "base64", content: btoa(String.fromCharCode(...b)) }) : this.res(404, { message: "Not Found" });
    }
    if (rest === "/git/blobs" && method === "POST") {
      const bytes = Uint8Array.from(atob(body.content), (c) => c.charCodeAt(0));
      if (this.repoBytes + bytes.length > this.maxRepoBytes) return this.res(403, { message: "This repository is over its data quota. Account billing is required." });
      const sha = await gitBlobSha(bytes);
      if (!this.blobs.has(sha)) { this.blobs.set(sha, bytes); this.repoBytes += bytes.length; }
      return this.res(201, { sha });
    }
    if (rest === "/git/trees" && method === "POST") {
      const flat: Flat = new Map(body.base_tree ? this.trees.get(body.base_tree) ?? [] : []);
      for (const e of body.tree) {
        if (e.sha === null) flat.delete(e.path);
        else if (!this.blobs.has(e.sha)) return this.res(422, { message: `GitRPC::BadObjectState: ${e.sha}` });
        else flat.set(e.path, e.sha);
      }
      const sha = await gitTreeSha(flat);
      this.trees.set(sha, flat);
      return this.res(201, { sha });
    }
    if (rest === "/git/commits" && method === "POST") {
      if (!this.trees.has(body.tree)) return this.res(422, { message: "Tree SHA does not exist" });
      const sha = await gitBlobSha(enc.encode(`commit ${++this.seq} ${body.tree} ${body.parents.join(",")} ${body.message}`));
      this.commits.set(sha, { tree: body.tree, parents: body.parents, message: body.message, date: new Date(2026, 0, this.seq).toISOString() });
      return this.res(201, { sha });
    }
    if (rest === "/git/refs" && method === "POST") {
      const branch = String(body.ref).replace("refs/heads/", "");
      if (this.refs.has(branch)) return this.res(422, { message: "Reference already exists" });
      this.refs.set(branch, body.sha);
      return this.res(201, { ref: body.ref, object: { sha: body.sha } });
    }
    if ((r = rest.match(/^\/git\/refs\/heads\/(.+)$/)) && method === "PATCH") {
      const branch = decodeURIComponent(r[1]!);
      const cur = this.refs.get(branch);
      if (!cur) return this.res(404, { message: "Reference does not exist" });
      if (!body.force && !this.isAncestor(cur, body.sha)) return this.res(422, { message: "Update is not a fast forward" });
      this.refs.set(branch, body.sha);
      return this.res(200, { ref: `refs/heads/${branch}`, object: { sha: body.sha } });
    }
    if (rest === "/commits" && method === "GET") {
      const start = this.refs.get(new URL(url).searchParams.get("sha") ?? this.defaultBranch);
      const list: unknown[] = [];
      for (let sha = start; sha && list.length < 100; sha = this.commits.get(sha)?.parents[0]) {
        const c = this.commits.get(sha)!;
        list.push({ sha, commit: { message: c.message, committer: { date: c.date } } });
      }
      return this.res(200, list);
    }
    return this.res(404, { message: "Not Found" });
  };

  private isAncestor(ancestor: string, descendant: string): boolean {
    for (let sha: string | undefined = descendant; sha; sha = this.commits.get(sha)?.parents[0]) if (sha === ancestor) return true;
    return false;
  }
  private res(status: number, body: unknown, headers: Record<string, string> = {}) {
    const h = new Map(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
    return { status, headers: { get: (n: string) => h.get(n.toLowerCase()) ?? null }, json: async () => body, text: async () => JSON.stringify(body) };
  }
}
