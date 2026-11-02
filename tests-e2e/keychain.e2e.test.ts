// T-200 (prueba primero): el llavero REAL del sistema guarda, lee y borra (libsecret/Secret Service).
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { startApp, stopApp, find, runAsync } from "./webdriver";
import { isolatedEnv } from "./helpers";

const invoke = <T>(cmd: string, args: Record<string, unknown>) =>
  runAsync<{ ok?: T; err?: string }>(
    `const done = arguments[arguments.length-1];
     window.__TAURI_INTERNALS__.invoke(${JSON.stringify(cmd)}, ${JSON.stringify(args)}).then(v => done({ok: v}), e => done({err: String(e)}));`,
  );

beforeAll(async () => { await startApp(undefined, isolatedEnv()); await find("#root"); });
afterAll(stopApp);

describe("llavero del sistema", () => {
  it("guarda, lee y borra un secreto; borrar lo inexistente no falla", async () => {
    const a = { service: "dev.vnote.test", account: `e2e-${Date.now()}` };
    const set = await invoke("keychain_set", { ...a, secret: "ghp_de_prueba_e2e" });
    expect(set.err ?? "").not.toMatch(/Command .* not found/); // un comando inexistente es un fallo, no «llavero no disponible»
    if (set.err) { console.log("LLAVERO NO DISPONIBLE:", set.err); return; } // sin servicio: se prueba el respaldo en memoria aparte
    expect((await invoke<string | null>("keychain_get", a)).ok).toBe("ghp_de_prueba_e2e");
    expect((await invoke("keychain_delete", a)).err).toBeUndefined();
    expect((await invoke<string | null>("keychain_get", a)).ok).toBeNull();
    expect((await invoke("keychain_delete", a)).err).toBeUndefined();
  });
  it("las cuentas distintas no se mezclan", async () => {
    const base = { service: "dev.vnote.test" };
    const a = { ...base, account: `e2e-a-${Date.now()}` }, b = { ...base, account: `e2e-b-${Date.now()}` };
    const first = await invoke("keychain_set", { ...a, secret: "A" });
    expect(first.err ?? "").not.toMatch(/Command .* not found/);
    if (first.err) return;
    await invoke("keychain_set", { ...b, secret: "B" });
    expect((await invoke<string>("keychain_get", a)).ok).toBe("A");
    expect((await invoke<string>("keychain_get", b)).ok).toBe("B");
    await invoke("keychain_delete", a); await invoke("keychain_delete", b);
  });
});
