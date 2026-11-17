// Spec 005, fase 2 (e2e real en Chrome): accesibilidad de la cabecera, el selector, los ajustes y el menú (E-112), y la portada
// de ida y vuelta (E-113) y sin red (E-114).
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Page, launchChrome } from "./cdp";

const WEB = resolve(__dirname, "../apps/web");
const SERVER_PORT = 4177, CDP_PORT = 9336;
const URL_ = `http://localhost:${SERVER_PORT}/`;
const AXE = readFileSync(resolve(__dirname, "../node_modules/axe-core/axe.min.js"), "utf8");
let server: ChildProcess, chrome: { stop: () => void };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

beforeAll(async () => {
  execFileSync("bunx", ["vite", "build"], { cwd: WEB, stdio: "ignore" });
  server = spawn("bunx", ["vite", "preview", "--port", String(SERVER_PORT), "--strictPort"], { cwd: WEB, stdio: "ignore" });
  for (let i = 0; i < 50; i++) { try { await fetch(URL_); break; } catch { await sleep(200); } }
  chrome = await launchChrome(CDP_PORT);
}, 120000);
afterAll(() => { chrome?.stop(); server?.kill("SIGKILL"); try { execFileSync("pkill", ["-f", `vite preview --port ${SERVER_PORT}`]); } catch { /* ya terminó */ } });

const SPACE_INPUT = 'input[aria-label="Nombre del espacio"]';
const q = (s: string) => JSON.stringify(s);
// Un control se identifica por su nombre accesible: `aria-label`, texto, o la etiqueta asociada (los interruptores).
const FIND = (name: string) => `(() => { const n = ${q(name)}; const ctl = [...document.querySelectorAll('button, [role=switch], [role=radio], [role=tab]')]; return ctl.find(b => { if ((b.getAttribute('aria-label') ?? '').trim() === n) return true; const l = b.id ? document.querySelector('label[for="' + b.id + '"]') : null; return ((l ? l.innerText : b.innerText) ?? '').trim() === n; }); })()`;
const clickButton = (p: Page, name: string) => p.eval(`(() => { const b = ${FIND(name)}; if (!b) throw new Error('sin control ' + ${q(name)}); b.click(); })()`);
const hasButton = (_p: Page, name: string) => `!!${FIND(name)}`;

async function openWithPage(p: Page, title: string) {
  await p.waitFor(`document.querySelector('${SPACE_INPUT}') || document.querySelector('aside nav')`, 20000);
  if (await p.eval<boolean>(`!!document.querySelector('${SPACE_INPUT}')`)) {
    await p.eval(`(() => { const i = document.querySelector('${SPACE_INPUT}'); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(i, 'Personal'); i.dispatchEvent(new Event('input', { bubbles: true })); })()`);
    await clickButton(p, "Crear espacio");
  }
  await p.waitFor("document.querySelector('aside nav')", 20000);
  await clickButton(p, "Nueva página");
  await p.waitFor("document.querySelector('[aria-label=\"Título de la página\"]')?.value === ''");
  await p.click('[aria-label="Título de la página"]'); await p.typeText(title); await p.key("Enter", "Enter", 13);
  await sleep(300);
}

/** Genera un PNG de 800×400 en la propia página y lo entrega al campo de archivo del selector (como si lo eligiera la persona). */
async function uploadCover(p: Page) {
  await clickButton(p, "Añadir portada");
  await p.waitFor(hasButton(p, "Elegir una imagen"));
  await p.eval(`(async () => {
    const c = document.createElement('canvas'); c.width = 800; c.height = 400;
    const g = c.getContext('2d'); const grad = g.createLinearGradient(0, 0, 0, 400); grad.addColorStop(0, '#d33'); grad.addColorStop(1, '#33d'); g.fillStyle = grad; g.fillRect(0, 0, 800, 400);
    const blob = await new Promise(r => c.toBlob(r, 'image/png'));
    const file = new File([blob], 'portada.png', { type: 'image/png' });
    const input = document.querySelector('input[type=file]'); const dt = new DataTransfer(); dt.items.add(file); input.files = dt.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  })()`);
  await p.waitFor("document.querySelector('[data-testid=cover] img')", 20000);
}

type Violation = { id: string; impact: string | null; nodes: { target: string[]; html: string }[] };
async function audit(p: Page, label: string): Promise<Violation[]> {
  await p.eval(AXE);
  const r = await p.eval<Violation[]>(`axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } }).then(r => r.violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.slice(0, 3).map(n => ({ target: n.target, html: n.html.slice(0, 160) })) })))`);
  const bad = r.filter((v) => v.impact === "serious" || v.impact === "critical");
  if (bad.length) console.log(`AXE [${label}]`, JSON.stringify(bad, null, 1).slice(0, 2500));
  return bad;
}

