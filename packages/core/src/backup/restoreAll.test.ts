import { describe, it, expect } from "vitest";
import { MemoryConfigStore, MemoryWorkspaceStorage } from "../../tests/support/memoryPorts";
import { FakeClock } from "../clock";
import { MemoryAssetStore } from "../assets/memoryAssetStore";
import type { AssetStore } from "../assets/assetStore";
import { WorkspaceManager } from "../workspaces/workspaceManager";
import { AppBackupService } from "./appBackupService";
import { restoreAllFromBackup, splitUnifiedBackup } from "./restoreAll";

const enc = new TextEncoder();

describe("splitUnifiedBackup", () => {
  it("separa app/ y cada workspaces/<id>/ quitando el prefijo", () => {
    const files = new Map<string, Uint8Array>([
      ["app/workspaces.json", enc.encode(JSON.stringify({ version: 3, workspaces: [{ id: "a", name: "A", isCaptureDefault: true }] }))],
      ["app/preferences.json", enc.encode("{}")],
      ["workspaces/a/workspace.json", enc.encode("{}")],
      ["workspaces/a/pages/x.md", enc.encode("x")],
      ["backup-manifest.json", enc.encode("{}")],
    ]);
    const r = splitUnifiedBackup(files);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.workspaces.map((w) => w.meta.id)).toEqual(["a"]);
    expect([...r.value.workspaces[0]!.files.keys()].sort()).toEqual(["pages/x.md", "workspace.json"]);
    expect(r.value.preferences).toEqual({});
  });

  it("rechaza un respaldo sin app/workspaces.json", () => {
    const r = splitUnifiedBackup(new Map([["workspaces/a/workspace.json", enc.encode("{}")]]));
    expect(r.ok).toBe(false);
  });
});

const newEnv = () => {
  const clock = new FakeClock(Date.UTC(2026, 10, 27));
  const mgr = new WorkspaceManager(new MemoryConfigStore(), new MemoryWorkspaceStorage(), clock);
  const assets = new Map<string, AssetStore>();
  const assetsFor = (l: string): AssetStore => { if (!assets.has(l)) assets.set(l, new MemoryAssetStore()); return assets.get(l)!; };
  return { clock, mgr, assetsFor };
};

describe("splitUnifiedBackup con datos dañados", () => {
  it("rechaza un app/workspaces.json corrupto o sin lista, y tolera preferencias corruptas", () => {
    expect(splitUnifiedBackup(new Map([["app/workspaces.json", enc.encode("{no json")]])).ok).toBe(false);
    expect(splitUnifiedBackup(new Map([["app/workspaces.json", enc.encode("{\"version\":3}")]])).ok).toBe(false);
    const r = splitUnifiedBackup(new Map([
      ["app/workspaces.json", enc.encode(JSON.stringify({ version: 3, workspaces: [] }))],
      ["app/preferences.json", enc.encode("{roto")],
    ]));
    expect(r.ok && r.value.preferences).toEqual({});
  });
});

describe("restoreAllFromBackup", () => {
  it("restaura cada espacio como nuevo con el sufijo, respeta el predeterminado y no toca los existentes", async () => {
    const src = newEnv();
    const a = await src.mgr.create({ name: "Personal" });
    const b = await src.mgr.create({ name: "Estudio" });
    if (!a.ok || !b.ok) throw new Error("create");
    const snap = await new AppBackupService({ workspaces: src.mgr, assetsFor: src.assetsFor, clock: src.clock }).buildSnapshot();

    const dst = newEnv();
    await dst.mgr.create({ name: "Personal" });
    const r = await restoreAllFromBackup(dst.mgr, dst.assetsFor, snap.files);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.failed).toEqual([]);
    expect(r.value.restored.map((w) => w.name).sort()).toEqual(["Estudio (restaurado)", "Personal (restaurado)"]);
    const list = await dst.mgr.list();
    if (!list.ok) throw new Error("list");
    expect(list.value.map((w) => w.name).sort()).toEqual(["Estudio (restaurado)", "Personal", "Personal (restaurado)"]);
    expect(list.value.filter((w) => w.isCaptureDefault)).toHaveLength(1);
    expect(list.value.find((w) => w.name === "Personal")?.isCaptureDefault).toBe(true); // el existente conserva el predeterminado
  });

  it("si un espacio falla, los demás se restauran y el fallo se informa sin dejar un espacio a medias", async () => {
    const src = newEnv();
    const a = await src.mgr.create({ name: "Bueno" });
    const b = await src.mgr.create({ name: "Dañado" });
    if (!a.ok || !b.ok) throw new Error("create");
    const snap = await new AppBackupService({ workspaces: src.mgr, assetsFor: src.assetsFor, clock: src.clock }).buildSnapshot();
    snap.files.set(`workspaces/${b.value.id}/workspace.json`, enc.encode("{roto"));

    const dst = newEnv();
    const r = await restoreAllFromBackup(dst.mgr, dst.assetsFor, snap.files);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.restored.map((w) => w.name)).toEqual(["Bueno (restaurado)"]);
    expect(r.value.failed.map((f) => f.name)).toEqual(["Dañado"]);
    const list = await dst.mgr.list();
    expect(list.ok && list.value.map((w) => w.name)).toEqual(["Bueno (restaurado)"]);
  });
});
