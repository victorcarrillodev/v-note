// T-178 a T-186 (prueba primero): cliente de la API Git de GitHub contra un servidor falso.
import { describe, it, expect, beforeEach } from "vitest";
import { FakeGithub } from "../../tests/support/fakeGithub";
import { GitHubClient, MAX_BLOB_BYTES, classifyHttpError, redactToken } from "./githubClient";
import { gitBlobSha } from "./gitHash";

let gh: FakeGithub;
let client: GitHubClient;
const logs: string[] = [];
beforeEach(() => {
  gh = new FakeGithub();
  logs.length = 0;
  client = new GitHubClient({ fetch: gh.fetch, token: gh.token, owner: "yo", repo: "respaldo", log: (m) => logs.push(m) });
});
const enc = new TextEncoder();
const must = <T>(r: { ok: boolean; value?: T; error?: unknown }): T => { if (!r.ok) throw new Error(JSON.stringify(r.error)); return r.value as T; };

describe("servidor falso y commit completo (T-178)", () => {
  it("el cliente crea blobs, árbol, commit y la rama en un repositorio vacío", async () => {
    const a = must(await client.createBlob(enc.encode("hola\n")));
    const b = must(await client.createBlob(enc.encode("mundo\n")));
    expect(a).toBe(await gitBlobSha(enc.encode("hola\n")));
    const tree = must(await client.createTree([{ path: "a.txt", sha: a }, { path: "dir/b.txt", sha: b }]));
    const commit = must(await client.createCommit({ message: "primero", tree, parents: [] }));
    must(await client.createRef("main", commit));
    expect(gh.headSha()).toBe(commit);
    expect(must(await client.listTree(tree))).toEqual(new Map([["a.txt", a], ["dir/b.txt", b]]));
  });
});

describe("errores configurables (T-179)", () => {
  it.each([[401], [403], [404], [422], [500]])("se puede provocar un %i", async (status) => {
    gh.inject({ match: /GET \/repos\/yo\/respaldo$/, status, body: { message: "boom" } });
    const r = await client.checkRepo();
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.error.status).toBe(status);
  });
  it("límite de uso: 403 con cabeceras de rate limit", async () => {
    gh.inject({ match: /GET \/repos\/yo\/respaldo$/, status: 403, body: { message: "API rate limit exceeded" }, headers: { "x-ratelimit-remaining": "0", "x-ratelimit-reset": "1893456000" } });
    const r = await client.checkRepo();
    expect(r.ok === false && r.error.kind).toBe("RATE_LIMIT");
  });
  it("repositorio lleno: se puede simular la cuota de datos", async () => {
    gh.maxRepoBytes = 10;
    const r = await client.createBlob(new Uint8Array(100));
    expect(r.ok === false && r.error.kind).toBe("REPO_FULL");
  });
  it("sin conexión: el fetch lanza y el cliente lo clasifica sin lanzar", async () => {
    gh.offline = true;
    const r = await client.checkRepo();
    expect(r.ok === false && r.error.kind).toBe("OFFLINE");
  });
});

describe("verificar token y repositorio (T-180)", () => {
  it("repositorio privado", async () => {
    expect(must(await client.checkRepo())).toEqual({ isPrivate: true, defaultBranch: "main", canPush: true });
  });
  it("repositorio público: se informa para que la interfaz advierta (RF-14)", async () => {
    gh.isPrivate = false;
    expect(must(await client.checkRepo()).isPrivate).toBe(false);
  });
  it("token inválido -> AUTH; repositorio inexistente -> REPO_NOT_FOUND; sin permiso de escritura -> canPush falso", async () => {
    const bad = new GitHubClient({ fetch: gh.fetch, token: "ghp_otro", owner: "yo", repo: "respaldo" });
    const r1 = await bad.checkRepo();
    expect(r1.ok === false && r1.error.kind).toBe("AUTH");
    gh.inject({ match: /GET \/repos\/yo\/respaldo$/, status: 404, body: { message: "Not Found" } });
    const r2 = await client.checkRepo();
    expect(r2.ok === false && r2.error.kind).toBe("REPO_NOT_FOUND");
    gh.canPush = false;
    expect(must(await client.checkRepo()).canPush).toBe(false);
  });
});

