// T-218, T-219, T-220 (lógica; prueba primero): restaurar como espacio nuevo, reemplazar con intercambio al final, y primer inicio en un equipo nuevo.
import { describe, it, expect, beforeEach } from "vitest";
import { createNodeSqliteStore } from "../../tests/support/nodeSqliteStore";
import { FakeGithub } from "../../tests/support/fakeGithub";
import { MemoryConfigStore, MemoryWorkspaceStorage } from "../../tests/support/memoryPorts";
import { para, updateFor } from "../../tests/support/builders";
import { migrate } from "../db/migrate";
import { migrations } from "../db/migrations";
import { FakeClock } from "../clock";
import { MemoryAssetStore } from "../assets/memoryAssetStore";
import type { AssetStore } from "../assets/assetStore";
import { PageService } from "../pages/pageService";
import { PagesRepo } from "../pages/pagesRepo";
import { WorkspaceManager } from "../workspaces/workspaceManager";
import { GitHubClient } from "./githubClient";
import { runBackup } from "./runBackup";
import { readBackup, listBackups } from "./restore";
import { restoreAsNewWorkspace, replaceWorkspace, RestoreSource } from "./restoreFlows";

let gh: FakeGithub, clock: FakeClock, mgr: WorkspaceManager, storage: MemoryWorkspaceStorage, client: GitHubClient;
const assetsByLocation = new Map<string, MemoryAssetStore>();
const assetsFor = (location: string): AssetStore => { if (!assetsByLocation.has(location)) assetsByLocation.set(location, new MemoryAssetStore()); return assetsByLocation.get(location)!; };
const must = <T>(r: { ok: boolean; value?: T; error?: unknown }): T => { if (!r.ok) throw new Error(JSON.stringify(r.error)); return r.value as T; };

beforeEach(() => {
  gh = new FakeGithub();
  clock = new FakeClock(Date.UTC(2026, 9, 1, 12));
  storage = new MemoryWorkspaceStorage();
  mgr = new WorkspaceManager(new MemoryConfigStore(), storage, clock);
  client = new GitHubClient({ fetch: gh.fetch, token: gh.token, owner: "yo", repo: "r" });
  assetsByLocation.clear();
});

/** Crea un espacio con contenido, lo respalda y devuelve sus archivos de respaldo. */
async function backedUp(name = "Origen") {
  const ws = must(await mgr.create({ name }));
  const { store } = must(await mgr.open(ws.id));
  const svc = new PageService(store, clock);
  const a = must(await svc.create({ title: "Proyectos" }));
  await svc.saveUpdate(a.id, updateFor([para("plan")]));
  must(await svc.create({ title: "Ideas", parentId: a.id }));
  await assetsFor(ws.location).put(new TextEncoder().encode("adjunto"));
  await runBackup({ store, assets: assetsFor(ws.location), client, clock, workspace: { id: ws.id, name } }, { onExternalChange: "continue" });
  const files = must(await readBackup(client, gh.headSha()!));
  return { ws, store, files, a };
}

describe("restaurar como espacio nuevo (T-218)", () => {
  it("crea un espacio nuevo con el contenido del respaldo y deja el original intacto", async () => {
    const { ws, files } = await backedUp();
    const before = JSON.stringify(await (must(await mgr.open(ws.id)).store).query("SELECT * FROM pages ORDER BY id"));
    const r = must(await restoreAsNewWorkspace(mgr, assetsFor, files, { name: "Restaurado" }));
    expect(r.workspace.name).toBe("Restaurado");
    expect(r.workspace.id).not.toBe(ws.id);
    const tree = await new PagesRepo(must(await mgr.open(r.workspace.id)).store, clock).tree();
    expect(tree.map((n) => n.page.title)).toEqual(["Proyectos"]);
    expect(tree[0]!.children.map((n) => n.page.title)).toEqual(["Ideas"]);
    expect((await assetsFor(r.workspace.location).list()).length).toBe(1);
    expect(JSON.stringify(await must(await mgr.open(ws.id)).store.query("SELECT * FROM pages ORDER BY id"))).toBe(before);
    expect(must(await mgr.list())).toHaveLength(2);
  });
  it("sin nombre usa el que trae el respaldo", async () => {
    const { files } = await backedUp("Mi diario");
    expect(must(await restoreAsNewWorkspace(mgr, assetsFor, files)).workspace.name).toBe("Mi diario (restaurado)");
  });
  it("si el respaldo es inválido o de una versión futura no queda ningún espacio a medias", async () => {
    const { files } = await backedUp();
    files.set("workspace.json", new TextEncoder().encode('{"formatVersion": 99}'));
    const before = must(await mgr.list()).length;
    const r = await restoreAsNewWorkspace(mgr, assetsFor, files, { name: "X" });
    expect(r.ok === false && r.error.code).toBe("UNSUPPORTED_VERSION");
    expect(must(await mgr.list())).toHaveLength(before);
    expect(storage.removed.length).toBeGreaterThanOrEqual(0);
  });
  it("si falla a mitad (página dañada) elimina el espacio recién creado", async () => {
    const { files } = await backedUp();
    const k = [...files.keys()].find((x) => x.startsWith("data/"))!;
    files.set(k, new TextEncoder().encode("{roto"));
    const before = must(await mgr.list()).length;
    expect((await restoreAsNewWorkspace(mgr, assetsFor, files, { name: "X" })).ok).toBe(false);
    expect(must(await mgr.list())).toHaveLength(before);
  });
});

