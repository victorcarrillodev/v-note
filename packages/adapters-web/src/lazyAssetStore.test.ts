// Adjuntos del navegador por espacio: el directorio OPFS se obtiene de forma perezosa y cada espacio tiene el suyo.
import { describe, it, expect } from "vitest";
import { LazyAssetStore } from "./lazyAssetStore";
import { OpfsAssetStore, type DirLike } from "./opfsAssetStore";

function memDir(): DirLike {
  const files = new Map<string, Uint8Array>();
  return {
    async getFileHandle(name, opts) {
      if (!files.has(name) && !opts?.create) throw Object.assign(new Error("x"), { name: "NotFoundError" });
      return {
        createWritable: async () => { let buf = new Uint8Array(); return { write: async (d: Uint8Array) => { buf = new Uint8Array(d); }, close: async () => { files.set(name, buf); } }; },
        getFile: async () => ({ arrayBuffer: async () => files.get(name)!.slice().buffer as ArrayBuffer }),
      };
    },
    async removeEntry(n) { files.delete(n); },
    async *keys() { for (const k of files.keys()) yield k; },
  };
}

describe("LazyAssetStore", () => {
  it("no pide el directorio hasta el primer uso y lo reutiliza", async () => {
    let calls = 0;
    const s = new LazyAssetStore(async () => { calls++; return new OpfsAssetStore(memDir()); });
    expect(calls).toBe(0);
    const info = await s.put(new Uint8Array([1, 2, 3]));
    expect(await s.has(info.hash)).toBe(true);
    expect([...(await s.get(info.hash))!]).toEqual([1, 2, 3]);
    expect(await s.list()).toEqual([info.hash]);
    await s.delete(info.hash);
    expect(await s.has(info.hash)).toBe(false);
    expect(calls).toBe(1);
  });
});
