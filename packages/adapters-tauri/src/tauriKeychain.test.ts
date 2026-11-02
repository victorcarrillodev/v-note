// T-200 (prueba primero): adaptador de llavero sobre los comandos nativos. La integración real corre en el e2e de escritorio.
import { describe, it, expect } from "vitest";
import { TauriKeychain } from "./tauriKeychain";
import type { Invoke } from "./tauriSqlStore";

function fake(handler: (cmd: string, args: any) => unknown) {
  const calls: { cmd: string; args: unknown }[] = [];
  const invoke: Invoke = async (cmd, args) => { calls.push({ cmd, args }); return handler(cmd, args); };
  return { calls, invoke };
}

describe("TauriKeychain", () => {
  it("get/set/delete usan el servicio de la aplicación y la cuenta indicada", async () => {
    const { calls, invoke } = fake((cmd) => (cmd === "keychain_get" ? "ghp_x" : null));
    const k = new TauriKeychain(invoke, "dev.vnote.app");
    expect(await k.get("github-token:a")).toBe("ghp_x");
    await k.set("github-token:a", "ghp_y");
    await k.delete("github-token:a");
    expect(calls).toEqual([
      { cmd: "keychain_get", args: { service: "dev.vnote.app", account: "github-token:a" } },
      { cmd: "keychain_set", args: { service: "dev.vnote.app", account: "github-token:a", secret: "ghp_y" } },
      { cmd: "keychain_delete", args: { service: "dev.vnote.app", account: "github-token:a" } },
    ]);
  });
  it("si no existe devuelve null", async () => {
    expect(await new TauriKeychain(fake(() => null).invoke, "s").get("a")).toBeNull();
  });
  it("un error del lado nativo se propaga como Error (para que el almacén de token use el respaldo en memoria)", async () => {
    const k = new TauriKeychain(fake(() => { throw "No hay servicio de llavero"; }).invoke, "s");
    await expect(k.get("a")).rejects.toThrow("No hay servicio de llavero");
  });
});
