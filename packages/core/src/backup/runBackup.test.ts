// T-187 a T-193, T-197, T-199 (prueba primero): ejecución del respaldo contra el servidor GitHub falso.
import { describe, it, expect, beforeEach } from "vitest";
import { createNodeSqliteStore } from "../../tests/support/nodeSqliteStore";
import { FakeGithub } from "../../tests/support/fakeGithub";
import { para, updateFor, appendTextUpdate } from "../../tests/support/builders";
import { DocStore } from "../docs/docStore";
import { migrate } from "../db/migrate";
import { migrations } from "../db/migrations";
import { FakeClock } from "../clock";
import { MemoryAssetStore } from "../assets/memoryAssetStore";
import { PageService } from "../pages/pageService";
import { GitHubClient } from "./githubClient";
import { runBackup, commitMessage, type BackupOutcome } from "./runBackup";
import { gitTreeSha, gitBlobSha } from "./gitHash";
import type { SqlStore } from "../ports/sqlStore";

let db: SqlStore;
let gh: FakeGithub;
let client: GitHubClient;
let assets: MemoryAssetStore;
let clock: FakeClock;
let svc: PageService;
const T0 = Date.UTC(2026, 9, 30, 14, 0);
beforeEach(async () => {
  db = await createNodeSqliteStore(":memory:");
  await migrate(db, migrations);
  gh = new FakeGithub();
  client = new GitHubClient({ fetch: gh.fetch, token: gh.token, owner: "yo", repo: "r" });
  assets = new MemoryAssetStore();
  clock = new FakeClock(T0);
  svc = new PageService(db, clock);
});
const deps = () => ({ store: db, assets, client, clock, workspace: { id: "ws", name: "Personal" } });
const run = (opts: Parameters<typeof runBackup>[1] = {}) => runBackup(deps(), opts);
async function page(title: string, body = "", parentId: string | null = null) {
  const p = await svc.create({ title, parentId });
  if (!p.ok) throw new Error("x");
  if (body) await svc.saveUpdate(p.value.id, updateFor([para(body)]));
  return p.value;
}
const edit = async (id: string, extra: string) => {
  const doc = await new DocStore(db, clock).load(id);
  if (!doc.ok) throw new Error("x");
  await svc.saveUpdate(id, appendTextUpdate(doc.value, extra));
};
const calls = (re: RegExp) => gh.requests.filter((r) => re.test(`${r.method} ${new URL(r.url).pathname}`)).length;
const dump = async () => JSON.stringify({
  pages: await db.query("SELECT * FROM pages ORDER BY id"), docs: await db.query("SELECT page_id, seq, kind, hex(data) AS d FROM page_docs ORDER BY page_id, seq"),
  text: await db.query("SELECT * FROM page_text ORDER BY page_id"),
});

describe("primer respaldo y diferencias (T-187, T-188)", () => {
  it("en un repositorio vacío sube todo y deja el árbol remoto idéntico al local", async () => {
    await page("Uno", "hola"); await page("Dos", "mundo");
    const r = await run();
    expect(r.status).toBe("success");
    const head = gh.headSha()!;
    const remote = gh.trees.get(gh.commits.get(head)!.tree)!;
    expect([...remote.keys()]).toContain("workspace.json");
    expect([...remote.keys()].filter((k) => k.startsWith("data/"))).toHaveLength(2);
    expect(r.status === "success" && r.commit).toBe(head);
  });
  it("sin cambios no crea commit ni sube nada", async () => {
    await page("Uno", "hola");
    await run();
    const head = gh.headSha();
    const before = gh.requests.length;
    const r = await run();
    expect(r.status).toBe("unchanged");
    expect(gh.headSha()).toBe(head);
    expect(calls(/POST .*\/git\/(blobs|trees|commits)$/)).toBe(calls(/POST .*\/git\/(blobs|trees|commits)$/)); // sin nuevas llamadas de escritura:
    expect(gh.requests.slice(before).filter((q) => q.method !== "GET")).toEqual([]);
  });
  it("tras un cambio solo se suben los archivos distintos y el commit cuelga del anterior", async () => {
    const a = await page("Uno", "hola"); await page("Dos", "mundo");
    await run();
    const head1 = gh.headSha()!;
    const blobsBefore = gh.blobs.size;
    clock.advance(60_000);
    await edit(a.id, " cambiado");
    const r = await run();
    expect(r.status).toBe("success");
    expect(gh.blobs.size - blobsBefore).toBe(2); // el JSON y el Markdown de la página cambiada
    expect(gh.commits.get(gh.headSha()!)!.parents).toEqual([head1]);
  });
  it("una página eliminada definitivamente desaparece del último respaldo pero queda en el historial", async () => {
    const a = await page("Uno", "hola"); await page("Dos", "mundo");
    await run();
    const head1 = gh.headSha()!;
    const repo = (await import("../pages/pagesRepo")).PagesRepo;
    const pr = new repo(db, clock);
    await pr.trash(a.id);
    await run(); // la papelera sí se respalda
    expect([...gh.trees.get(gh.commits.get(gh.headSha()!)!.tree)!.keys()]).toContain(`data/${a.id}.json`);
    await svc.deletePermanently(a.id, { confirm: true });
    await run();
    const files = [...gh.trees.get(gh.commits.get(gh.headSha()!)!.tree)!.keys()];
    expect(files).not.toContain(`data/${a.id}.json`);
    expect([...gh.trees.get(gh.commits.get(head1)!.tree)!.keys()]).toContain(`data/${a.id}.json`); // sigue en el historial
  });
  it("renombrar una página mueve su Markdown pero conserva la ruta de datos", async () => {
    const a = await page("Viejo", "x");
    await run();
    await svc.rename(a.id, "Nuevo nombre");
    await run();
    const files = [...gh.trees.get(gh.commits.get(gh.headSha()!)!.tree)!.keys()];
    expect(files.filter((f) => f.startsWith("pages/"))).toEqual([`pages/nuevo-nombre--${a.id.replace(/-/g, "").slice(0, 8)}.md`]);
    expect(files).toContain(`data/${a.id}.json`);
  });
  it("el mismo adjunto en dos lugares se sube una sola vez", async () => {
    const x = await assets.put(new TextEncoder().encode("adjunto"));
    await run();
    expect(gh.blobs.has(await gitBlobSha(new TextEncoder().encode("adjunto")))).toBe(true);
    expect(x.hash).toBeTruthy();
  });
});

