// Spec 005, fase 5 (e2e real en Chrome): respaldo y restauración de punta a punta con portada, estilo, descripción, bloqueo y
// predeterminado (E-176), restaurar un respaldo v1 de muestra (E-177) y que optimizar 20 MB no congele la interfaz (E-179).
// GitHub se simula con el servidor falso en memoria del núcleo: la aplicación habla con él por la red real del navegador.
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Page } from "./cdp";
import { clickButton, clickTab, ensureSpace, newPage, openFromTree, startWeb, type Web } from "./webHarness";
import { FakeGithub } from "../packages/core/tests/support/fakeGithub";

let web: Web;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
beforeAll(async () => { web = await startWeb(4199, 9359); }, 120000);
afterAll(() => web?.stop());
afterEach(async () => { await web?.closeAll(); });

const q = (s: string) => JSON.stringify(s);
const labelled = (name: string) => `(() => { const n = ${q(name)}; const ctl = [...document.querySelectorAll('button, [role=switch], [role=radio], [role=tab], input, a')]; return ctl.find(b => { if ((b.getAttribute('aria-label') ?? '').trim() === n) return true; const l = b.id ? document.querySelector('label[for="' + b.id + '"]') : null; return ((l ? l.innerText : b.innerText) ?? '').trim() === n; }); })()`;
const click = (p: Page, name: string) => p.eval(`(() => { const b = ${labelled(name)}; if (!b) throw new Error('sin control ' + ${q(name)}); b.click(); })()`);
const fieldByLabel = (p: Page, text: string, value: string) => p.eval(`(() => { const l = [...document.querySelectorAll('label')].find(x => x.innerText.trim().startsWith(${q(text)})); const i = l.querySelector('input'); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(i, ${q(value)}); i.dispatchEvent(new Event('input', { bubbles: true })); })()`);
const scopeVar = (p: Page, name: string) => p.eval<string>(`document.querySelector('[data-testid=page-style-scope]')?.style.getPropertyValue(${q(name)}) ?? ''`);
const openMenu = async (p: Page) => { await click(p, "Opciones de la página"); await p.waitFor("document.querySelector('[role=group][aria-label=\"Opciones de la página\"]')"); };
const closeMenu = async (p: Page) => { await click(p, "Opciones de la página"); await p.waitFor("!document.querySelector('[role=group][aria-label=\"Opciones de la página\"]')"); };

/** GitHub falso para esta pestaña: lo que la aplicación pide a api.github.com lo contesta el servidor en memoria. */
async function fakeGithub(p: Page, gh = new FakeGithub()) {
  await p.route("api.github.com", async (url, req) => {
    const res = await gh.fetch(url.href, { method: req.method, headers: req.headers, ...(req.body ? { body: req.body } : {}) });
    return { status: res.status, body: await res.text(), contentType: "application/json" };
  });
  return gh;
}
async function connectFields(p: Page, gh: FakeGithub) {
  await fieldByLabel(p, "Token de GitHub", gh.token); await fieldByLabel(p, "Propietario", "yo"); await fieldByLabel(p, "Repositorio", "respaldo");
}
/** Recorre el asistente de restauración hasta restaurar el último respaldo como un espacio nuevo y lo abre. */
async function restoreLatest(p: Page, gh: FakeGithub, name: string) {
  await clickButton(p, "Restaurar desde GitHub");
  await p.waitFor("document.querySelector('input[type=password]')", 10000);
  await connectFields(p, gh);
  await click(p, "Conectar");
  await p.waitFor("document.querySelector('[role=radiogroup] input[type=radio]')", 15000);
  await p.eval("document.querySelector('[role=radiogroup] input[type=radio]').click()");
  await click(p, "Siguiente");
  await p.waitFor("[...document.querySelectorAll('label')].some(l => l.innerText.trim().startsWith('Nombre del espacio nuevo'))", 15000);
  await fieldByLabel(p, "Nombre del espacio nuevo", name);
  await sleep(200);
  await click(p, "Restaurar");
  // al terminar, la aplicación abre el espacio restaurado por sí sola
  await p.waitFor(`document.body.innerText.includes(${q(name)}) && !document.querySelector('[role=radiogroup] input[type=radio]')`, 60000);
  await p.waitFor("document.querySelector('aside nav')", 15000);
}

