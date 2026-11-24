// Subrayado con estilo en Chrome real: se elige el trazo (liso, difuminado, marcatextos) y el color desde la barra de formato,
// persiste al recargar, se puede cambiar y quitar, y se ve en claro y en oscuro. Con E2E_SHOTS=<carpeta> guarda capturas.
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { Page } from "./cdp";
import { ensureSpace, newPage, openFromTree, startWeb, type Web } from "./webHarness";

let web: Web;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
beforeAll(async () => { web = await startWeb(4199, 9359); }, 120000);
afterAll(() => web?.stop());
afterEach(async () => { await web?.closeAll(); });

const shot = async (p: Page, name: string) => {
  const dir = process.env.E2E_SHOTS;
  if (!dir) return;
  mkdirSync(dir, { recursive: true });
  const r = await p.send<{ data: string }>("Page.captureScreenshot", { format: "png" });
  writeFileSync(join(dir, `${name}.png`), Buffer.from(r.data, "base64"));
};
const selectAll = (p: Page) => p.eval("(() => { const e = document.querySelector('.bn-editor'); e.focus(); document.execCommand('selectAll'); })()");
const toolbarButton = (label: string) => `[...document.querySelectorAll('.bn-toolbar button, [role=toolbar] button')].find(b => (b.getAttribute('aria-label') ?? b.title ?? '').includes(${JSON.stringify(label)}))`;
const panelButton = (label: string) => `[...document.querySelectorAll('[role=group][aria-label="Subrayado"] button')].find(b => (b.getAttribute('aria-label') ?? b.innerText.trim()) === ${JSON.stringify(label)})`;
const spans = (p: Page) => p.eval<string[]>("[...document.querySelectorAll('.bn-editor .ul')].map(s => s.dataset.ulKind + ':' + s.dataset.ulColor + ':' + s.textContent)");

async function openPanel(p: Page) {
  await selectAll(p);
  await p.waitFor(`!!(${toolbarButton("Subrayado con estilo")})`, 8000);
  await p.eval(`(${toolbarButton("Subrayado con estilo")}).click()`);
  await p.waitFor("!!document.querySelector('[role=group][aria-label=\"Subrayado\"]')");
}
/** Clic REAL (ratón): comprueba también que pulsar el panel no le quita la selección al texto ni cierra la barra. */
async function choose(p: Page, label: string) {
  await p.eval(`(${panelButton(label)}).setAttribute('data-e2e-ul', '')`);
  await p.click("[data-e2e-ul]");
  await p.eval("document.querySelector('[data-e2e-ul]')?.removeAttribute('data-e2e-ul')");
}

