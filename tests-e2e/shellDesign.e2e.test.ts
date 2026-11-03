// U-073, U-081, U-113 (spec 002, H1, e2e real en Chrome): estado de guardado, zoom al 200 % y axe del marco, barra lateral, paleta, ajustes y bienvenida en claro y oscuro.
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Page, launchChrome } from "./cdp";

const WEB = resolve(__dirname, "../apps/web");
const SERVER_PORT = 4192, CDP_PORT = 9351;
const BASE = `http://localhost:${SERVER_PORT}/`;
const AXE = readFileSync(resolve(__dirname, "../node_modules/axe-core/axe.min.js"), "utf8");
let server: ChildProcess, chrome: { stop: () => void };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

beforeAll(async () => {
  execFileSync("bunx", ["vite", "build"], { cwd: WEB, stdio: "ignore" }); // se prueba el paquete de producción (el servidor de desarrollo no parchea los workers)
  server = spawn("bunx", ["vite", "preview", "--port", String(SERVER_PORT), "--strictPort"], { cwd: WEB, stdio: "ignore", detached: true });
  for (let i = 0; i < 100; i++) { try { await fetch(BASE); break; } catch { await sleep(200); } }
  chrome = await launchChrome(CDP_PORT);
}, 120000);
afterAll(() => { chrome?.stop(); try { if (server?.pid) process.kill(-server.pid, "SIGKILL"); } catch { /* ya terminó */ } });

