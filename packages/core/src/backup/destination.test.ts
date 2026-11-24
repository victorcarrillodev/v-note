import { describe, it, expect, vi } from "vitest";
import { ok } from "../result";
import {
  diffManifest,
  syncWithDestination,
  type BackupDestination,
  type FileChange,
  type RemoteManifest,
} from "./destination";

const enc = new TextEncoder();

function memoryDestination(initial?: { manifest: RemoteManifest | null; files?: Record<string, Uint8Array> }): BackupDestination & {
  store: Map<string, Uint8Array>;
  applyCalls: { put: FileChange[]; remove: string[] }[];
} {
  let manifest: RemoteManifest | null = initial?.manifest ?? null;
  const store = new Map<string, Uint8Array>(Object.entries(initial?.files ?? {}));
  const applyCalls: { put: FileChange[]; remove: string[] }[] = [];

  return {
    kind: "local-folder",
    store,
    applyCalls,
    async checkConnection() {
      return ok({ kind: "local-folder", label: "Memoria", writable: true });
    },
    async readManifest() {
      return ok(manifest);
    },
    async applyChanges(ops) {
      applyCalls.push({ put: ops.put, remove: ops.remove });
      const updatedManifest: RemoteManifest = {
        ...ops.nextManifest,
        files: { ...ops.nextManifest.files },
      };
      let uploaded = 0;
      let updated = 0;
      for (const f of ops.put) {
        store.set(f.path, f.bytes);
        if (f.remoteId) {
          updated++;
        } else {
          uploaded++;
          updatedManifest.files[f.path] = {
            ...updatedManifest.files[f.path]!,
            remoteId: `id:${f.path}`,
          };
        }
      }
      for (const p of ops.remove) store.delete(p);
      manifest = updatedManifest;
      return ok({ manifest: updatedManifest, uploaded, updated, removed: ops.remove.length });
    },
    async downloadAll() {
      return ok(new Map(store));
    },
  };
}

describe("destination / diffManifest & syncWithDestination", () => {
  it("no escribe nada cuando el contenido no cambió (cero desgaste)", async () => {
    const dest = memoryDestination();
    const files = new Map<string, Uint8Array>([
      ["app/workspaces.json", enc.encode('{"version":3}')],
      ["workspaces/w1/page.md", enc.encode("# Hola")],
    ]);

    const r1 = await syncWithDestination(dest, files, 1000);
    expect(r1.status).toBe("success");
    expect(dest.applyCalls).toHaveLength(1);
    expect(dest.applyCalls[0]!.put).toHaveLength(2);

    const r2 = await syncWithDestination(dest, files, 2000);
    expect(r2.status).toBe("unchanged");
    expect(dest.applyCalls).toHaveLength(1);
  });

  it("actualiza in-place conservando remoteId y elimina archivos huérfanos sin crear duplicados", async () => {
    const dest = memoryDestination();
    const v1 = new Map<string, Uint8Array>([
      ["a.md", enc.encode("uno")],
      ["b.md", enc.encode("dos")],
    ]);
    await syncWithDestination(dest, v1, 1000);

    const v2 = new Map<string, Uint8Array>([
      ["a.md", enc.encode("uno-editado")],
    ]);
    const r2 = await syncWithDestination(dest, v2, 2000);
    expect(r2.status).toBe("success");
    if (r2.status !== "success") throw new Error("fail");
    expect(r2.receipt.updated).toBe(1);
    expect(r2.receipt.uploaded).toBe(0);
    expect(r2.receipt.removed).toBe(1);
    expect(dest.applyCalls[1]!.put[0]!.remoteId).toBe("id:a.md");
    expect(dest.store.has("b.md")).toBe(false);
  });

  it("diffManifest preserva las entradas sin cambios", async () => {
    const files = new Map<string, Uint8Array>([["x.txt", enc.encode("igual")]]);
    const d1 = await diffManifest(files, null, 100);
    d1.nextManifest.files["x.txt"]!.remoteId = "drive-123";

    const d2 = await diffManifest(files, d1.nextManifest, 200);
    expect(d2.put).toEqual([]);
    expect(d2.remove).toEqual([]);
    expect(d2.unchangedCount).toBe(1);
    expect(d2.nextManifest.files["x.txt"]!.remoteId).toBe("drive-123");
  });

  it("respeta señal de cancelación antes de aplicar cambios", async () => {
    const dest = memoryDestination();
    const ac = new AbortController();
    const spy = vi.spyOn(dest, "applyChanges");
    ac.abort();
    const res = await syncWithDestination(dest, new Map([["a.txt", enc.encode("x")]]), 100, { signal: ac.signal });
    expect(res.status).toBe("cancelled");
    expect(spy).not.toHaveBeenCalled();
  });
});