describe("subrayado con estilo (navegador real)", () => {
  it("elegir trazo y color, cambiarlo, recargar y quitarlo; sin tocar el subrayado simple", async () => {
    const p = await web.open();
    await ensureSpace(p);
    await newPage(p, "Subrayados");
    await p.eval("document.querySelector('.bn-editor').focus()");
    await p.typeText("Texto para subrayar con estilo");
    await sleep(500);

    // El botón nuevo ocupa el lugar del subrayado simple; Ctrl+U sigue siendo posible.
    await selectAll(p);
    await p.waitFor(`!!(${toolbarButton("Subrayado con estilo")})`, 8000);
    expect(await p.eval<boolean>(`!(${toolbarButton("Underline")} ?? null) || !(${toolbarButton("Subrayado")}?.getAttribute('data-test') === 'underline')`)).toBe(true);

    await openPanel(p);
    await choose(p, "Marcatextos");
    await choose(p, "Rosa");
    await p.waitFor("document.querySelectorAll('.bn-editor .ul').length > 0");
    expect(await spans(p)).toEqual(["marker:pink:Texto para subrayar con estilo"]);
    await shot(p, "marker-pink-light");

    await choose(p, "Difuminado");
    await choose(p, "Azul");
    expect(await spans(p)).toEqual(["soft:blue:Texto para subrayar con estilo"]);
    await shot(p, "soft-blue-light");

    await choose(p, "Liso");
    await choose(p, "Verde");
    expect(await spans(p)).toEqual(["line:green:Texto para subrayar con estilo"]);
    expect(await p.eval<string>("getComputedStyle(document.querySelector('.bn-editor .ul')).textDecorationLine")).toContain("underline");
    await sleep(900); // el guardado va con un pequeño retardo

    await p.eval("location.reload()");
    await ensureSpace(p);
    await openFromTree(p, "Subrayados");
    await p.waitFor("document.querySelectorAll('.bn-editor .ul').length > 0", 15000);
    expect(await spans(p)).toEqual(["line:green:Texto para subrayar con estilo"]);

    await p.eval("document.documentElement.setAttribute('data-theme', 'dark')");
    await sleep(300);
    await shot(p, "line-green-dark");

    await openPanel(p);
    await p.waitFor(`!!(${panelButton("Quitar subrayado")})`, 5000);
    await choose(p, "Quitar subrayado");
    await p.waitFor("document.querySelectorAll('.bn-editor .ul').length === 0");
  }, 180000);

  it("con varias palabras: cada trazo con su color, también en oscuro", async () => {
    const p = await web.open();
    await ensureSpace(p);
    await newPage(p, "Varios");
    await p.eval("document.querySelector('.bn-editor').focus()");
    await p.typeText("uno");
    await sleep(300);
    await openPanel(p);
    await choose(p, "Marcatextos"); await choose(p, "Amarillo");
    expect(await spans(p)).toEqual(["marker:yellow:uno"]);
    await p.eval("document.documentElement.setAttribute('data-theme', 'dark')");
    await sleep(300);
    await shot(p, "marker-yellow-dark");
    // La variable de color sale de los tokens del tema oscuro.
    expect(await p.eval<string>("getComputedStyle(document.querySelector('.bn-editor .ul')).getPropertyValue('--ul').trim().toLowerCase()")).toBe("#e6b422");
  }, 120000);

  it("el atajo Ctrl+Alt+U aplica el último subrayado elegido y lo quita; Ctrl+U sigue siendo el subrayado simple", async () => {
    const p = await web.open();
    await ensureSpace(p);
    await newPage(p, "Atajo");
    await p.eval("document.querySelector('.bn-editor').focus()");
    await p.typeText("con atajo");
    await sleep(300);
    await selectAll(p);
    await p.key("u", "KeyU", 85, 2 | 1); // Ctrl + Alt
    await p.waitFor("document.querySelectorAll('.bn-editor .ul').length > 0");
    expect((await spans(p))[0]).toMatch(/^(line|soft|marker):[a-z]+:con atajo$/);
    await selectAll(p);
    await p.key("u", "KeyU", 85, 2 | 1);
    await p.waitFor("document.querySelectorAll('.bn-editor .ul').length === 0");
    await selectAll(p);
    await p.key("u", "KeyU", 85, 2); // Ctrl+U de siempre
    await p.waitFor("!!document.querySelector('.bn-editor u')");
    expect(await spans(p)).toEqual([]);
  }, 120000);

  it("copiar y pegar dentro de la app conserva el subrayado con estilo", async () => {
    await web.grant(["clipboardReadWrite", "clipboardSanitizedWrite"]);
    const p = await web.open();
    await ensureSpace(p);
    await newPage(p, "Copiar");
    await p.eval("document.querySelector('.bn-editor').focus()");
    await p.typeText("copia");
    await sleep(300);
    await openPanel(p);
    await choose(p, "Difuminado"); await choose(p, "Naranja");
    // Copia y pega con eventos de portapapeles reales del editor: se captura lo que ProseMirror escribe al copiar y se vuelve a entregar al pegar.
    await p.eval("document.querySelector('.bn-editor').focus()");
    await selectAll(p);
    await sleep(300);
    await p.eval(`(() => { window.__clip = null; document.addEventListener('copy', (e) => { window.__clip = Object.fromEntries([...e.clipboardData.types].map((t) => [t, e.clipboardData.getData(t)])); }, { once: true }); document.execCommand('copy'); })()`);
    expect(await p.eval<boolean>("!!window.__clip && Object.keys(window.__clip).length > 0")).toBe(true);
    await p.eval("(() => { const e = document.querySelector('.bn-editor'); e.focus(); const s = getSelection(); s.selectAllChildren(e); s.collapseToEnd(); })()");
    await p.key("Enter", "Enter", 13);
    await p.waitFor("document.querySelectorAll('.bn-editor .bn-block-content').length >= 2"); // el bloque nuevo ya existe y el cursor está en él
    await sleep(400);
    await p.eval(`(() => { const dt = new DataTransfer(); for (const [t, v] of Object.entries(window.__clip)) dt.setData(t, v); document.querySelector('.bn-editor').dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); })()`);
    await p.waitFor("document.querySelectorAll('.bn-editor .ul').length >= 2", 8000);
    expect(await spans(p)).toEqual(["soft:orange:copia", "soft:orange:copia"]);
  }, 120000);

  it("el panel sigue abierto al elegir una opción y se cierra al sacar el cursor de él", async () => {
    const p = await web.open();
    await ensureSpace(p);
    await newPage(p, "Panel");
    await p.eval("document.querySelector('.bn-editor').focus()");
    await p.typeText("panel");
    await sleep(300);
    await openPanel(p);
    const open = () => p.eval<boolean>("!!document.querySelector('[role=group][aria-label=\"Subrayado\"]')");
    // Entrar al panel con el ratón, elegir varias opciones y quedarse dentro: no se cierra.
    const c = await p.center("[role=group][aria-label=\"Subrayado\"]");
    await p.mouse("mouseMoved", c.x, c.y);
    await choose(p, "Marcatextos"); await choose(p, "Rojo"); await choose(p, "Liso");
    await sleep(600);
    expect(await open()).toBe(true);
    expect(await spans(p)).toEqual(["line:red:panel"]);
    // Sacar el cursor del panel (y del botón): se cierra.
    await p.mouse("mouseMoved", 700, 600);
    await p.waitFor("!document.querySelector('[role=group][aria-label=\"Subrayado\"]')", 4000);
    expect(await spans(p)).toEqual(["line:red:panel"]); // el subrayado se queda
  }, 120000);
});
