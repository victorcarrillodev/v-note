// E-158 (RF-9.2): la clave de Unsplash vive en el llavero con la cuenta `unsplash-access-key`.
import { describe, it, expect } from "vitest";
import { MemoryKeychain, type Keychain } from "../backup/tokenStore";
import { UnsplashKeyStore } from "./keyStore";

const broken: Keychain = { get: async () => { throw new Error("sin llavero"); }, set: async () => { throw new Error("sin llavero"); }, delete: async () => { throw new Error("sin llavero"); } };

describe("UnsplashKeyStore", () => {
  it("guarda en el llavero con la cuenta `unsplash-access-key` y la recorta", async () => {
    const kc = new MemoryKeychain();
    const store = new UnsplashKeyStore(kc);
    expect(await store.set("  abc123  ")).toEqual({ ok: true, value: { persisted: true } });
    expect(await kc.get("unsplash-access-key")).toBe("abc123");
    expect(await new UnsplashKeyStore(kc).get()).toBe("abc123"); // otra sesión la lee del llavero
  });
  it("rechaza una clave vacía o con espacios", async () => {
    const store = new UnsplashKeyStore(new MemoryKeychain());
    for (const bad of ["", "   ", "a b"]) { const r = await store.set(bad); expect(r.ok).toBe(false); }
    expect(await store.get()).toBeNull();
  });
  it("sin llavero la clave vive solo en la sesión y se avisa", async () => {
    const store = new UnsplashKeyStore(broken);
    const r = await store.set("abc");
    expect(r).toMatchObject({ ok: true, value: { persisted: false } });
    expect(store.keychainAvailable).toBe(false);
    expect(await store.get()).toBe("abc");
  });
  it("sin llavero y sin clave de sesión, no hay clave", async () => {
    const store = new UnsplashKeyStore(broken);
    expect(await store.get()).toBeNull();
    expect(store.keychainAvailable).toBe(false);
  });
  it("borrar quita la clave del llavero y de la sesión, y no falla sin llavero", async () => {
    const kc = new MemoryKeychain();
    const store = new UnsplashKeyStore(kc);
    await store.set("abc");
    await store.clear();
    expect(await kc.get("unsplash-access-key")).toBeNull();
    expect(await store.get()).toBeNull();
    await expect(new UnsplashKeyStore(broken).clear()).resolves.toBeUndefined();
  });
  it("la clave de Unsplash no se mezcla con los tokens de GitHub", async () => {
    const kc = new MemoryKeychain();
    await kc.set("github-token:ws", "gh");
    await new UnsplashKeyStore(kc).set("abc");
    expect(await kc.get("github-token:ws")).toBe("gh");
  });
});
