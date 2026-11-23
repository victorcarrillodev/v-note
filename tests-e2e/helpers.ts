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

/** Abre un `Dropdown` (disparador por selector CSS) con el puntero y pulsa la opción de ese valor. Equivale a asignar `select.value` en el `<select>` nativo que reemplazó. */
export async function chooseOption(triggerSelector: string, value: string): Promise<void> {
  await run("document.querySelector(arguments[0]).dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerType: 'mouse' }));", [triggerSelector]);
  await sleep(300);
  await run("document.querySelector('[role=menuitemradio][data-value=' + JSON.stringify(arguments[0]) + ']').click();", [value]);
  await sleep(250);
}

/** Igual, pero el disparador es el `Dropdown` dentro de la primera etiqueta que empieza con `labelStart` (dentro de `scope`, si se da). */
export async function chooseByLabel(labelStart: string, value: string, scope = ""): Promise<void> {
  await run("const l = [...document.querySelectorAll(arguments[1] + ' label')].find(x => x.innerText.trim().startsWith(arguments[0])); l.querySelector('[role=combobox]').setAttribute('data-e2e-pick', '1');", [labelStart, scope]);
  await chooseOption("[data-e2e-pick='1']", value);
  await run("document.querySelectorAll('[data-e2e-pick]').forEach(e => e.removeAttribute('data-e2e-pick'));");
}

/** Elige `value` en el primer `Dropdown` de la página que lo ofrezca (abre cada uno y cierra los que no lo tienen). */
export async function chooseAny(value: string): Promise<void> {
  const n = await run<number>("return document.querySelectorAll('[role=combobox]').length");
  for (let i = 0; i < n; i++) {
    await run("document.querySelectorAll('[role=combobox]')[arguments[0]].dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerType: 'mouse' }));", [i]);
    await sleep(250);
    const has = await run<boolean>("return !!document.querySelector('[role=menuitemradio][data-value=' + JSON.stringify(arguments[0]) + ']')", [value]);
    if (has) { await run("document.querySelector('[role=menuitemradio][data-value=' + JSON.stringify(arguments[0]) + ']').click();", [value]); await sleep(250); return; }
    await run("document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));"); await sleep(150);
  }
  throw new Error(`Ningún desplegable ofrece «${value}»`);
}
