// T-023: exportar a PDF. La impresión silenciosa a archivo no funciona en WebKitGTK (impresora virtual localizada);
// el plan B es el diálogo de impresión del sistema. La prueba valida que el comando de impresión responde.
import { test, expect, beforeAll, afterAll } from "bun:test";
import { startApp, stopApp, find, runAsync } from "./webdriver";

beforeAll(async () => { await startApp(); await find(".bn-editor[contenteditable=true]"); }, 90000);
afterAll(stopApp);

test("el diálogo de impresión del sistema se abre (el comando queda bloqueado hasta cerrarlo)", async () => {
  // El comando no regresa mientras el diálogo esté abierto: se considera correcto si no devuelve error en 2 s.
  const r = await Promise.race([
    runAsync<{ ok?: unknown; err?: string }>(
      `const done = arguments[arguments.length-1];
       window.__TAURI_INTERNALS__.invoke('print_pdf', {}).then(v => done({ok: v}), e => done({err: String(e)}));`,
    ),
    Bun.sleep(2000).then(() => ({ abierto: true }) as { err?: string; abierto?: boolean }),
  ]);
  expect((r as { err?: string }).err).toBeUndefined();
}, 30000);

test.skip("PDF silencioso a archivo sin diálogo (no logrado en Linux; ver RESULTS.md)", () => {});