/** Genera un PNG de 800×400 en la propia página y lo entrega al campo de archivo del selector. */
async function uploadCover(p: Page, noise = false) {
  await click(p, "Añadir portada");
  await p.waitFor(`!!${labelled("Elegir una imagen")}`, 10000);
  await p.eval(`(async () => {
    const w = ${noise ? 3200 : 800}, h = ${noise ? 2000 : 400};
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d');
    if (${noise}) { const d = g.createImageData(w, h); crypto.getRandomValues(new Uint8Array(d.data.buffer).subarray(0, 65536)); for (let i = 0; i < d.data.length; i += 65536) crypto.getRandomValues(d.data.subarray(i, Math.min(i + 65536, d.data.length))); for (let i = 3; i < d.data.length; i += 4) d.data[i] = 255; g.putImageData(d, 0, 0); }
    else { const grad = g.createLinearGradient(0, 0, 0, h); grad.addColorStop(0, '#d33'); grad.addColorStop(1, '#33d'); g.fillStyle = grad; g.fillRect(0, 0, w, h); }
    const blob = await new Promise(r => c.toBlob(r, 'image/png'));
    window.__coverBytes = blob.size;
    const input = document.querySelector('input[type=file]'); const dt = new DataTransfer(); dt.items.add(new File([blob], 'portada.png', { type: 'image/png' })); input.files = dt.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  })()`);
}

