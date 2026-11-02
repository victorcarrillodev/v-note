// Ayudantes comunes de los e2e de escritorio.
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startApp, find, button, byLabel, click, type, run, sleep } from "./webdriver";

const ENTER = String.fromCharCode(0xe007); // tecla Enter de WebDriver

export function isolatedEnv() {
  const dir = mkdtempSync(join(tmpdir(), "vnote-e2e-"));
  // VNOTE_QUIT_ON_CLOSE hace que cerrar la ventana termine el proceso (sin bandeja), para que las pruebas no dejen procesos vivos.
  // XDG_DATA_HOME aísla también el almacenamiento del webview (localStorage: idioma, tema, atajos) para que las pruebas no se contaminen entre sí ni toquen datos reales.
  return { VNOTE_DATA_DIR: join(dir, "data"), VNOTE_CONFIG_DIR: join(dir, "config"), XDG_DATA_HOME: join(dir, "xdg-data"), VNOTE_QUIT_ON_CLOSE: "1" };
}

export async function launch(env: Record<string, string>) {
  await startApp(undefined, env);
}

/** Crea el espacio «Personal» si la app está en el primer inicio. */
export async function ensureWorkspace() {
  const needsCreate = await run<boolean>("return !!document.querySelector('[aria-label=\"Nombre del espacio\"]')").catch(() => false);
  await sleep(300);
  if (await run<boolean>("return !!document.querySelector('[aria-label=\"Nombre del espacio\"]')")) {
    await type(await byLabel("Nombre del espacio"), "Personal");
    await click(await button("Crear espacio"));
  }
  void needsCreate;
  await find("aside nav", 20000);
}

export async function newPage(title?: string) {
  await click(await button("Nueva página"));
  // Espera a que la página recién creada sea la abierta (título vacío) antes de escribir:
  // si no, las primeras teclas caen en el título de la página anterior.
  for (let i = 0; i < 80; i++) {
    const v = await run<string | null>("const i = document.querySelector('[aria-label=\"Título de la página\"]'); return i && i.value === '' ? 'vacio' : null");
    if (v === "vacio") break;
    await sleep(100);
  }
  const t = await byLabel("Título de la página");
  if (title) { await click(t); await type(t, title + ENTER); await sleep(300); }
}

export async function editorEl() {
  return find(".bn-editor[contenteditable=true]", 20000);
}

export const editorText = () => run<string>("return document.querySelector('.bn-editor')?.innerText ?? ''");
export const treeTitles = () => run<string[]>("return [...document.querySelectorAll('[role=treeitem]')].map(e => e.getAttribute('aria-label'))");
