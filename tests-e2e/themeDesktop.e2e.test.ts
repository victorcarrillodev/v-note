// U-027 (spec 002, e2e de escritorio real): al reabrir con tema oscuro guardado, el tema se fija con el script de arranque
// —síncrono y anterior al módulo de la aplicación—, así que no hay destello claro antes del primer pintado.
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { resolve } from "node:path";
import { stopApp, run, sleep, windowHandles, switchWindow } from "./webdriver";
import { isolatedEnv, launch } from "./helpers";

// El binario de depuración carga la interfaz desde el servidor de desarrollo (localhost:1430).
const DESKTOP = resolve(__dirname, "../apps/desktop");
let server: ChildProcess | undefined;

beforeAll(async () => {
  server = spawn("bunx", ["vite", "--port", "1430", "--strictPort"], { cwd: DESKTOP, stdio: "ignore", detached: true });
  for (let i = 0; i < 100; i++) {
    try { await fetch("http://localhost:1430/"); return; } catch { await sleep(200); }
  }
}, 120000);
afterAll(() => { try { if (server?.pid) process.kill(-server.pid, "SIGKILL"); } catch { /* ya terminó */ } });

afterEach(async () => {
  await stopApp();
  try { execFileSync("pkill", ["-x", "vnote-desktop"]); } catch { /* ya terminó */ }
});

/** Espera a que el webview muestre la aplicación y elige su ventana (el driver arranca en una ventana en blanco). */
async function waitForApp() {
  for (let i = 0; i < 60; i++) {
    for (const h of await windowHandles().catch(() => [] as string[])) {
      await switchWindow(h).catch(() => {});
      const href = await run<string>("return location.href;").catch(() => "");
      if (href && href !== "about:blank" && href.startsWith("http")) return;
    }
    await sleep(500);
  }
}

describe("tema antes del primer pintado en escritorio (U-027, RF-2.4)", () => {
  it("con la preferencia oscura guardada, el tema existe antes del primer pintado y el esquema de color es oscuro", async () => {
    const env = isolatedEnv();
    await launch(env);
    await waitForApp();
    expect(await run<unknown>("localStorage.setItem('vnote:theme', 'dark'); return 1;")).toBe(1);
    await sleep(500);
    await stopApp();
    await sleep(1200); // deja cerrar el proceso y volcar el almacenamiento del webview

    await launch(env);
    await waitForApp();

    const info = await run<{ theme: string | null; bootIndex: number; moduleIndex: number; canvas: string }>(`
      var scripts = [].slice.call(document.head.querySelectorAll('script'));
      var boot = scripts.findIndex(function (s) { return !s.src && s.textContent.indexOf('data-theme') >= 0; });
      var mod = scripts.findIndex(function (s) { return !!s.src; });
      return {
        theme: document.documentElement.getAttribute('data-theme'),
        bootIndex: boot,
        moduleIndex: mod,
        canvas: getComputedStyle(document.documentElement).getPropertyValue('--c-canvas').trim()
      };
    `);

    expect(info.theme).toBe("dark");
    expect(info.bootIndex).toBe(0); // el script de arranque es el primero del <head>
    expect(info.moduleIndex).toBeGreaterThan(info.bootIndex); // y corre antes de cargar la aplicación    expect(info.canvas.toLowerCase()).toBe("#131313"); // el lienzo oscuro ya está activo en el primer pintado
  }, 180_000);
});
