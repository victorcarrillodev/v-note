// E-178 (CL-15): un respaldo de una versión mayor que la soportada se rechaza con aviso y sin tocar nada.
import { describe, it, expect } from "vitest";
import { createNodeSqliteStore } from "../../tests/support/nodeSqliteStore";
import { MemoryConfigStore, MemoryWorkspaceStorage } from "../../tests/support/memoryPorts";
import { migrate } from "../db/migrate";
import { migrations } from "../db/migrations";
import { FakeClock } from "../clock";
import { MemoryAssetStore } from "../assets/memoryAssetStore";
import { PageService } from "../pages/pageService";
import { WorkspaceManager } from "../workspaces/workspaceManager";
import { FORMAT_VERSION, serializeWorkspace } from "./serialize";
import { restoreFromFiles, validateBackup } from "./restore";
import { replaceWorkspace, restoreAsNewWorkspace } from "./restoreFlows";

const enc = new TextEncoder();
const must = <T>(r: { ok: boolean; value?: T; error?: unknown }): T => { if (!r.ok) throw new Error(JSON.stringify(r.error)); return r.value as T; };
const future = (files: Map<string, Uint8Array>) => { const f = new Map(files); f.set("workspace.json", enc.encode(JSON.stringify({ formatVersion: FORMAT_VERSION + 1, id: "x", name: "Del futuro", pageCount: 1 }))); return f; };

async function backup() {
  const db = await createNodeSqliteStore(":memory:"); await migrate(db, migrations);
  const clock = new FakeClock(1_000);
  must(await new PageService(db, clock).create({ title: "Hoy" }));
  return (await serializeWorkspace({ store: db, assets: new MemoryAssetStore() }, { id: "ws", name: "Origen" })).files;
}

describe("respaldo de una versión mayor (E-178, CL-15)", () => {
  it("la versión soportada es la 2; la 3 se rechaza con el código y los datos para avisar", async () => {
    const v = await validateBackup(future(await backup()));
    expect(v.ok).toBe(false);
    expect(!v.ok && v.error).toMatchObject({ code: "UNSUPPORTED_VERSION", details: { found: 3, supported: 2 } });
  });
  it("restaurar sobre un destino vacío no escribe nada", async () => {
    const target = await createNodeSqliteStore(":memory:"); await migrate(target, migrations);
    const assets = new MemoryAssetStore();
    const r = await restoreFromFiles(future(await backup()), { store: target, assets });
    expect(!r.ok && r.error.code).toBe("UNSUPPORTED_VERSION");
    expect(await target.query("SELECT count(*) AS n FROM pages")).toEqual([{ n: 0 }]);
    expect(await assets.list()).toEqual([]);
  });
  it("como espacio nuevo no crea ningún espacio", async () => {
    const mgr = new WorkspaceManager(new MemoryConfigStore(), new MemoryWorkspaceStorage(), new FakeClock(1_000));
    const r = await restoreAsNewWorkspace(mgr, () => new MemoryAssetStore(), future(await backup()), { name: "Nuevo" });
    expect(!r.ok && r.error.code).toBe("UNSUPPORTED_VERSION");
    expect(must(await mgr.list())).toEqual([]);
  });
  it("al reemplazar deja el espacio existente exactamente como estaba", async () => {
    const mgr = new WorkspaceManager(new MemoryConfigStore(), new MemoryWorkspaceStorage(), new FakeClock(1_000));
    const ws = must(await mgr.create({ name: "Mío" }));
    const { store } = must(await mgr.open(ws.id));
    must(await new PageService(store, new FakeClock(1_000)).create({ title: "Importante" }));
    const before = await store.query("SELECT id, title FROM pages");
    const r = await replaceWorkspace(mgr, ws.id, () => new MemoryAssetStore(), future(await backup()), { confirmName: "Mío" });
    expect(!r.ok && r.error.code).toBe("UNSUPPORTED_VERSION");
    expect(await (must(await mgr.open(ws.id))).store.query("SELECT id, title FROM pages")).toEqual(before);
    expect(must(await mgr.list()).map((w) => w.name)).toEqual(["Mío"]);
  });
  it("la versión actual y la anterior sí se aceptan", async () => {
    const files = await backup();
    expect((await validateBackup(files)).ok).toBe(true);
    const v1 = new Map(files); v1.set("workspace.json", enc.encode(JSON.stringify({ formatVersion: 1, id: "x", name: "v1", pageCount: 1 })));
    expect((await validateBackup(v1)).ok).toBe(true);
  });
});