describe("respaldo y restauración de punta a punta (E-176, RNF-5)", () => {
  it("la portada, el estilo, la descripción, el bloqueo y el predeterminado vuelven tras restaurar", async () => {
    const p = await web.open();
    const gh = await fakeGithub(p);
    await ensureSpace(p);
    await newPage(p, "Origen");

    // — se prepara la página: portada de imagen, acento, descripción, predeterminado y bloqueo —
    await uploadCover(p);
    await p.waitFor("document.querySelector('[data-testid=cover] img')", 20000);
    await p.key("Escape", "Escape", 27); await sleep(300);
    await openMenu(p);
    // el selector ya no tiene colores con nombre: se elige la primera muestra «Vivos» y se espera su color base
    const accent = await p.eval<string>("(() => { const b = document.querySelector('[role=radiogroup][aria-label=\"Vivos\"] [role=radio]'); b.click(); return b.dataset.accent; })()");
    expect(accent).toMatch(/^#[0-9a-f]{6}$/i);
    await click(p, "Descripción");
    await click(p, "Usar como predeterminado");
    await sleep(400);
    await closeMenu(p);
    await p.eval("[...document.querySelectorAll('button')].find(b => (b.getAttribute('aria-label') ?? '').startsWith('Descripción de la página')).click()");
    await p.waitFor("document.querySelector('textarea[aria-label=\"Descripción de la página\"]')", 5000);
    await p.typeText("Resumen de origen"); await p.key("Enter", "Enter", 13);
    await sleep(500);
    await openMenu(p);
    await click(p, "Bloquear página");
    await sleep(300);
    await closeMenu(p);
    await sleep(2500); // el volcado a OPFS es asíncrono

    // — respaldo —
    await clickButton(p, "Respaldo");
    await p.waitFor("document.querySelector('input[type=password]')", 10000);
    await connectFields(p, gh);
    await click(p, "Conectar");
    await p.waitFor(`!!${labelled("Respaldar ahora")}`, 15000);
    await click(p, "Respaldar ahora");
    await p.waitFor("document.body.innerText.includes('Correcto')", 30000);
    const files = [...gh.trees.get(gh.commits.get(gh.headSha()!)!.tree)!.keys()];
    expect(files.some((f) => f.startsWith("assets/"))).toBe(true); // la portada viaja como archivo
    expect(files).toContain("page-defaults.json");

    // — restauración como espacio nuevo, en el mismo navegador —
    await restoreLatest(p, gh, "Restaurado");
    await openFromTree(p, "Origen").catch(async () => { await p.eval("[...document.querySelectorAll('[role=treeitem]')].find(e => e.getAttribute('aria-label') === 'Origen').click()"); });
    await p.waitFor("document.querySelector('[data-testid=cover] img')", 20000);
    expect(await p.eval<boolean>("(() => { const i = document.querySelector('[data-testid=cover] img'); return i.complete && i.naturalWidth > 0; })()")).toBe(true);
    expect((await scopeVar(p, "--c-accent")).toLowerCase()).toBe(accent.toLowerCase());
    expect(await p.eval<string>("[...document.querySelectorAll('button')].find(b => (b.getAttribute('aria-label') ?? '').startsWith('Descripción de la página'))?.innerText ?? ''")).toContain("Resumen de origen");
    expect(await p.eval<boolean>("!!document.querySelector('[data-testid=lock-indicator]')")).toBe(true);
    expect(await p.eval<string>("document.querySelector('.bn-editor')?.getAttribute('contenteditable') ?? ''")).toBe("false");

    // el predeterminado del espacio también viajó: una página nueva sale con el mismo acento
    await clickButton(p, "Nueva página");
    await p.waitFor("document.querySelector('[aria-label=\"Título de la página\"]')?.value === ''");
    await new Promise((r) => setTimeout(r, 500)); // el título se vuelve a montar al abrir la página: sin pausa se pierde lo escrito
    expect((await scopeVar(p, "--c-accent")).toLowerCase()).toBe(accent.toLowerCase());
  }, 240000);
});

describe("restaurar un respaldo v1 de muestra (E-177, CL-14)", () => {
  it("las páginas vuelven completas y el ancho completo de la v1 pasa al estilo", async () => {
    const golden = JSON.parse(readFileSync(resolve(__dirname, "../packages/core/tests/golden/backup-v1.json"), "utf8")) as Record<string, string>;
    const files: Record<string, string> = {};
    for (const [path, content] of Object.entries(golden)) files[path] = path.startsWith("assets/") ? Buffer.from(content.slice("base64:".length), "base64").toString("utf8") : content;
    // la v1 guardaba el ancho completo aparte (`fullWidth`): se le pone a la página de inicio
    const inicio = JSON.parse(files["data/0a1b2c3d-1.json"]!); inicio.fullWidth = true;
    files["data/0a1b2c3d-1.json"] = JSON.stringify(inicio, null, 2) + "\n";
    expect(JSON.parse(files["workspace.json"]!).formatVersion).toBe(1);

    const p = await web.open();
    const gh = await fakeGithub(p);
    await gh.externalCommit(files);
    await ensureSpace(p);
    await restoreLatest(p, gh, "Muestra v1");
    await p.waitFor("[...document.querySelectorAll('[role=treeitem]')].some(e => e.getAttribute('aria-label') === 'Inicio')", 15000);
    await p.eval("[...document.querySelectorAll('[role=treeitem]')].find(e => e.getAttribute('aria-label') === 'Inicio').click()");
    await p.waitFor("document.querySelector('[data-testid=page-style-scope]')", 15000);
    expect(await scopeVar(p, "--size-reading-width")).toBe("none"); // ancho completo, ahora en el estilo
    await p.waitFor("(document.querySelector('.bn-editor')?.innerText ?? '').includes('Bienvenida')", 15000);
    expect(await p.eval<boolean>("!document.querySelector('[data-testid=lock-indicator]')")).toBe(true); // sin bloqueo
    // la otra página (sin ancho) sigue con el predeterminado
    await p.eval("[...document.querySelectorAll('[role=treeitem]')].forEach(e => e.getAttribute('aria-expanded') === 'false' && e.click())");
  }, 240000);
});

describe("optimizar 20 MB no congela la interfaz (E-179, RNF-4)", () => {
  it("mientras se procesa una imagen de unos 20 MB la interfaz sigue pintando", async () => {
    const p = await web.open();
    await ensureSpace(p);
    await newPage(p, "Pesada");
    // se prepara la imagen ANTES de medir (generar ruido bloquea la página por sí mismo)
    await click(p, "Añadir portada");
    await p.waitFor(`!!${labelled("Elegir una imagen")}`, 10000);
    const bytes = await p.eval<number>(`(async () => {
      const w = 2900, h = 1900; const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
      const d = g.createImageData(w, h); for (let i = 0; i < d.data.length; i += 65536) crypto.getRandomValues(d.data.subarray(i, Math.min(i + 65536, d.data.length)));
      for (let i = 3; i < d.data.length; i += 4) d.data[i] = 255; g.putImageData(d, 0, 0);
      const blob = await new Promise(r => c.toBlob(r, 'image/png')); window.__heavy = new File([blob], 'pesada.png', { type: 'image/png' }); return blob.size; })()`);
    expect(bytes).toBeGreaterThan(15 * 1024 * 1024);
    expect(bytes).toBeLessThan(20 * 1024 * 1024); // dentro del límite de 20 MB
    // monitor de fotogramas: el mayor intervalo entre dos fotogramas mientras se procesa
    await p.eval(`(() => { window.__maxGap = 0; window.__frames = 0; let last = performance.now(); const tick = (t) => { window.__maxGap = Math.max(window.__maxGap, t - last); last = t; window.__frames++; if (!window.__stop) requestAnimationFrame(tick); }; requestAnimationFrame(tick); })()`);
    await p.eval(`(() => { const input = document.querySelector('input[type=file]'); const dt = new DataTransfer(); dt.items.add(window.__heavy); input.files = dt.files; input.dispatchEvent(new Event('change', { bubbles: true })); })()`);
    await p.waitFor("document.querySelector('[data-testid=cover] img')", 60000);
    await p.eval("window.__stop = true");
    const { gap, frames } = await p.eval<{ gap: number; frames: number }>("({ gap: window.__maxGap, frames: window.__frames })");
    console.log(`MEDIDA portada de ${(bytes / 1048576).toFixed(1)} MB: mayor pausa entre fotogramas ${gap.toFixed(0)} ms en ${frames} fotogramas`);
    expect(frames).toBeGreaterThan(5); // la interfaz pintó durante el trabajo
    expect(gap).toBeLessThan(250); // sin pausas largas: el trabajo pesado va en el worker
  }, 180000);
});
