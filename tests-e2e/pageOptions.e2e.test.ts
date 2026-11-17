// Spec 005, fase 3 (e2e real en Chrome): estilo que se conserva (E-149), índice (E-150), accesibilidad del menú y del índice (E-148)
// y rendimiento del menú (E-151).
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Page } from "./cdp";
import { clickButton, ensureSpace, newPage, openFromTree, startWeb, type Web } from "./webHarness";

const AXE = readFileSync(resolve(__dirname, "../node_modules/axe-core/axe.min.js"), "utf8");
let web: Web;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
beforeAll(async () => { web = await startWeb(4197, 9357); }, 120000);
afterAll(() => web?.stop());
afterEach(async () => { await web?.closeAll(); });

const q = (s: string) => JSON.stringify(s);
const labelled = (name: string) => `(() => { const n = ${q(name)}; const ctl = [...document.querySelectorAll('button, [role=switch], [role=radio], [role=tab], select, input')]; return ctl.find(b => { if ((b.getAttribute('aria-label') ?? '').trim() === n) return true; const l = b.id ? document.querySelector('label[for="' + b.id + '"]') : null; return ((l ? l.innerText : b.innerText) ?? '').trim() === n; }); })()`;
const click = (p: Page, name: string) => p.eval(`(() => { const b = ${labelled(name)}; if (!b) throw new Error('sin control ' + ${q(name)}); b.click(); })()`);
const choose = (p: Page, label: string, value: string) => p.eval(`(() => { const s = ${labelled(label)}; const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set; set.call(s, ${q(value)}); s.dispatchEvent(new Event('change', { bubbles: true })); })()`);
const radioIn = (p: Page, group: string, name: string) => p.eval(`(() => { const g = document.querySelector('[role=radiogroup][aria-label=${q(group)}]'); const r = [...g.querySelectorAll('[role=radio]')].find(r => (r.getAttribute('aria-label') ?? r.innerText).trim().startsWith(${q(name)})); r.click(); })()`);
const openMenu = async (p: Page) => { await click(p, "Opciones de la página"); await p.waitFor("document.querySelector('[role=group][aria-label=\"Opciones de la página\"]')"); };
// Se cierra con el propio botón (alterna): Escape depende de dónde esté el foco en ese momento.
const closeMenu = async (p: Page) => { await click(p, "Opciones de la página"); await p.waitFor("!document.querySelector('[role=group][aria-label=\"Opciones de la página\"]')"); };
/** Lleva la página al principio (el editor queda desplazado tras escribir). */
const scrollTop = (p: Page) => p.eval("(() => { for (let e = document.querySelector('.bn-editor'); e; e = e.parentElement) e.scrollTop = 0; window.scrollTo(0, 0); })()");
const scopeVar = (p: Page, name: string) => p.eval<string>(`document.querySelector('[data-testid=page-style-scope]').style.getPropertyValue(${q(name)})`);
const theme = async (p: Page, t: "light" | "dark") => { await p.eval(`document.documentElement.setAttribute('data-theme', '${t}')`); await sleep(250); };
const viewport = (p: Page, width: number, height = 900) => p.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false });

/** Una tecla real (necesaria para que el editor aplique atajos como «# » o «/»). */
async function typeKeys(p: Page, text: string) {
  for (const ch of text) { await p.send("Input.dispatchKeyEvent", { type: "keyDown", key: ch, text: ch }); await p.send("Input.dispatchKeyEvent", { type: "keyUp", key: ch }); }
}
async function focusEnd(p: Page) {
  await p.eval("document.querySelector('.bn-editor').focus()");
  await p.eval("(() => { const e = document.querySelector('.bn-editor'); const r = document.createRange(); r.selectNodeContents(e.lastElementChild ?? e); r.collapse(false); const s = getSelection(); s.removeAllRanges(); s.addRange(r); })()");
}
/** Tres encabezados separados por mucho texto, para que haya desplazamiento. */
async function writeHeadings(p: Page) {
  await focusEnd(p);
  for (const name of ["Uno", "Dos", "Tres"]) {
    await typeKeys(p, `# ${name}`); await p.key("Enter", "Enter", 13);
    for (let i = 0; i < 28; i++) { await typeKeys(p, `Línea ${i}`); await p.key("Enter", "Enter", 13); }
  }
  await sleep(1200); // el índice se actualiza con un retardo de 800 ms
}

