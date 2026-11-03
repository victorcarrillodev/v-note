// T-145 (e2e real en Chrome): auditoría axe del shell y el editor (sin infracciones graves) y flujo completo con teclado (RNF-9).
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Page, launchChrome } from "./cdp";

const WEB = resolve(__dirname, "../apps/web");
const SERVER_PORT = 4175, CDP_PORT = 9334;
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

type Violation = { id: string; impact: string | null; help: string; nodes: { target: string[]; html: string }[] };
/** `modal`: con un diálogo modal abierto Radix marca el resto como aria-hidden (patrón estándar con foco atrapado, que se comprueba aparte en la prueba de teclado). */
async function audit(p: Page, label: string, modal = false): Promise<Violation[]> {
  await p.eval(AXE);
  const r = await p.eval<Violation[]>(`axe.run(${modal ? `{ exclude: [['[data-aria-hidden="true"]']] }` : 'document'}, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } }).then(r => r.violations.map(v => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.slice(0, 3).map(n => ({ target: n.target, html: n.html.slice(0, 160) })) })))`);
  const bad = r.filter((v) => v.impact === "serious" || v.impact === "critical");
  if (bad.length) console.log(`AXE [${label}]`, JSON.stringify(bad, null, 1).slice(0, 2500));
  return bad;
}
const clickText = (p: Page, text: string) => p.eval(`[...document.querySelectorAll('button')].find(b => b.innerText.trim() === ${JSON.stringify(text)}).click()`);
const SPACE_INPUT = 'input[aria-label="Nombre del espacio"]';