const opened: Page[] = [];
// Aunque una prueba falle, se cierran las pestañas: así no queda el espacio bloqueado (bloqueo de instancia) para la siguiente.
afterEach(async () => { for (const pg of opened.splice(0)) await pg.close().catch(() => {}); });
async function open(width = 1280, height = 800) {
  const t: any = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/new?about:blank`, { method: "PUT" })).json();
  const ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise<void>((res) => ws.addEventListener("open", () => res()));
  const p = new (Page as any)(ws, CDP_PORT, t.id) as Page;
  opened.push(p);
  await p.send("Page.enable"); await p.send("Runtime.enable"); await p.send("Network.enable");
  await p.send("Network.setBypassServiceWorker", { bypass: true }); // el service worker de la PWA no interviene en esta prueba
  (p as any).ws.addEventListener("message", (m: MessageEvent) => { const d = JSON.parse(String(m.data)); if (d.method === "Runtime.exceptionThrown") { const e = d.params.exceptionDetails; console.log("EXC", e.text, e.url ?? "", e.lineNumber, (e.exception?.description ?? "").slice(0, 500)); } });
  await p.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false });
  await p.send("Page.navigate", { url: BASE });
  await p.waitFor(`location.href.startsWith(${JSON.stringify(BASE)}) && document.readyState === "complete"`, 30000);
  return p;
}
type V = { id: string; nodes: string[] };
async function axe(p: Page, label: string, theme: "light" | "dark", modal = false): Promise<V[]> {
  await p.eval(`document.documentElement.setAttribute('data-theme', '${theme}')`);
  await sleep(250);
  await p.eval(AXE);
  const r = await p.eval<V[]>(`axe.run(${modal ? `{ exclude: [['[data-aria-hidden="true"]'], ['[aria-hidden="true"]']] }` : "document"}, { runOnly: { type: 'tag', values: ['wcag2a','wcag2aa','wcag21a','wcag21aa'] } }).then(r => r.violations.filter(v => v.impact === 'serious' || v.impact === 'critical').map(v => ({ id: v.id, nodes: v.nodes.slice(0, 3).map(n => n.target.join(' ') + ' :: ' + n.html.slice(0, 110)) })))`);
  if (r.length) console.log(`AXE [${label}/${theme}]`, JSON.stringify(r, null, 1).slice(0, 2500));
  return r;
}
const clickText = (p: Page, t: string) => p.eval(`(() => { const b = [...document.querySelectorAll('button')].find(b => b.innerText.trim() === ${JSON.stringify(t)} || b.getAttribute('aria-label') === ${JSON.stringify(t)}); if (!b) throw new Error('No hay botón «${t}». Botones: ' + [...document.querySelectorAll('button')].map(x => x.innerText.trim() || x.getAttribute('aria-label')).join(' | ')); b.click(); })()`);
const NAME_INPUT = `(() => { const l = [...document.querySelectorAll('label')].find(l => l.innerText.trim() === 'Nombre del espacio'); return l && document.getElementById(l.htmlFor); })()`;
const setName = (p: Page, v: string) => p.eval(`(() => { const i = ${NAME_INPUT}; const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(i, ${JSON.stringify(v)}); i.dispatchEvent(new Event('input', { bubbles: true })); })()`);

describe("marco y navegación en navegador real", () => {
  it("U-113/U-073: bienvenida, marco, estado de guardado, paleta y ajustes sin infracciones graves en claro y oscuro", async () => {
    let p = await open();
    await p.waitFor(`!!(${NAME_INPUT})`, 30000);
    for (const th of ["light", "dark"] as const) expect(await axe(p, "bienvenida", th), `bienvenida ${th}`).toEqual([]);
    await p.close();
    // Pestaña nueva (el perfil de Chrome es compartido, así que la bienvenida sigue ahí): el resto del recorrido.
    p = await open();
    await p.waitFor(`!!(${NAME_INPUT})`, 30000);

    await p.eval(`window.__errs = []; window.addEventListener('error', e => window.__errs.push(String(e.message) + ' @ ' + e.filename + ':' + e.lineno)); window.addEventListener('unhandledrejection', e => window.__errs.push('rej:' + String(e.reason && e.reason.message || e.reason)));`);
    await setName(p, "Personal"); await sleep(400);
    await p.eval(`[...document.querySelectorAll('button')].find(b => b.innerText.trim() === 'Crear espacio').click()`);
    await p.waitFor("document.querySelector('aside nav')", 30000).catch(async (e) => { console.log("DEBUG BODY", (await p.eval<string>("document.body.innerText")).slice(0, 500), "ALERT", await p.eval<string>("document.querySelector('[role=alert]')?.innerText ?? 'ninguna'")); throw e; });
    await clickText(p, "Nueva página");
    await p.waitFor("document.querySelector('[aria-label=\"Título de la página\"]')?.value === ''");
    await p.click('[aria-label="Título de la página"]'); await p.typeText("Plan"); await p.key("Enter", "Enter", 13);
    await p.waitFor("document.querySelector('.bn-editor[contenteditable=true]')", 30000);
    await p.eval("document.querySelector('.bn-editor').focus()"); await sleep(300);

    // U-073: escribir muestra «Guardando…» y después «Guardado» en la cabecera
    const status = () => p.eval<string>("document.querySelector('header [role=status]')?.innerText ?? ''");
    await p.typeText("Texto del plan");
    await p.waitFor("document.querySelector('header [role=status]')?.innerText.includes('Guardando')", 5000).catch(() => {});
    await p.waitFor("document.querySelector('header [role=status]')?.innerText.includes('Guardado')", 15000);
    expect(await status()).toContain("Guardado");
    expect(await p.eval<string>("document.querySelector('header nav ol')?.innerText ?? ''")).toContain("Plan");

    for (const th of ["light", "dark"] as const) expect(await axe(p, "marco+página", th), `marco ${th}`).toEqual([]);

    await p.key("k", "KeyK", 75, 2); await p.waitFor("document.querySelector('[cmdk-input]')");
    for (const th of ["light", "dark"] as const) expect(await axe(p, "paleta", th, true), `paleta ${th}`).toEqual([]);
    await p.key("Escape", "Escape", 27); await sleep(300);

    await clickText(p, "Ajustes"); await p.waitFor("document.body.innerText.includes('Apariencia')");
    for (const th of ["light", "dark"] as const) expect(await axe(p, "ajustes", th), `ajustes ${th}`).toEqual([]);
    await p.close();
  }, 180000);

  it("U-081: al 200 % de zoom (640 px) las funciones del marco siguen utilizables, sin desplazamiento horizontal", async () => {
    const p = await open(640, 400);
    await p.waitFor(`!!(${NAME_INPUT}) || !!document.querySelector('header')`, 30000);
    if (await p.eval<boolean>(`!!(${NAME_INPUT})`)) {
      await setName(p, "Zoom");
      await p.eval(`[...document.querySelectorAll('button')].find(b => b.innerText.trim() === 'Crear espacio').click()`);
    }
    await p.waitFor("document.querySelector('aside nav')", 30000);
    // la barra lateral está plegada y se abre superpuesta
    expect(await p.eval<boolean>("document.querySelector('aside').hidden")).toBe(true);
    await clickText(p, "Mostrar barra lateral");
    await p.waitFor("!document.querySelector('aside').hidden");
    await clickText(p, "Nueva página");
    await p.waitFor("document.querySelector('[aria-label=\"Título de la página\"]')", 30000);
    expect(await p.eval<boolean>("document.querySelector('aside').hidden")).toBe(true); // elegir una página cierra el panel
    expect(await p.eval<boolean>("document.documentElement.scrollWidth <= window.innerWidth")).toBe(true);
    expect(await p.eval<boolean>("document.querySelector('main').scrollWidth <= document.querySelector('main').clientWidth + 1")).toBe(true);
    await p.close();
  }, 120000);
});