describe("cabeza y árbol (T-181)", () => {
  it("repositorio vacío: la cabeza es null", async () => {
    expect(must(await client.getHead("main"))).toBeNull();
  });
  it("rama inexistente en un repositorio con commits: null", async () => {
    await gh.externalCommit({ "a": "1" });
    expect(must(await client.getHead("otra"))).toBeNull();
  });
  it("devuelve la cabeza, su árbol y el contenido completo del árbol", async () => {
    const sha = await gh.externalCommit({ "a.txt": "uno", "d/b.txt": "dos" });
    expect(must(await client.getHead("main"))).toBe(sha);
    const commit = must(await client.getCommit(sha));
    expect(commit.parents).toEqual([]);
    const tree = must(await client.listTree(commit.treeSha));
    expect([...tree.keys()].sort()).toEqual(["a.txt", "d/b.txt"]);
  });
  it("un árbol truncado por GitHub se trata como error (no se puede comparar con seguridad)", async () => {
    const sha = await gh.externalCommit({ "a": "1" });
    const commit = must(await client.getCommit(sha));
    gh.inject({ match: /GET .*\/git\/trees\//, status: 200, body: { sha: commit.treeSha, truncated: true, tree: [] } });
    const r = await client.listTree(commit.treeSha);
    expect(r.ok === false && r.error.kind).toBe("TREE_TRUNCATED");
  });
});

describe("blobs con tope de 100 MB (T-182)", () => {
  it("un archivo de 101 MB se rechaza antes de enviarse", async () => {
    const before = gh.requests.length;
    const r = await client.createBlob(new Uint8Array(MAX_BLOB_BYTES + 1));
    expect(r.ok === false && r.error.kind).toBe("TOO_LARGE");
    expect(gh.requests.length).toBe(before);
  });
  it("un blob repetido no se vuelve a subir como contenido nuevo (misma huella)", async () => {
    const a = must(await client.createBlob(enc.encode("igual")));
    const b = must(await client.createBlob(enc.encode("igual")));
    expect(a).toBe(b);
    expect(gh.blobs.size).toBe(1);
  });
});

describe("árbol y commit sobre la cabeza (T-183)", () => {
  it("el commit cuelga de la cabeza anterior y el árbol parte del árbol base", async () => {
    const head = await gh.externalCommit({ "viejo.txt": "x", "queda.txt": "y" });
    const base = must(await client.getCommit(head)).treeSha;
    const nuevo = must(await client.createBlob(enc.encode("nuevo")));
    const tree = must(await client.createTree([{ path: "nuevo.txt", sha: nuevo }, { path: "viejo.txt", sha: null }], base));
    const commit = must(await client.createCommit({ message: "segundo", tree, parents: [head] }));
    expect(must(await client.getCommit(commit)).parents).toEqual([head]);
    expect([...must(await client.listTree(tree)).keys()].sort()).toEqual(["nuevo.txt", "queda.txt"]);
  });
});

describe("avanzar la referencia sin forzar (T-184)", () => {
  it("avanza si el commit descende de la cabeza actual", async () => {
    const head = await gh.externalCommit({ a: "1" });
    const tree = must(await client.getCommit(head)).treeSha;
    const c = must(await client.createCommit({ message: "x", tree, parents: [head] }));
    must(await client.updateRef("main", c));
    expect(gh.headSha()).toBe(c);
    expect(gh.requests.at(-1)!.body).toMatchObject({ force: false });
  });
  it("si alguien movió la rama por fuera, se detecta como REF_CONFLICT y no se pierde nada", async () => {
    const head = await gh.externalCommit({ a: "1" });
    const tree = must(await client.getCommit(head)).treeSha;
    const mine = must(await client.createCommit({ message: "mío", tree, parents: [head] }));
    const external = await gh.externalCommit({ a: "2" });
    const r = await client.updateRef("main", mine);
    expect(r.ok === false && r.error.kind).toBe("REF_CONFLICT");
    expect(gh.headSha()).toBe(external);
  });
  it("lista los commits recientes para elegir qué restaurar", async () => {
    await gh.externalCommit({ a: "1" }, "main", "uno");
    await gh.externalCommit({ a: "2" }, "main", "dos");
    expect(must(await client.listCommits("main")).map((c) => c.message)).toEqual(["dos", "uno"]);
  });
});

describe("clasificación de errores (T-185)", () => {
  const h = (o: Record<string, string> = {}) => ({ get: (n: string) => o[n.toLowerCase()] ?? null });
  it.each([
    [401, "Bad credentials", {}, "AUTH", false],
    [403, "API rate limit exceeded for user", { "x-ratelimit-remaining": "0" }, "RATE_LIMIT", true],
    [403, "You have exceeded a secondary rate limit", {}, "RATE_LIMIT", true],
    [403, "This repository is over its data quota", {}, "REPO_FULL", false],
    [403, "Resource not accessible by personal access token", {}, "NO_PERMISSION", false],
    [404, "Not Found", {}, "REPO_NOT_FOUND", false],
    [422, "Update is not a fast forward", {}, "REF_CONFLICT", false],
    [422, "Validation Failed", {}, "INVALID", false],
    [500, "Server Error", {}, "SERVER", true],
    [502, "Bad Gateway", {}, "SERVER", true],
    [418, "algo raro", {}, "UNKNOWN", true],
  ])("%i %s -> %s (reintentable: %s)", (status, message, headers, kind, retryable) => {
    expect(classifyHttpError(status as number, h(headers as Record<string, string>), message as string)).toMatchObject({ kind, retryable });
  });
  it("sin red -> OFFLINE y reintentable", () => {
    expect(classifyHttpError(0, h(), "Failed to fetch")).toMatchObject({ kind: "OFFLINE", retryable: true });
  });
  it("el límite de uso indica cuándo se restablece, si GitHub lo dice", () => {
    expect(classifyHttpError(403, h({ "x-ratelimit-remaining": "0", "x-ratelimit-reset": "1893456000" }), "rate limit")).toMatchObject({ retryAt: 1893456000 * 1000 });
  });
});

describe("el token nunca aparece (T-186)", () => {
  it("redactToken elimina el token y patrones de tokens de GitHub", () => {
    const t = "ghp_" + "A".repeat(36);
    expect(redactToken(`falló con ${t} y github_pat_${"B".repeat(30)} y ghs_${"C".repeat(36)}`, t)).toBe("falló con *** y *** y ***");
    expect(redactToken("sin secretos", "")).toBe("sin secretos");
  });
  it("ni los errores ni los registros contienen el token, aunque el servidor lo repita en su mensaje", async () => {
    const wrong = new GitHubClient({ fetch: gh.fetch, token: "ghp_" + "Z".repeat(36), owner: "yo", repo: "respaldo", log: (m) => logs.push(m) });
    const r = await wrong.checkRepo(); // el servidor falso devuelve "Bad credentials (Bearer <token>)"
    const blob = JSON.stringify(r) + logs.join("\n");
    expect(blob).not.toContain("Z".repeat(36));
    expect(blob).toContain("***");
    gh.offline = true;
    await client.checkRepo();
    expect(logs.join("\n") + JSON.stringify(await client.checkRepo())).not.toContain(gh.token);
  });
  it("las URL de los registros no incluyen la cabecera de autorización", async () => {
    await client.checkRepo();
    expect(logs.join("\n")).not.toContain("Bearer");
    expect(logs.join("\n")).not.toContain(gh.token);
  });
});
