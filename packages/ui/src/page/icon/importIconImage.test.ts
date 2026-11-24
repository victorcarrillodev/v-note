import { describe, it, expect, vi } from "vitest";
import { MemoryAssetStore, parseIcon, ok, err, appError } from "@vnote/core";
import { importIconImage } from "./importIconImage";

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0, 1, 2, 3, 4]);
const small = new Uint8Array([9, 9, 9]);
const file = (b: Uint8Array) => new Blob([b as BlobPart]);

describe("subir una imagen como ícono", () => {
  it("guarda la imagen reducida en el almacén y escribe `asset:<hash>` en el ícono", async () => {
    const assets = new MemoryAssetStore();
    const setIcon = vi.fn(async (_icon: string) => ok(undefined));
    const r = await importIconImage(file(PNG), { assets, setIcon, encode: async () => small });
    expect(r).toEqual({ ok: true });
    const icon = setIcon.mock.calls[0]![0];
    const parsed = parseIcon(icon);
    expect(parsed?.kind).toBe("image");
    expect(await assets.get((parsed as { hash: string }).hash)).toEqual(small);
  });
  it("un archivo que no es imagen no cambia nada", async () => {
    const assets = new MemoryAssetStore(); const setIcon = vi.fn();
    expect(await importIconImage(file(new Uint8Array([1, 2, 3, 4])), { assets, setIcon, encode: async () => small })).toEqual({ ok: false, error: "unsupported" });
    expect(await importIconImage(file(new Uint8Array()), { assets, setIcon, encode: async () => small })).toEqual({ ok: false, error: "empty" });
    expect(setIcon).not.toHaveBeenCalled();
    expect(await assets.list()).toEqual([]);
  });
  it("una imagen que no se puede decodificar es «dañada» y no cambia nada", async () => {
    const setIcon = vi.fn();
    const r = await importIconImage(file(PNG), { assets: new MemoryAssetStore(), setIcon, encode: async () => { throw new Error("x"); } });
    expect(r).toEqual({ ok: false, error: "corrupt" });
    expect(setIcon).not.toHaveBeenCalled();
  });
  it("si no se puede escribir el ícono, informa «save»", async () => {
    const r = await importIconImage(file(PNG), { assets: new MemoryAssetStore(), setIcon: async () => err(appError("STORAGE", "no")), encode: async () => small });
    expect(r).toEqual({ ok: false, error: "save" });
  });
});
