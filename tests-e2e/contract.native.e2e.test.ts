// T-095 (prueba primero): la suite de contrato de SqlStore pasa completa contra el adaptador nativo, dentro del webview real.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { startApp, stopApp, goto, find, runAsync, run } from "./webdriver";

beforeAll(async () => {
  await startApp();
  await find("#root, #out");
}, 120_000);
afterAll(stopApp);

describe("contrato SqlStore nativo (Tauri + rusqlite)", () => {
  it("todas las pruebas del contrato pasan", async () => {
    await goto("tauri://localhost/contract.html");
    await find("#out");
    const results = await runAsync<{ name: string; ok: boolean; error?: string }[]>(
      `const done = arguments[arguments.length-1];
       (function wait(){ window.__contractResult ? done(window.__contractResult) : setTimeout(wait, 100); })();`,
    );
    const failed = results.filter((r) => !r.ok);
    expect(results.length).toBeGreaterThanOrEqual(17);
    expect(results.some((r) => r.name.includes("AssetStore"))).toBe(true);
    expect(failed).toEqual([]);
    console.log(`Contrato nativo: ${results.length} pruebas pasaron`);
    void run;
  });
});
