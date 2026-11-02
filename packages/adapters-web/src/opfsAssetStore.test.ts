// T-100 (prueba primero): AssetStore sobre OPFS. En Node se usa un directorio simulado con la misma interfaz mínima que OPFS;
// la verificación contra el OPFS real del navegador se hace en el e2e web.
import { describe, it, expect } from "vitest";
import { runAssetStoreContract } from "@vnote/core/src/assets/assetStore.contract";
import { OpfsAssetStore, type DirLike } from "./opfsAssetStore";

class MemDir implements DirLike {
  files = new Map<string, Uint8Array>();
  failNextWrite = false;
  async getFileHandle(name: string, opts?: { create?: boolean }) {
    if (!this.files.has(name) && !opts?.create) throw Object.assign(new Error("no existe"), { name: "NotFoundError" });
    return {
      createWritable: async () => {
        const chunks: Uint8Array[] = [];
        return {
          write: async (d: Uint8Array) => { chunks.push(new Uint8Array(d)); },
          close: async () => {
            if (this.failNextWrite) { this.failNextWrite = false; throw new Error("disco lleno"); }
            const total = chunks.reduce((n, c) => n + c.length, 0);
            const out = new Uint8Array(total);
            let o = 0;
            for (const c of chunks) { out.set(c, o); o += c.length; }
            this.files.set(name, out);
          },
        };
      },
      getFile: async () => ({ arrayBuffer: async () => { const f = this.files.get(name)!; return f.buffer.slice(f.byteOffset, f.byteOffset + f.byteLength) as ArrayBuffer; } }),
    };
  }
  async removeEntry(name: string) {
    if (!this.files.has(name)) throw Object.assign(new Error("no existe"), { name: "NotFoundError" });
    this.files.delete(name);
  }
  async *keys() { for (const k of this.files.keys()) yield k; }
}

runAssetStoreContract("OPFS (directorio simulado)", async () => new OpfsAssetStore(new MemDir()));

describe("OpfsAssetStore (T-100)", () => {
  it("guarda y lee un archivo", async () => {
    const s = new OpfsAssetStore(new MemDir());
    const info = await s.put(new TextEncoder().encode("hola"));
    expect(new TextDecoder().decode((await s.get(info.hash)) as Uint8Array)).toBe("hola");
  });
  it("si falla la escritura (disco lleno) el error se propaga y no queda un archivo a medias", async () => {
    const d = new MemDir();
    d.failNextWrite = true;
    await expect(new OpfsAssetStore(d).put(new Uint8Array([1, 2, 3]))).rejects.toThrow("disco lleno");
    expect(d.files.size).toBe(0);
  });
});
