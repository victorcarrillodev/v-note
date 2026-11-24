import { describe, it, expect, vi } from "vitest";
import { FakeClock } from "../clock";
import { MemoryAssetStore } from "../assets/memoryAssetStore";
import { ok } from "../result";
import { WorkspaceManager } from "../workspaces/workspaceManager";
import { MemoryConfigStore, MemoryWorkspaceStorage } from "../../tests/support/memoryPorts";
import { PageService } from "../pages/pageService";
import { AppBackupService } from "./appBackupService";
import type { BackupDestination, RemoteManifest } from "./destination";

function makeDest(): BackupDestination & { written: Map<string, Uint8Array>; manifest: RemoteManifest | null } {
  const written = new Map<string, Uint8Array>();
  let manifest: RemoteManifest | null = null;
  return {
    kind: "local-folder",
    written,
    get manifest() { return manifest; },
    async checkConnection() { return ok({ kind: "local-folder", label: "Test", writable: true }); },
    async readManifest() { return ok(manifest); },
    async applyChanges(ops) {
      for (const f of ops.put) written.set(f.path, f.bytes);
      for (const r of ops.remove) written.delete(r);
      manifest = ops.nextManifest;
      return ok({ manifest, uploaded: ops.put.length, updated: 0, removed: ops.remove.length });
    },
    async downloadAll() { return ok(new Map(written)); },
  };
}

describe("AppBackupService (respaldo unificado)", () => {
  it("junta todos los espacios y preferencias en un solo respaldo y no re-abre espacios no modificados", async () => {
    const clock = new FakeClock(1_000);
    const storage = new MemoryWorkspaceStorage();
    const mgr = new WorkspaceManager(new MemoryConfigStore(), storage, clock);
    const w1 = await mgr.create({ name: "Personal" });
    const w2 = await mgr.create({ name: "Trabajo" });
    if (!w1.ok || !w2.ok) throw new Error("create");
    await mgr.setColor(w1.value.id, "#ff5500");

    const open1 = await mgr.open(w1.value.id);
    if (!open1.ok) throw new Error("open");
    await new PageService(open1.value.store, clock).create({ title: "Nota 1" });

    const assetsMap = new Map<string, MemoryAssetStore>();
    const assetsFor = (loc: string) => {
      let a = assetsMap.get(loc);
      if (!a) { a = new MemoryAssetStore(); assetsMap.set(loc, a); }
      return a;
    };

    const svc = new AppBackupService({
      workspaces: mgr,
      assetsFor,
      clock,
      preferences: () => ({ theme: "dark", lang: "es-MX" }),
    });
    const dest = makeDest();

    const r1 = await svc.syncTo(dest);
    expect(r1.status).toBe("success");
    expect(dest.written.has("app/workspaces.json")).toBe(true);
    expect(dest.written.has("app/preferences.json")).toBe(true);
    expect([...dest.written.keys()].some((k) => k.startsWith(`workspaces/${w1.value.id}/`))).toBe(true);
    expect([...dest.written.keys()].some((k) => k.startsWith(`workspaces/${w2.value.id}/`))).toBe(true);

    // Segunda sincronización marcando solo w1 como sucio: no debe volver a abrir w2
    const openSpy = vi.spyOn(mgr, "open");
    await new PageService(open1.value.store, clock).create({ title: "Nota 2" });
    clock.advance(5_000);
    const r2 = await svc.syncTo(dest, { dirtyWorkspaceIds: new Set([w1.value.id]) });
    expect(r2.status).toBe("success");
    expect(openSpy).toHaveBeenCalledWith(w1.value.id);
    expect(openSpy).not.toHaveBeenCalledWith(w2.value.id);
  });
});