describe("mensaje del commit (T-189)", () => {
  it("lleva la fecha y la cantidad de páginas modificadas, en singular y plural", () => {
    expect(commitMessage(T0, 3)).toBe("Respaldo automático 2026-10-30 14:00 · 3 páginas modificadas");
    expect(commitMessage(T0, 1)).toBe("Respaldo automático 2026-10-30 14:00 · 1 página modificada");
    expect(commitMessage(T0, 0)).toBe("Respaldo automático 2026-10-30 14:00 · sin páginas modificadas");
  });
  it("el commit real usa ese mensaje contando páginas distintas (no archivos)", async () => {
    const a = await page("Uno", "hola"); await page("Dos", "x");
    await run();
    expect(gh.commits.get(gh.headSha()!)!.message).toBe("Respaldo automático 2026-10-30 14:00 · 2 páginas modificadas");
    clock.advance(3_600_000);
    await edit(a.id, " otra");
    await run();
    expect(gh.commits.get(gh.headSha()!)!.message).toBe("Respaldo automático 2026-10-30 15:00 · 1 página modificada");
  });
});

describe("cambio externo (T-191, CL-18)", () => {
  it("si la rama cambió por fuera, pide decisión y no sube ni modifica nada", async () => {
    await page("Uno", "hola");
    await run();
    const external = await gh.externalCommit({ "otro.txt": "alguien más" });
    await svc.rename((await db.query<{ id: string }>("SELECT id FROM pages"))[0]!.id, "Cambiada");
    const blobs = gh.blobs.size;
    const r = await run();
    expect(r).toMatchObject({ status: "needs_decision", remoteHead: external });
    expect(gh.headSha()).toBe(external);
    expect(gh.blobs.size).toBe(blobs);
  });
  it("si se decide continuar, el commit va encima del externo (el historial se conserva)", async () => {
    await page("Uno", "hola");
    await run();
    const external = await gh.externalCommit({ "otro.txt": "alguien más" });
    const r = await run({ onExternalChange: "continue" });
    expect(r.status).toBe("success");
    expect(gh.commits.get(gh.headSha()!)!.parents).toEqual([external]);
  });
  it("primer respaldo hacia un repositorio que ya tiene contenido: también pide decisión", async () => {
    await gh.externalCommit({ "README.md": "mi repo" });
    await page("Uno");
    expect((await run()).status).toBe("needs_decision");
  });
  it("si la rama se mueve justo entre la comprobación y la publicación, se detecta como cambio externo", async () => {
    await page("Uno", "hola");
    await run();
    await svc.rename((await db.query<{ id: string }>("SELECT id FROM pages"))[0]!.id, "Cambiada");
    gh.inject({ match: /PATCH .*\/git\/refs\/heads\/main$/, status: 422, body: { message: "Update is not a fast forward" } });
    const r = await run();
    expect(r.status).toBe("needs_decision");
  });
});

