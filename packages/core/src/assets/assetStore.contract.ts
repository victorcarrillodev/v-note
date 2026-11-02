// T-101: suite de contrato de AssetStore (la ejecutan todos los adaptadores: memoria, nativo y web).
import { describe, it, expect, beforeEach } from "vitest";
import type { AssetStore } from "./assetStore";
import { sha256Hex } from "./hash";

const bytes = (...n: number[]) => new Uint8Array(n);

export function runAssetStoreContract(name: string, create: () => Promise<AssetStore>) {
  describe(`contrato AssetStore: ${name}`, () => {
    let store: AssetStore;
    beforeEach(async () => {
      store = await create();
    });

    it("guarda un archivo y lo devuelve idéntico, con su hash y tamaño", async () => {
      const data = bytes(1, 2, 3, 250);
      const info = await store.put(data);
      expect(info.hash).toBe(await sha256Hex(data));
      expect(info.size).toBe(4);
      expect([...((await store.get(info.hash)) as Uint8Array)]).toEqual([1, 2, 3, 250]);
    });
    it("el mismo contenido da el mismo hash y no se duplica", async () => {
      const a = await store.put(bytes(9, 9, 9));
      const b = await store.put(bytes(9, 9, 9));
      expect(a.hash).toBe(b.hash);
      expect((await store.list()).length).toBe(1);
    });
    it("contenidos distintos conviven sin sobrescribirse (aunque se llamen igual para el usuario)", async () => {
      const a = await store.put(bytes(1));
      const b = await store.put(bytes(2));
      expect(a.hash === b.hash).toBe(false);
      expect([...((await store.get(a.hash)) as Uint8Array)]).toEqual([1]);
      expect([...((await store.get(b.hash)) as Uint8Array)]).toEqual([2]);
    });
    it("un archivo vacío es válido", async () => {
      const info = await store.put(new Uint8Array(0));
      expect(info.size).toBe(0);
      expect(((await store.get(info.hash)) as Uint8Array).length).toBe(0);
    });
    it("un archivo grande (5 MB) se conserva íntegro", async () => {
      const big = new Uint8Array(5 * 1024 * 1024).map((_, i) => i % 251);
      const info = await store.put(big);
      const back = (await store.get(info.hash)) as Uint8Array;
      expect(back.length).toBe(big.length);
      expect(await sha256Hex(back)).toBe(info.hash);
    });
    it("has, get y delete sobre un hash que no existe no fallan", async () => {
      expect(await store.has("0".repeat(64))).toBe(false);
      expect(await store.get("0".repeat(64))).toBeNull();
      await store.delete("0".repeat(64)); // no debe lanzar
    });
    it("delete elimina el archivo", async () => {
      const info = await store.put(bytes(7));
      expect(await store.has(info.hash)).toBe(true);
      await store.delete(info.hash);
      expect(await store.has(info.hash)).toBe(false);
      expect(await store.get(info.hash)).toBeNull();
    });
    it("rechaza hashes con formato inválido (evita rutas maliciosas)", async () => {
      for (const bad of ["../etc/passwd", "a/b", "", "xyz", "A".repeat(64) + "/.."]) {
        await expect(store.get(bad)).rejects.toThrow();
      }
    });
    it("list devuelve todos los hashes guardados", async () => {
      const a = await store.put(bytes(1)); const b = await store.put(bytes(2));
      expect((await store.list()).sort()).toEqual([a.hash, b.hash].sort());
    });
  });
}
