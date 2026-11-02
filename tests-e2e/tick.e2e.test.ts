// T-152: el tic nativo llega a la interfaz (aquí acelerado a 300 ms con VNOTE_TICK_MS; en producción es de un minuto).
import { describe, it, expect } from "vitest";
import { stopApp, sleep, run, runAsync } from "./webdriver";
import { isolatedEnv, launch, ensureWorkspace } from "./helpers";

describe("tic nativo (T-152)", () => {
  it("el núcleo nativo emite tics y la interfaz los recibe", async () => {
    await launch({ ...isolatedEnv(), VNOTE_TICK_MS: "300" });
    try {
      await ensureWorkspace();
      await sleep(2200);
      const received = Number(await run<string | null>("return document.documentElement.dataset.ticks ?? '0'"));
      const emitted = await runAsync<number>("const done = arguments[arguments.length-1]; window.__TAURI_INTERNALS__.invoke('tick_count').then(done);");
      expect(emitted).toBeGreaterThanOrEqual(5);
      expect(received).toBeGreaterThanOrEqual(3);
    } finally { await stopApp(); }
  });
});