describe("accesibilidad de la cabecera, el selector y el menú (E-112, RNF-3)", () => {
  it("axe: sin infracciones graves, con contraste, en tema claro y oscuro", async () => {
    const p = await Page.open(CDP_PORT, URL_);
    try {
    await openWithPage(p, "Cabecera");
    const theme = async (t: "light" | "dark") => { await p.eval(`document.documentElement.setAttribute('data-theme', '${t}')`); await sleep(250); };
    await uploadCover(p);
    await p.key("Escape", "Escape", 27); await sleep(200);

    // Menú: se activan el título sobre la portada, la etiqueta, la fecha y la descripción para auditar la tarjeta completa.
    await clickButton(p, "Opciones de la página"); await p.waitFor(hasButton(p, "Etiqueta"));
    for (const n of ["Título sobre la portada", "Etiqueta", "Fecha de actualización", "Descripción"]) { await clickButton(p, n); await sleep(150); }
    for (const t of ["light", "dark"] as const) { await theme(t); expect(await audit(p, `menú ${t}`)).toEqual([]); }
    await p.key("Escape", "Escape", 27); await sleep(200);

    for (const t of ["light", "dark"] as const) { await theme(t); expect(await audit(p, `cabecera tarjeta ${t}`)).toEqual([]); }

    await clickButton(p, "Cambiar portada"); await p.waitFor(hasButton(p, "Elegir una imagen"));
    for (const tab of ["Subir", "Colores", "Degradados"]) {
      await clickButton(p, tab); await sleep(200);
      for (const t of ["light", "dark"] as const) { await theme(t); expect(await audit(p, `selector ${tab} ${t}`)).toEqual([]); }
    }
    await p.key("Escape", "Escape", 27); await sleep(200);

    await clickButton(p, "Ajustes de la portada"); await p.waitFor(hasButton(p, "Reposicionar"));
    for (const t of ["light", "dark"] as const) { await theme(t); expect(await audit(p, `ajustes ${t}`)).toEqual([]); }
    } finally { await p.close(); }
  }, 180000);
});

describe("portada de ida y vuelta (E-113, RF-1.1, RF-2.2, RF-3.1)", () => {
  it("subir una imagen, pasar a modo tarjeta, reposicionar, recargar y comprobar que se conserva", async () => {
    const p = await Page.open(CDP_PORT, URL_);
    try {
    await openWithPage(p, "Con portada");
    await uploadCover(p);
    expect(await p.eval<string>("document.querySelector('[data-testid=cover]').getAttribute('data-cover-kind')")).toBe("asset");
    await p.key("Escape", "Escape", 27); await sleep(200);

    await clickButton(p, "Opciones de la página"); await p.waitFor(hasButton(p, "Título sobre la portada"));
    await clickButton(p, "Título sobre la portada");
    await p.waitFor("document.querySelector('[data-testid=page-header]').getAttribute('data-mode') === 'card'");
    await p.key("Escape", "Escape", 27); await sleep(200);

    await clickButton(p, "Ajustes de la portada"); await p.waitFor(hasButton(p, "Reposicionar"));
    await clickButton(p, "Reposicionar");
    await p.waitFor("document.querySelector('[data-testid=reposition-area]')");
    for (let i = 0; i < 5; i++) await p.key("ArrowDown", "ArrowDown", 40);
    await clickButton(p, "Guardar");
    await p.waitFor("!document.querySelector('[data-testid=reposition-area]')");
    await sleep(2500); // el volcado a OPFS es asíncrono: se espera antes de recargar

    await p.reload();
    await p.waitFor("document.querySelector('aside nav')", 20000);
    await p.waitFor("document.querySelector('[role=treeitem]')", 20000);
    await p.eval("document.querySelector('[role=treeitem]').click()");
    await p.waitFor("document.querySelector('[data-testid=cover] img')", 20000);
    expect(await p.eval<string>("document.querySelector('[data-testid=page-header]').getAttribute('data-mode')")).toBe("card");
    expect(await p.eval<string>("document.querySelector('[data-testid=cover] img').style.objectPosition")).toBe("50% 55%");
    expect(await p.eval<boolean>("(() => { const i = document.querySelector('[data-testid=cover] img'); return i.complete && i.naturalWidth > 0; })()")).toBe(true);
    } finally { await p.close(); }
  }, 180000);
});

describe("sin red (E-114, RNF-1)", () => {
  it("la portada guardada se ve sin conexión", async () => {
    const p = await Page.open(CDP_PORT, URL_);
    try {
    await openWithPage(p, "Sin red");
    await uploadCover(p);
    await p.key("Escape", "Escape", 27); await sleep(300);
    await clickButton(p, "Nueva página");
    await p.waitFor("document.querySelector('[aria-label=\"Título de la página\"]')?.value === ''");
    await p.setOffline(true);
    try {
      await p.eval("[...document.querySelectorAll('[role=treeitem]')].find(e => e.getAttribute('aria-label') === 'Sin red').click()");
      await p.waitFor("document.querySelector('[data-testid=cover] img')", 20000);
      expect(await p.eval<boolean>("(() => { const i = document.querySelector('[data-testid=cover] img'); return i.src.startsWith('blob:') && i.complete && i.naturalWidth > 0; })()")).toBe(true);
    } finally { await p.setOffline(false); }
    } finally { await p.close(); }
  }, 180000);
});