describe("accesibilidad (T-145, RNF-9)", () => {
  it("axe: sin infracciones graves en las pantallas principales", async () => {
    const p = await Page.open(CDP_PORT, URL_);
    await p.waitFor(`document.querySelector('${SPACE_INPUT}') || document.querySelector('aside nav')`, 20000);
    expect(await audit(p, "espacios")).toEqual([]);

    await p.eval(`(() => { const i = document.querySelector('${SPACE_INPUT}'); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(i, 'Personal'); i.dispatchEvent(new Event('input', { bubbles: true })); })()`);
    await clickText(p, "Crear espacio");
    await p.waitFor("document.querySelector('aside nav')", 20000);
    expect(await audit(p, "shell vacío")).toEqual([]);

    await clickText(p, "Nueva página");
    await p.waitFor("document.querySelector('[aria-label=\"Título de la página\"]')?.value === ''");
    await p.click('[aria-label="Título de la página"]'); await p.typeText("Nota de prueba"); await p.key("Enter", "Enter", 13);
    await p.waitFor("document.querySelector('.bn-editor[contenteditable=true]')");
    await p.eval("document.querySelector('.bn-editor').focus()"); await sleep(300);
    await p.typeText("Texto del editor"); await sleep(500);
    expect(await audit(p, "página con editor")).toEqual([]);

    await clickText(p, "Ajustes"); await p.waitFor("document.querySelector('select')");
    expect(await audit(p, "ajustes")).toEqual([]);

    await clickText(p, "Respaldo"); await p.waitFor("document.body.innerText.includes('Respaldo en GitHub')");
    expect(await audit(p, "respaldo")).toEqual([]);

    await p.key("k", "KeyK", 75, 2); await p.waitFor("document.querySelector('[cmdk-input]')");
    expect(await audit(p, "paleta", true)).toEqual([]);
    await p.close();
  }, 120000);

  it("axe: sin infracciones graves en papelera, base de datos, tablero y diálogo de exportar (T-416)", async () => {
    const p = await Page.open(CDP_PORT, URL_);
    await p.waitFor(`document.querySelector('${SPACE_INPUT}') || document.querySelector('aside nav')`, 20000);
    if (await p.eval<boolean>(`!!document.querySelector('${SPACE_INPUT}')`)) {
      await p.eval(`(() => { const i = document.querySelector('${SPACE_INPUT}'); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(i, 'Personal'); i.dispatchEvent(new Event('input', { bubbles: true })); })()`);
      await clickText(p, "Crear espacio");
    }
    await p.waitFor("document.querySelector('aside nav')", 20000);

    await clickText(p, "Papelera"); await p.waitFor("document.body.innerText.includes('Papelera')");
    expect(await audit(p, "papelera")).toEqual([]);

    await clickText(p, "Nueva base de datos"); await p.waitFor("[...document.querySelectorAll('button')].some(b => b.innerText.trim() === 'Nueva fila')", 20000);
    expect(await audit(p, "base de datos")).toEqual([]);

    await clickText(p, "Nuevo tablero"); await p.waitFor("document.body.innerText.includes('Por hacer')", 20000);
    expect(await audit(p, "tablero")).toEqual([]);

    await clickText(p, "Exportar"); await p.waitFor("document.querySelector('[role=alertdialog]')");
    expect(await audit(p, "exportar", true)).toEqual([]);
    await p.key("Escape", "Escape", 27);

    for (const [label, ready] of [["Grafo", "Grafo"], ["Importar", "Importar"], ["Recordatorios", "Recordatorios"], ["Restaurar desde GitHub", "Restaurar"]] as const) {
      await clickText(p, label); await p.waitFor(`[...document.querySelectorAll("main h1, main h2, h1, h2")].some(h => h.innerText.includes(${JSON.stringify(ready)}) && !h.closest("aside"))`, 20000); await sleep(400);
      expect(await audit(p, label)).toEqual([]);
    }
    await p.close();
  }, 120000);

  it("axe: editor, estados vacíos y diálogos sin infracciones graves en claro y oscuro (U-181)", async () => {
    const p = await Page.open(CDP_PORT, URL_);
    await p.waitFor(`document.querySelector('${SPACE_INPUT}') || document.querySelector('aside nav')`, 20000);
    if (await p.eval<boolean>(`!!document.querySelector('${SPACE_INPUT}')`)) {
      await p.eval(`(() => { const i = document.querySelector('${SPACE_INPUT}'); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(i, 'Personal'); i.dispatchEvent(new Event('input', { bubbles: true })); })()`);
      await clickText(p, "Crear espacio");
    }
    await p.waitFor("document.querySelector('aside nav')", 20000);
    const theme = async (t: "light" | "dark") => { await p.eval(`document.documentElement.setAttribute('data-theme', '${t}')`); await sleep(250); };

    for (const t of ["light", "dark"] as const) { await theme(t); expect(await audit(p, `shell vacío ${t}`)).toEqual([]); }

    await clickText(p, "Papelera"); await p.waitFor("document.body.innerText.includes('Papelera')");
    for (const t of ["light", "dark"] as const) { await theme(t); expect(await audit(p, `papelera vacía ${t}`)).toEqual([]); }

    await clickText(p, "Nueva página");
    await p.waitFor("document.querySelector('[aria-label=\"Título de la página\"]')?.value === ''");
    await p.click('[aria-label="Título de la página"]'); await p.typeText("Auditoría"); await p.key("Enter", "Enter", 13);
    await p.waitFor("document.querySelector('.bn-editor[contenteditable=true]')");
    await p.eval("document.querySelector('.bn-editor').focus()"); await sleep(300);
    await p.typeText("Texto para la auditoría"); await sleep(500);
    for (const t of ["light", "dark"] as const) { await theme(t); expect(await audit(p, `editor ${t}`)).toEqual([]); }

    await clickText(p, "Exportar"); await p.waitFor("document.querySelector('[role=alertdialog]')");
    for (const t of ["light", "dark"] as const) { await theme(t); expect(await audit(p, `exportar ${t}`, true)).toEqual([]); }
    await p.key("Escape", "Escape", 27);
    await p.close();
  }, 120000);

  it("teclado: abrir la paleta, buscar y abrir una página sin usar el ratón; el foco siempre es visible y navegable", async () => {
    const p = await Page.open(CDP_PORT, URL_);
    await p.waitFor(`document.querySelector('${SPACE_INPUT}') || document.querySelector('aside nav')`, 20000);
    if (await p.eval<boolean>(`!!document.querySelector('${SPACE_INPUT}')`)) {
      await p.eval(`(() => { const i = document.querySelector('${SPACE_INPUT}'); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(i, 'Personal'); i.dispatchEvent(new Event('input', { bubbles: true })); })()`);
      await clickText(p, "Crear espacio");
    }
    await p.waitFor("document.querySelector('aside nav')", 20000);
    if (!(await p.eval<boolean>("[...document.querySelectorAll('[role=treeitem]')].some(e => e.getAttribute('aria-label') === 'Nota de prueba')"))) {
      await clickText(p, "Nueva página");
      await p.waitFor("document.querySelector('[aria-label=\"Título de la página\"]')?.value === ''");
      await p.click('[aria-label="Título de la página"]'); await p.typeText("Nota de prueba"); await p.key("Enter", "Enter", 13);
      await p.waitFor("[...document.querySelectorAll('[role=treeitem]')].some(e => e.getAttribute('aria-label') === 'Nota de prueba')");
    }
    await p.key("k", "KeyK", 75, 2);
    await p.waitFor("document.querySelector('[cmdk-input]')");
    expect(await p.eval<boolean>("document.activeElement === document.querySelector('[cmdk-input]')")).toBe(true); // el foco entra en la paleta
    // El foco queda atrapado en el diálogo: Tab nunca sale de él
    for (let i = 0; i < 8; i++) {
      await p.key("Tab", "Tab", 9);
      expect(await p.eval<boolean>("!!document.activeElement.closest('[role=dialog]')"), `el foco salió de la paleta en Tab ${i}`).toBe(true);
    }
    await p.click("[cmdk-input]");
    await p.typeText("nota de");
    await p.waitFor("[...document.querySelectorAll('[cmdk-list] [role=option]')].some(o => o.textContent.includes('Nota de prueba'))", 10000);
    await p.key("ArrowDown", "ArrowDown", 40);
    await p.key("Enter", "Enter", 13);
    await p.waitFor("document.querySelector('[aria-label=\"Título de la página\"]')?.value === 'Nota de prueba'", 10000);
    expect(await p.eval<boolean>("!document.querySelector('[cmdk-input]')")).toBe(true); // la paleta se cerró
    // Tab recorre controles reales sin perder el foco; al terminar el ciclo sale al navegador (BODY) y vuelve al primero
    const desc = () => p.eval<string>("(() => { const a = document.activeElement; return a ? a.tagName + ':' + (a.getAttribute('aria-label') || a.innerText || a.id || '').slice(0, 30) : 'none'; })()");
    const seen: string[] = [];
    for (let i = 0; i < 80; i++) {
      await p.key("Tab", "Tab", 9);
      const d = await desc();
      if (d.startsWith("BODY") || d === "none") break;
      seen.push(d);
    }
    expect(new Set(seen).size, `controles alcanzados con Tab: ${seen.join(" | ")}`).toBeGreaterThan(8);
    await p.key("Tab", "Tab", 9);
    expect(await desc()).toBe(seen[0]); // el ciclo se cierra en el primer control (el enlace «Saltar al contenido»)
    await p.close();
  }, 90000);
});