type Violation = { id: string; impact: string | null; nodes: { target: string[]; html: string }[] };
async function audit(p: Page, label: string): Promise<Violation[]> {
  await p.eval(AXE);
  const r = await p.eval<Violation[]>(`axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } }).then(r => r.violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.slice(0, 3).map(n => ({ target: n.target, html: n.html.slice(0, 160) })) })))`);
  // BlockNote deja `aria-haspopup`/`aria-autocomplete` en el editor tras usar su menú «/» (atributos propios de la biblioteca, no del
  // bloque de índice): se ignora solo esa regla sobre ese nodo.
  const bad = r.filter((v) => (v.impact === "serious" || v.impact === "critical") && !(v.id === "aria-allowed-attr" && v.nodes.every((n) => n.target.join(" ") === ".tiptap")));
  if (bad.length) console.log(`AXE [${label}]`, JSON.stringify(bad, null, 1).slice(0, 2500));
  return bad;
}

describe("el estilo elegido se conserva (E-149, RF-4.3, RF-4.5)", () => {
  it("cambiar fuente, ancho y acento, recargar y comprobar que siguen", async () => {
    const p = await web.open();
    await ensureSpace(p);
    await newPage(p, "Con estilo");
    await openMenu(p);
    await radioIn(p, "Fuente del texto", "Lora");
    await radioIn(p, "Fuente de los títulos", "Caveat");
    await choose(p, "Ancho de la página", "wide");
    await radioIn(p, "Color de acento", "Morado");
    await sleep(300);
    expect(await scopeVar(p, "--font-content")).toBe("var(--font-lora)");
    expect(await scopeVar(p, "--font-headings")).toBe("var(--font-caveat)");
    expect(await scopeVar(p, "--size-reading-width")).toBe("var(--page-width-wide)");
    expect(await scopeVar(p, "--c-accent")).toBe("var(--block-purple-text)");
    // el estilo vale solo dentro de la página: <html> no cambia
    expect(await p.eval<string>("document.documentElement.style.getPropertyValue('--font-content')")).toBe("");
    // y se aplica de verdad: el ancho medido es el de la variable (960 px)
    expect(await p.eval<number>("Math.round(document.querySelector('[data-testid=page-style-scope]').getBoundingClientRect().width)")).toBeLessThanOrEqual(960);
    await closeMenu(p);
    await sleep(2500); // el volcado a OPFS es asíncrono: se espera antes de recargar

    await p.reload();
    await p.waitFor("document.querySelector('aside nav')", 20000);
    await openFromTree(p, "Con estilo");
    expect(await scopeVar(p, "--font-content")).toBe("var(--font-lora)");
    expect(await scopeVar(p, "--font-headings")).toBe("var(--font-caveat)");
    expect(await scopeVar(p, "--size-reading-width")).toBe("var(--page-width-wide)");
    expect(await scopeVar(p, "--c-accent")).toBe("var(--block-purple-text)");
    await openMenu(p);
    expect(await p.eval<string>("document.querySelector('[role=radiogroup][aria-label=\"Fuente del texto\"] [role=radio][aria-checked=true]').innerText.trim()")).toContain("Lora");
    // otra página nueva no hereda el estilo
    await closeMenu(p);
    await newPage(p, "Sin estilo");
    expect(await scopeVar(p, "--font-content")).toBe("");
    await p.close();
  }, 180000);
});

describe("índice flotante y bloque «Índice» (E-150, RF-7.3)", () => {
  it("cada enlace lleva a su encabezado", async () => {
    const p = await web.open();
    await viewport(p, 2000);
    await ensureSpace(p);
    await newPage(p, "Con índice");
    await writeHeadings(p);

    // índice flotante (la ventana es lo bastante ancha)
    await p.waitFor("document.querySelector('[data-testid=toc-floating]')", 10000);
    await scrollTop(p); await sleep(300);
    const topOf = (title: string) => p.eval<number>(`(() => { const h = [...document.querySelectorAll('.bn-block-content[data-content-type=heading]')].find(h => h.innerText.trim() === ${q(title)}); return Math.round(h.getBoundingClientRect().top); })()`);
    expect(await topOf("Tres")).toBeGreaterThan(300); // abajo: hay que desplazar
    await p.eval("[...document.querySelectorAll('[data-testid=toc-floating] a')].find(a => a.innerText.trim() === 'Tres').click()");
    await sleep(900);
    expect(Math.abs(await topOf("Tres"))).toBeLessThan(200);
    await p.eval("[...document.querySelectorAll('[data-testid=toc-floating] a')].find(a => a.innerText.trim() === 'Uno').click()");
    await sleep(900);
    expect(Math.abs(await topOf("Uno"))).toBeLessThan(200);
    // la sección visible se marca
    expect(await p.eval<string>("document.querySelector('[data-testid=toc-floating] a[aria-current=location]')?.innerText.trim() ?? ''")).toBe("Uno");

    // bloque «Índice» desde el menú «/»
    await focusEnd(p);
    await typeKeys(p, "/"); await sleep(400); await typeKeys(p, "Índice"); await sleep(500);
    await p.key("Enter", "Enter", 13); await sleep(600);
    await p.waitFor("document.querySelector('[data-testid=toc-block]')", 10000);
    const links = await p.eval<string[]>("[...document.querySelectorAll('[data-testid=toc-block] a')].map(a => a.innerText.trim())");
    expect(links).toEqual(["Uno", "Dos", "Tres"]);
    await p.eval("[...document.querySelectorAll('[data-testid=toc-block] a')].find(a => a.innerText.trim() === 'Dos').click()");
    await sleep(900);
    expect(Math.abs(await topOf("Dos"))).toBeLessThan(200);
    await p.close();
  }, 240000);
});

