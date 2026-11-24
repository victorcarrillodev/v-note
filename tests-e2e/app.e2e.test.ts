// T-105 (prueba primero): la aplicación de escritorio completa funciona y conserva los datos entre ejecuciones.
import { describe, it, expect, beforeAll } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startApp, stopApp, find, button, byLabel, click, type, clear, findX, run, sleep } from "./webdriver";

const dir = mkdtempSync(join(tmpdir(), "vnote-e2e-"));
const env = { VNOTE_DATA_DIR: join(dir, "data"), VNOTE_CONFIG_DIR: join(dir, "config") };

describe("aplicación de escritorio", () => {
  beforeAll(() => { void sleep; });

  it("primer inicio: crear espacio y página, y editar el título", async () => {
    await startApp(undefined, env);
    try {
      await findX('//h1[normalize-space(.)="Tu cuaderno de notas, solo tuyo"]'); // pantalla de bienvenida
      await click(await byLabel("Nombre del espacio"));
      await type(await byLabel("Nombre del espacio"), "Personal");
      await click(await button("Crear espacio"));
      await click(await button("Nueva página"));
      const title = await byLabel("Título de la página");
      await click(title);
      await type(title, "Mi primera nota\uE007"); // Enter guarda el título
      await sleep(600);
      expect(await run<string>("return document.querySelector('[role=treeitem]')?.getAttribute('aria-label') ?? ''")).toBe("Mi primera nota");
    } finally {
      await stopApp();
    }
  });

  it("al reiniciar, el espacio y la página siguen ahí", async () => {
    await startApp(undefined, env);
    try {
      await find("[role=tree]", 20000);
      expect(await run<string>("return document.querySelector('[role=treeitem]')?.getAttribute('aria-label') ?? ''")).toBe("Mi primera nota");
      expect(await run<string>("return document.querySelector('aside button .truncate')?.textContent ?? ''")).toBe("Personal"); // el espacio activo, en el selector de la barra lateral
    } finally {
      await stopApp();
    }
  });
  void clear;
});