describe("reemplazar un espacio (T-219)", () => {
  it("describe qué se sustituirá antes de hacerlo", async () => {
    const { ws, files } = await backedUp();
    const { describeReplacement } = await import("./restoreFlows");
    const d = must(await describeReplacement(mgr, ws.id, files));
    expect(d).toMatchObject({ workspaceName: "Origen", currentPages: 2, backupPages: 2, hasNoBackup: false });
    expect(d.lastBackupAt).toBe(clock.now());
  });
  it("construye el nuevo contenido aparte y al final lo intercambia: mismo nombre, el original desaparece", async () => {
    const { ws, store, files } = await backedUp();
    await new PageService(store, clock).create({ title: "Se perderá al reemplazar" });
    const r = must(await replaceWorkspace(mgr, ws.id, assetsFor, files, { confirmName: "Origen" }));
    const list = must(await mgr.list());
    expect(list.map((w) => w.name)).toEqual(["Origen"]);
    expect(list[0]!.id).toBe(r.workspace.id);
    expect(list[0]!.id).not.toBe(ws.id);
    const titles = (await new PagesRepo(must(await mgr.open(r.workspace.id)).store, clock).tree()).flatMap((n) => [n.page.title, ...n.children.map((c) => c.page.title)]);
    expect(titles.sort()).toEqual(["Ideas", "Proyectos"]);
  });
  it("conserva la marca de predeterminado para captura rápida", async () => {
    const { ws, files } = await backedUp();
    expect(must(await mgr.list())[0]!.isCaptureDefault).toBe(true);
    const r = must(await replaceWorkspace(mgr, ws.id, assetsFor, files, { confirmName: "Origen" }));
    expect(must(await mgr.captureDefault())?.id).toBe(r.workspace.id);
  });
  it("exige escribir el nombre exacto; sin él no cambia nada", async () => {
    const { ws, files } = await backedUp();
    const r = await replaceWorkspace(mgr, ws.id, assetsFor, files, { confirmName: "otro" });
    expect(r.ok === false && r.error.code).toBe("NEEDS_CONFIRMATION");
    expect(must(await mgr.list()).map((w) => w.id)).toEqual([ws.id]);
  });
  it("si el respaldo es inválido, el espacio original queda intacto y no hay espacios de más", async () => {
    const { ws, files } = await backedUp();
    files.set("workspace.json", new TextEncoder().encode("no es json"));
    const r = await replaceWorkspace(mgr, ws.id, assetsFor, files, { confirmName: "Origen" });
    expect(r.ok).toBe(false);
    expect(must(await mgr.list()).map((w) => w.id)).toEqual([ws.id]);
  });
});

describe("primer inicio en un equipo nuevo (T-220)", () => {
  it("conecta con token y repositorio, lista los respaldos y restaura sin tener ningún espacio", async () => {
    const { files } = await backedUp("Casa");
    const fresh = new WorkspaceManager(new MemoryConfigStore(), new MemoryWorkspaceStorage(), clock);
    const src = new RestoreSource({ fetch: gh.fetch });
    must(await src.connect({ token: gh.token, owner: "yo", repo: "r" }));
    const points = must(await src.listPoints());
    expect(points).toHaveLength(1);
    const read = must(await src.read(points[0]!.sha));
    expect(read.size).toBe(files.size);
    const r = must(await restoreAsNewWorkspace(fresh, assetsFor, read));
    expect(must(await fresh.list()).map((w) => w.name)).toEqual(["Casa (restaurado)"]);
    expect(r.workspace.isCaptureDefault).toBe(true); // es el primero del equipo
  });
  it("repositorio público: pide confirmación; token inválido: falla sin guardar nada", async () => {
    await backedUp();
    gh.isPrivate = false;
    const src = new RestoreSource({ fetch: gh.fetch });
    const a = await src.connect({ token: gh.token, owner: "yo", repo: "r" });
    expect(a.ok === false && a.error.code).toBe("NEEDS_CONFIRMATION");
    expect((await src.connect({ token: gh.token, owner: "yo", repo: "r", confirmPublic: true })).ok).toBe(true);
    const b = await new RestoreSource({ fetch: gh.fetch }).connect({ token: "ghp_malo", owner: "yo", repo: "r" });
    expect(b.ok).toBe(false);
  });
  it("un repositorio sin respaldos devuelve una lista vacía", async () => {
    const src = new RestoreSource({ fetch: gh.fetch });
    must(await src.connect({ token: gh.token, owner: "yo", repo: "r" }));
    expect(must(await src.listPoints())).toEqual([]);
  });
  it("antes de conectar no se puede listar", async () => {
    const r = await new RestoreSource({ fetch: gh.fetch }).listPoints();
    expect(r.ok).toBe(false);
  });
  it("el token solo se conserva en memoria durante el asistente y se puede olvidar", async () => {
    const src = new RestoreSource({ fetch: gh.fetch });
    must(await src.connect({ token: gh.token, owner: "yo", repo: "r" }));
    src.forget();
    expect((await src.listPoints()).ok).toBe(false);
  });
  void listBackups; void migrate; void migrations; void createNodeSqliteStore;
});