describe("accesibilidad del menú completo y del índice (E-148, RNF-3)", () => {
  it("axe: sin infracciones graves, con contraste, en tema claro y oscuro", async () => {
    const p = await web.open();
    await viewport(p, 2000);
    await ensureSpace(p);
    await newPage(p, "Accesible");
    await writeHeadings(p);
    await p.waitFor("document.querySelector('[data-testid=toc-floating]')", 10000);

    for (const t of ["light", "dark"] as const) { await theme(p, t); expect(await audit(p, `página con índice flotante ${t}`)).toEqual([]); }

    await openMenu(p);
    await click(p, "Etiqueta"); await click(p, "Fecha de actualización");
    for (const t of ["light", "dark"] as const) { await theme(p, t); expect(await audit(p, `menú completo ${t}`)).toEqual([]); }
    await closeMenu(p);

    await focusEnd(p);
    await typeKeys(p, "/"); await sleep(400); await typeKeys(p, "Índice"); await sleep(500);
    await p.key("Enter", "Enter", 13); await sleep(600);
    await p.waitFor("document.querySelector('[data-testid=toc-block]')", 10000);
    await p.eval("document.activeElement?.blur()"); await sleep(400); // el menú «/» ya cerró: se suelta el foco del editor
    for (const t of ["light", "dark"] as const) { await theme(p, t); expect(await audit(p, `bloque de índice ${t}`)).toEqual([]); }

    // modo reducido (ventana estrecha)
    await viewport(p, 900);
    await sleep(400);
    for (const t of ["light", "dark"] as const) { await theme(p, t); expect(await audit(p, `índice reducido ${t}`)).toEqual([]); }
    await p.close();
  }, 240000);
});

describe("rendimiento del menú (E-151, RNF-4)", () => {
  it("abrir el menú y aplicar un cambio tardan menos de 100 ms", async () => {
    const p = await web.open();
    await ensureSpace(p);
    await newPage(p, "Rápida");
    // se mide dos veces la apertura: la primera incluye la carga de las fuentes y el montaje inicial
    const timed = (action: string, done: string) => p.eval<number>(`(async () => {
      const t0 = performance.now(); ${action}
      await new Promise((ok, fail) => { const end = performance.now() + 3000; const tick = () => { if (${done}) requestAnimationFrame(() => requestAnimationFrame(ok)); else if (performance.now() > end) fail(new Error('tiempo')); else requestAnimationFrame(tick); }; tick(); });
      return performance.now() - t0; })()`);
    const trigger = "document.querySelector('button[aria-label=\"Opciones de la página\"]').click();";
    const isOpen = "!!document.querySelector('[role=group][aria-label=\"Opciones de la página\"]')";
    const first = await timed(trigger, isOpen);
    await closeMenu(p);
    const second = await timed(trigger, isOpen);
    // aplicar un cambio: el interruptor «Fecha de actualización» muestra la fecha en la cabecera
    const sw = `(() => { const l = [...document.querySelectorAll('label')].find(l => l.innerText.trim() === 'Fecha de actualización'); return document.getElementById(l.htmlFor); })()`;
    const change = await timed(`${sw}.click();`, "!!document.querySelector('time')");
    console.log(`MEDIDA menú: primera apertura ${first.toFixed(0)} ms, siguiente ${second.toFixed(0)} ms, cambio ${change.toFixed(0)} ms`);
    expect(second).toBeLessThan(100);
    expect(change).toBeLessThan(100);
    expect(first).toBeLessThan(250); // la primera vez monta el panel y carga las fuentes
    await p.close();
  }, 120000);
});