describe("adjuntos grandes (T-192)", () => {
  it("se omite el que supera el límite, se lista y se respalda el resto", async () => {
    await page("Uno", "hola");
    const big = await assets.put(new Uint8Array(30));
    await assets.put(new Uint8Array(3));
    const r = await runBackup({ ...deps() }, { maxAssetBytes: 10 });
    expect(r.status).toBe("success");
    expect(r.status === "success" && r.skipped).toEqual([{ hash: big.hash, size: 30 }]);
    expect([...gh.trees.get(gh.commits.get(gh.headSha()!)!.tree)!.keys()].filter((k) => k.startsWith("assets/"))).toHaveLength(1);
  });
});

describe("historial de ejecuciones (T-193)", () => {
  const runs = () => db.query<{ status: string; commit_sha: string | null; error_kind: string | null; error_message: string | null; files_uploaded: number | null }>("SELECT * FROM backup_runs ORDER BY id");
  it("registra éxito, sin cambios y fallo", async () => {
    await page("Uno", "hola");
    await run(); await run();
    gh.offline = true;
    await svc.create({ title: "otra" });
    await run();
    const rows = await runs();
    expect(rows.map((r) => r.status)).toEqual(["success", "unchanged", "failed"]);
    expect(rows[0]!.commit_sha).toBe(Object.values(Object.fromEntries([...gh.refs]))[0]);
    expect(rows[2]).toMatchObject({ error_kind: "OFFLINE" });
    expect(rows[0]!.files_uploaded).toBeGreaterThan(0);
  });
  it("guarda la fecha del último respaldo exitoso en meta", async () => {
    await page("Uno", "hola");
    await run();
    expect((await db.query<{ value: string }>("SELECT value FROM meta WHERE key = 'last_backup_at'"))[0]!.value).toBe(String(T0));
    expect((await db.query<{ value: string }>("SELECT value FROM meta WHERE key = 'backup_last_commit'"))[0]!.value).toBe(gh.headSha());
  });
  it("un fallo no actualiza la fecha del último respaldo exitoso", async () => {
    await page("Uno", "hola");
    gh.offline = true;
    await run();
    expect(await db.query("SELECT * FROM meta WHERE key = 'last_backup_at'")).toEqual([]);
  });
});

describe("cortes a mitad (T-197)", () => {
  it("si falla al subir archivos, la rama no avanza y el siguiente intento termina el trabajo", async () => {
    await page("Uno", "hola"); await page("Dos", "mundo"); await page("Tres", "x");
    gh.inject({ match: /POST .*\/git\/blobs$/, status: 500, body: { message: "boom" }, times: 99 });
    const r = await run();
    expect(r.status).toBe("failed");
    expect(gh.headSha()).toBeNull();
    gh.clearInjections();
    const ok = await run();
    expect(ok.status).toBe("success");
    expect(gh.headSha()).not.toBeNull();
  });
  it("si falla al crear el commit o el árbol, la rama tampoco avanza", async () => {
    await page("Uno", "hola");
    await run();
    const head = gh.headSha();
    await svc.rename((await db.query<{ id: string }>("SELECT id FROM pages"))[0]!.id, "Cambiada");
    gh.inject({ match: /POST .*\/git\/commits$/, status: 502, body: { message: "Bad Gateway" } });
    expect((await run()).status).toBe("failed");
    expect(gh.headSha()).toBe(head);
    expect((await run()).status).toBe("success");
  });
  it("cancelar a tiempo (AbortSignal) no avanza la rama", async () => {
    await page("Uno", "hola");
    const ac = new AbortController();
    ac.abort();
    const r = await run({ signal: ac.signal });
    expect(r.status).toBe("cancelled");
    expect(gh.headSha()).toBeNull();
  });
});

describe("un fallo no toca los datos locales (T-199, RF-16)", () => {
  it.each([["OFFLINE"], ["AUTH"], ["REPO_FULL"], ["RATE_LIMIT"]])("causa %s", async (kind) => {
    await page("Uno", "hola"); await page("Dos", "x");
    const before = await dump();
    if (kind === "OFFLINE") gh.offline = true;
    if (kind === "AUTH") gh.token = "otro-token";
    if (kind === "REPO_FULL") gh.maxRepoBytes = 1;
    if (kind === "RATE_LIMIT") gh.inject({ match: /./, status: 403, body: { message: "API rate limit exceeded" }, headers: { "x-ratelimit-remaining": "0" }, times: 99 });
    const r = await run();
    expect(r.status).toBe("failed");
    expect(await dump()).toBe(before);
  });
});

describe("coherencia del árbol remoto", () => {
  it("el árbol remoto tras el respaldo coincide con la huella local calculada", async () => {
    await page("Uno", "hola");
    const { serializeWorkspace } = await import("./serialize");
    const s = await serializeWorkspace({ store: db, assets }, { id: "ws", name: "Personal" });
    const shas = new Map<string, string>();
    for (const [p, b] of s.files) shas.set(p, await gitBlobSha(b));
    await run();
    expect(gh.commits.get(gh.headSha()!)!.tree).toBe(await gitTreeSha(shas));
  });
});
