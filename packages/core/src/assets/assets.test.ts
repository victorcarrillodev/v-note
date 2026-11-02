// T-098 (prueba primero): hash SHA-256 de contenido y adaptador en memoria.
import { describe, it, expect } from "vitest";
import { sha256Hex, isValidHash } from "./hash";
import { MemoryAssetStore } from "./memoryAssetStore";
import { runAssetStoreContract } from "./assetStore.contract";

describe("sha256Hex", () => {
  it("coincide con vectores conocidos", async () => {
    expect(await sha256Hex(new Uint8Array(0))).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    expect(await sha256Hex(new TextEncoder().encode("abc"))).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
  it("mismo contenido, mismo hash; distinto contenido, distinto hash", async () => {
    const a = await sha256Hex(new Uint8Array([1, 2, 3]));
    expect(await sha256Hex(new Uint8Array([1, 2, 3]))).toBe(a);
    expect(await sha256Hex(new Uint8Array([1, 2, 4]))).not.toBe(a);
  });
  it("valida el formato (64 hexadecimales en minúscula)", () => {
    expect(isValidHash("a".repeat(64))).toBe(true);
    for (const bad of ["", "a".repeat(63), "A".repeat(64), "g".repeat(64), "../" + "a".repeat(61)]) expect(isValidHash(bad)).toBe(false);
  });
});

runAssetStoreContract("en memoria", async () => new MemoryAssetStore());
