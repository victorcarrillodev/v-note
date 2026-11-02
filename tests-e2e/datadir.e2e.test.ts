// T-155: sin anulaciones, la carpeta de datos es la estándar del sistema (en Linux: $XDG_DATA_HOME/<identificador>).
// Windows (%APPDATA%) y macOS (~/Library/Application Support) quedan por verificar en la matriz de CI.
import { describe, it, expect } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startApp, stopApp, runAsync, run, click, button, sleep } from "./webdriver";
import { isolatedEnv, launch, ensureWorkspace } from "./helpers";

describe("carpeta de datos por defecto (T-155)", () => {
  it("en Linux es $XDG_DATA_HOME/<appId>, sin VNOTE_DATA_DIR", async () => {
    const xdg = mkdtempSync(join(tmpdir(), "vnote-xdg-"));
    await startApp(undefined, { XDG_DATA_HOME: xdg, XDG_CONFIG_HOME: join(xdg, "cfg"), VNOTE_DATA_DIR: "", VNOTE_CONFIG_DIR: "" });
    try {
      const dirs = await runAsync<{ dataDir: string }>("const done = arguments[arguments.length-1]; window.__TAURI_INTERNALS__.invoke('app_dirs').then(done);");
      expect(dirs.dataDir).toBe(join(xdg, "dev.vnote.app"));
    } finally { await stopApp(); }
  });
});

describe("ubicación visible (T-156)", () => {
  it("la pantalla de espacios muestra la ruta actual y un botón para abrirla", async () => {
    const env = isolatedEnv();
    await launch(env);
    try {
      await ensureWorkspace();
      await click(await button("Espacios de trabajo"));
      await sleep(500);
      const text = await run<string>("return document.body.innerText");
      expect(text).toContain(join(env.VNOTE_DATA_DIR, "workspaces"));
      expect(await run<boolean>("return !![...document.querySelectorAll('button')].find(b => b.getAttribute('aria-label') === 'Abrir carpeta de Personal')")).toBe(true);
    } finally { await stopApp(); }
  });
});
