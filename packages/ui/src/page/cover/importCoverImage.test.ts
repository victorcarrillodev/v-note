// E-078 (RF-2.2, RF-2.3) y E-080 (CL-1): importar una imagen como portada.
import { describe, it, expect, vi } from "vitest";
import { MemoryAssetStore, MAX_COVER_INPUT_BYTES, ok, err, appError } from "@vnote/core";
import { importCoverImage } from "./importCoverImage";

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
const file = (bytes: Uint8Array, size = bytes.length) => ({ size, type: "image/png", name: "a.png", arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) }) as unknown as File;
const setup = (over: Partial<Parameters<typeof importCoverImage>[1]> = {}) => {
  const assets = new MemoryAssetStore();
  const setProps = vi.fn(async (_p: unknown) => ok(undefined as never));
  const optimize = vi.fn(async () => ({ jpeg: new Uint8Array([0xff, 0xd8, 0xff, 7]), sourceWidth: 2000, sourceHeight: 1000 }));
  return { assets, setProps, optimize, deps: { assets, setProps, optimize, ...over } as Parameters<typeof importCoverImage>[1] };
};

describe("importCoverImage (E-078)", () => {
  it("valida, optimiza, guarda el archivo y escribe la portada con crédito vacío", async () => {
    const { assets, setProps, optimize, deps } = setup();
    const r = await importCoverImage(file(PNG), deps);
    expect(r).toEqual({ ok: true, lowRes: false });
    expect(optimize).toHaveBeenCalledTimes(1);
    const hash = (await assets.list())[0]!;
    expect(setProps).toHaveBeenCalledWith({ cover: `asset:${hash}`, coverCredit: null });
  });
  it("un formato no admitido no toca nada", async () => {
    const { assets, setProps, optimize, deps } = setup();
    expect(await importCoverImage(file(new Uint8Array([1, 2, 3, 4])), deps)).toEqual({ ok: false, error: "unsupported" });
    expect(optimize).not.toHaveBeenCalled(); expect(setProps).not.toHaveBeenCalled(); expect(await assets.list()).toEqual([]);
  });
  it("un archivo de más de 20 MB se rechaza sin leerlo", async () => {
    const { optimize, deps } = setup();
    const big = file(PNG, MAX_COVER_INPUT_BYTES + 1);
    const read = vi.spyOn(big, "arrayBuffer");
    expect(await importCoverImage(big, deps)).toEqual({ ok: false, error: "tooLarge" });
    expect(read).not.toHaveBeenCalled(); expect(optimize).not.toHaveBeenCalled();
  });
  it("un archivo vacío se rechaza", async () => {
    expect(await importCoverImage(file(new Uint8Array(0)), setup().deps)).toEqual({ ok: false, error: "empty" });
  });
  it("una imagen dañada deja la portada anterior", async () => {
    const { setProps, assets, deps } = setup({ optimize: async () => { throw Object.assign(new Error("x"), { code: "corrupt" }); } });
    expect(await importCoverImage(file(PNG), deps)).toEqual({ ok: false, error: "corrupt" });
    expect(setProps).not.toHaveBeenCalled(); expect(await assets.list()).toEqual([]);
  });
  it("un fallo al guardar el archivo deja la portada anterior", async () => {
    const { setProps, deps } = setup();
    (deps.assets as MemoryAssetStore).put = async () => { throw new Error("disco lleno"); };
    expect(await importCoverImage(file(PNG), deps)).toEqual({ ok: false, error: "save" });
    expect(setProps).not.toHaveBeenCalled();
  });
  it("un fallo al escribir la portada se informa", async () => {
    const { deps } = setup({ setProps: async () => err(appError("STORAGE", "x")) });
    expect(await importCoverImage(file(PNG), deps)).toEqual({ ok: false, error: "save" });
  });
});

describe("aviso de baja resolución (E-080)", () => {
  it("una imagen de 300 px de ancho avisa y se guarda igual", async () => {
    const { setProps, deps } = setup({ optimize: async () => ({ jpeg: new Uint8Array([0xff, 0xd8, 0xff]), sourceWidth: 300, sourceHeight: 200 }) });
    expect(await importCoverImage(file(PNG), deps)).toEqual({ ok: true, lowRes: true });
    expect(setProps).toHaveBeenCalled();
  });
  it("1200 px ya no avisa", async () => {
    const { deps } = setup({ optimize: async () => ({ jpeg: new Uint8Array([0xff, 0xd8, 0xff]), sourceWidth: 1200, sourceHeight: 800 }) });
    expect(await importCoverImage(file(PNG), deps)).toEqual({ ok: true, lowRes: false });
  });
});
