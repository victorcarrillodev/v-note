// T-127, T-128: subir adjuntos al AssetStore desde el editor, resolver sus URLs internas y avisar de archivos grandes.
import { describe, it, expect, vi } from "vitest";
import { MemoryAssetStore, MAX_BACKUP_FILE_BYTES, parseAssetUrl } from "@vnote/core";
import { createFileHandlers } from "./fileHandlers";

const file = (name: string, data: number[] | Uint8Array) => new File([(data instanceof Uint8Array ? data : new Uint8Array(data)) as BlobPart], name);

describe("createFileHandlers", () => {
  it("uploadFile guarda en el almacén y devuelve una URL interna", async () => {
    const store = new MemoryAssetStore();
    const h = createFileHandlers(store, { onWarning: vi.fn(), onError: vi.fn() });
    const url = await h.uploadFile(file("a.txt", [1, 2]));
    expect(parseAssetUrl(url)).not.toBeNull();
    expect((await store.list()).length).toBe(1);
  });
  it("dos archivos con el mismo nombre dan URLs distintas", async () => {
    const h = createFileHandlers(new MemoryAssetStore(), { onWarning: vi.fn(), onError: vi.fn() });
    expect(await h.uploadFile(file("n.txt", [1]))).not.toBe(await h.uploadFile(file("n.txt", [2])));
  });
  it("avisa con el nombre cuando supera 100 MB, y aun así adjunta", async () => {
    const store = new MemoryAssetStore();
    const onWarning = vi.fn();
    const h = createFileHandlers(store, { onWarning, onError: vi.fn() });
    const url = await h.uploadFile(file("grande.bin", new Uint8Array(MAX_BACKUP_FILE_BYTES + 1)));
    expect(onWarning).toHaveBeenCalledWith("grande.bin");
    expect(parseAssetUrl(url)).not.toBeNull();
  });
  it("si falla el almacenamiento avisa del error y rechaza la subida", async () => {
    const store = new MemoryAssetStore();
    store.put = async () => { throw new Error("disco lleno"); };
    const onError = vi.fn();
    const h = createFileHandlers(store, { onWarning: vi.fn(), onError });
    await expect(h.uploadFile(file("a", [1]))).rejects.toThrow();
    expect(onError).toHaveBeenCalledWith("disco lleno");
  });
  it("resolveFileUrl convierte la URL interna en una URL de objeto y deja pasar las externas", async () => {
    const store = new MemoryAssetStore();
    const created: Blob[] = [];
    (URL as unknown as { createObjectURL: (b: Blob) => string }).createObjectURL = (b) => { created.push(b); return "blob:x"; };
    const h = createFileHandlers(store, { onWarning: vi.fn(), onError: vi.fn() });
    const url = await h.uploadFile(file("a", [9]));
    expect(await h.resolveFileUrl(url)).toBe("blob:x");
    expect(created).toHaveLength(1);
    expect(await h.resolveFileUrl("https://example.com/a.png")).toBe("https://example.com/a.png");
  });
  it("una URL interna cuyo archivo no existe se devuelve tal cual (el bloque se verá roto, sin lanzar)", async () => {
    const h = createFileHandlers(new MemoryAssetStore(), { onWarning: vi.fn(), onError: vi.fn() });
    const missing = `asset:${"b".repeat(64)}`;
    expect(await h.resolveFileUrl(missing)).toBe(missing);
  });
});
