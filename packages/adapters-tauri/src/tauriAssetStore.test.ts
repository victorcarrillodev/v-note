// T-099 (prueba primero): adaptador AssetStore de Tauri con un `invoke` simulado. El contrato real corre en la app (e2e).
import { describe, it, expect } from "vitest";
import { TauriAssetStore } from "./tauriAssetStore";
import type { Invoke } from "./tauriSqlStore";

type Call = { cmd: string; args: unknown; options?: unknown };
function fake(handler: (c: Call) => unknown) {
  const calls: Call[] = [];
  const invoke: Invoke = async (cmd, args, options) => {
    calls.push({ cmd, args, options });
    return handler({ cmd, args, options });
  };
  return { calls, invoke };
}
const H = "a".repeat(64);

describe("TauriAssetStore", () => {
  it("put envía los bytes en crudo con la carpeta en una cabecera codificada", async () => {
    const { calls, invoke } = fake(() => ({ hash: H, size: 3 }));
    const s = new TauriAssetStore(invoke, "/datos/Mi espacio ñ/assets");
    const info = await s.put(new Uint8Array([1, 2, 3]));
    expect(info).toEqual({ hash: H, size: 3 });
    expect(calls[0]!.cmd).toBe("asset_put");
    expect(calls[0]!.args).toEqual(new Uint8Array([1, 2, 3]));
    expect(calls[0]!.options).toEqual({ headers: { "x-root": encodeURIComponent("/datos/Mi espacio ñ/assets") } });
  });
  it("get devuelve los bytes, y null si no existe", async () => {
    const found = fake(() => new Uint8Array([9, 8]).buffer);
    expect([...((await new TauriAssetStore(found.invoke, "/r").get(H)) as Uint8Array)]).toEqual([9, 8]);
    const missing = fake(() => { throw "NOT_FOUND"; });
    expect(await new TauriAssetStore(missing.invoke, "/r").get(H)).toBeNull();
  });
  it("otros errores del lado nativo se propagan", async () => {
    const { invoke } = fake(() => { throw "permiso denegado"; });
    await expect(new TauriAssetStore(invoke, "/r").get(H)).rejects.toThrow("permiso denegado");
  });
  it("rechaza hashes inválidos sin llamar al lado nativo", async () => {
    const { calls, invoke } = fake(() => null);
    const s = new TauriAssetStore(invoke, "/r");
    await expect(s.get("../x")).rejects.toThrow();
    await expect(s.has("")).rejects.toThrow();
    await expect(s.delete("zz")).rejects.toThrow();
    expect(calls).toEqual([]);
  });
  it("has, delete y list usan sus comandos", async () => {
    const { calls, invoke } = fake(({ cmd }) => (cmd === "asset_has" ? true : cmd === "asset_list" ? [H] : null));
    const s = new TauriAssetStore(invoke, "/r");
    expect(await s.has(H)).toBe(true);
    await s.delete(H);
    expect(await s.list()).toEqual([H]);
    expect(calls.map((c) => c.cmd)).toEqual(["asset_has", "asset_delete", "asset_list"]);
  });
});
