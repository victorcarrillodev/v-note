// T-153: cerrar la ventana la oculta a la bandeja y la app sigue viva (los respaldos programados siguen corriendo).
import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { stopApp, sleep, run, runAsync } from "./webdriver";
import { isolatedEnv, launch, ensureWorkspace } from "./helpers";

const call = (cmd: string) => runAsync<unknown>(`const done = arguments[arguments.length-1]; window.__TAURI_INTERNALS__.invoke('${cmd}').then(done);`);

describe("bandeja (T-153)", () => {
  it("cerrar la ventana la oculta y la app sigue viva (reabrir desde la bandeja no se prueba aquí)", async () => {
    await launch({ ...isolatedEnv(), VNOTE_QUIT_ON_CLOSE: "", VNOTE_TICK_MS: "300" });
    try {
      await ensureWorkspace();
      expect(await call("window_visible")).toBe(true);
      // Cierre normal de la ventana (como el botón de la barra de título)
      await run("window.__TAURI_INTERNALS__.invoke('plugin:window|close', { label: 'main' }).catch(() => {}); return 1;");
      await sleep(800);
      expect(await call("window_visible")).toBe(false);
      // sigue viva: el proceso responde y el tic nativo sigue contando
      const a = Number(await call("tick_count"));
      await sleep(900);
      expect(Number(await call("tick_count"))).toBeGreaterThan(a);
    } finally {
      await stopApp();
      try { execFileSync("pkill", ["-x", "vnote-desktop"]); } catch { /* ya terminó */ }
    }
  });
});
