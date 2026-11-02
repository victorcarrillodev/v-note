// T-127, T-128 (prueba primero): adjuntar archivos al AssetStore; mismo nombre coexiste; aviso si supera el límite de respaldo.
import { describe, it, expect } from "vitest";
import { MemoryAssetStore } from "./memoryAssetStore";
import { attachFile, assetUrl, parseAssetUrl, MAX_BACKUP_FILE_BYTES } from "./attach";

const bytes = (...n: number[]) => new Uint8Array(n);

describe("attachFile", () => {
  it("guarda el contenido y devuelve una URL interna con el hash", async () => {
    const store = new MemoryAssetStore();
    const r = await attachFile(store, { name: "foto.png", data: bytes(1, 2, 3) });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.name).toBe("foto.png");
    expect(r.value.size).toBe(3);
    expect(parseAssetUrl(r.value.url)).toBe(r.value.hash);
    expect([...(await store.get(r.value.hash))!]).toEqual([1, 2, 3]);
    expect(r.value.warning).toBeNull();
  });
  it("dos adjuntos con el mismo nombre y distinto contenido coexisten (CL-21)", async () => {
    const store = new MemoryAssetStore();
    const a = await attachFile(store, { name: "nota.txt", data: bytes(1) });
    const b = await attachFile(store, { name: "nota.txt", data: bytes(2) });
    if (!a.ok || !b.ok) throw new Error("x");
    expect(a.value.hash).not.toBe(b.value.hash);
    expect((await store.list()).length).toBe(2);
    expect([...(await store.get(a.value.hash))!]).toEqual([1]);
    expect([...(await store.get(b.value.hash))!]).toEqual([2]);
  });
  it("el mismo contenido se guarda una sola vez", async () => {
    const store = new MemoryAssetStore();
    await attachFile(store, { name: "a", data: bytes(7) });
    await attachFile(store, { name: "b", data: bytes(7) });
    expect((await store.list()).length).toBe(1);
  });
  it("por encima de 100 MB avisa que no se respaldará, pero lo adjunta", async () => {
    const store = new MemoryAssetStore();
    const r = await attachFile(store, { name: "video.mp4", data: new Uint8Array(MAX_BACKUP_FILE_BYTES + 1) });
    expect(r.ok && r.value.warning).toBe("NOT_BACKED_UP");
    expect((await store.list()).length).toBe(1);
  });
  it("exactamente 100 MB no avisa", async () => {
    const r = await attachFile(new MemoryAssetStore(), { name: "x", data: new Uint8Array(MAX_BACKUP_FILE_BYTES) });
    expect(r.ok && r.value.warning).toBeNull();
  });
  it("si el almacenamiento falla (disco lleno) devuelve error sin lanzar", async () => {
    const store = new MemoryAssetStore();
    store.put = async () => { throw new Error("disco lleno"); };
    const r = await attachFile(store, { name: "a", data: bytes(1) });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("STORAGE");
  });
  it("rechaza un nombre vacío", async () => {
    const r = await attachFile(new MemoryAssetStore(), { name: "  ", data: bytes(1) });
    expect(r.ok).toBe(false);
  });
});

describe("URL interna", () => {
  it("ida y vuelta, y rechaza lo que no es un hash", () => {
    const h = "a".repeat(64);
    expect(parseAssetUrl(assetUrl(h))).toBe(h);
    expect(parseAssetUrl("https://x.com/a")).toBeNull();
    expect(parseAssetUrl("asset:../etc/passwd")).toBeNull();
  });
});
