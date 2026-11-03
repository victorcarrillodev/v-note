// U-026, U-032, U-050, U-065 (spec 002, e2e real en Chrome): tema antes del primer pintado, respaldo tipográfico, colisión del popover y axe del catálogo con contraste.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawn, type ChildProcess } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Page, launchChrome } from "./cdp";

const WEB = resolve(__dirname, "../apps/web");
const SERVER_PORT = 4190, CDP_PORT = 9350;
const BASE = `http://localhost:${SERVER_PORT}`;
const AXE = readFileSync(resolve(__dirname, "../node_modules/axe-core/axe.min.js"), "utf8");
let server: ChildProcess, chrome: { stop: () => void };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

beforeAll(async () => {
  server = spawn("bunx", ["vite", "--port", String(SERVER_PORT), "--strictPort"], { cwd: WEB, stdio: "ignore", detached: true });
  for (let i = 0; i < 100; i++) { try { await fetch(`${BASE}/catalog.html`); break; } catch { await sleep(200); } }
  chrome = await launchChrome(CDP_PORT);
}, 120000);
afterAll(() => { chrome?.stop(); try { if (server?.pid) process.kill(-server.pid, "SIGKILL"); } catch { /* ya terminó */ } });

async function open(url: string, before?: (p: Page) => Promise<void>) {
  const t: any = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/new?about:blank`, { method: "PUT" })).json();
  const ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise<void>((res) => ws.addEventListener("open", () => res()));
  const p = new (Page as any)(ws, CDP_PORT, t.id) as Page;
  await p.send("Page.enable"); await p.send("Runtime.enable"); await p.send("Network.enable");
  await p.send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
  if (before) await before(p);
  await p.send("Page.navigate", { url });
  await p.waitFor(`location.href.startsWith(${JSON.stringify(url)}) && document.readyState === "complete"`, 30000);
  return p;
}

describe("sistema de diseño en navegador real", () => {
  it("U-026: con preferencia oscura el tema existe ANTES de montar la interfaz (sin destello claro)", async () => {
    const p = await open(`${BASE}/`, async (pg) => {
      await pg.send("Page.addScriptToEvaluateOnNewDocument", { source: `
        try { localStorage.setItem("vnote:theme", "dark"); } catch (e) {}
        window.__first = null;
        new MutationObserver(() => { if (window.__first === null) window.__first = { theme: document.documentElement.getAttribute("data-theme"), rootExists: !!document.getElementById("root") }; })
          .observe(document, { attributes: true, subtree: true, attributeFilter: ["data-theme"] });
      ` });
    });
    await p.waitFor("document.getElementById('root') && document.getElementById('root').childElementCount > 0", 30000);
    const first = await p.eval<{ theme: string; rootExists: boolean }>("window.__first");
    expect(first.theme).toBe("dark");
    expect(first.rootExists).toBe(false); // el atributo se fijó antes de que existiera la raíz de la aplicación
    expect(await p.eval<string>("document.documentElement.getAttribute('data-theme')")).toBe("dark");
    await p.close();
  }, 60000);

  it("U-032: con las fuentes bloqueadas el texto se muestra con la alternativa y el desplazamiento de diseño es < 0,1", async () => {
    const p = await open(`${BASE}/catalog.html`, async (pg) => {
      await pg.send("Network.setBlockedURLs", { urls: ["*.woff2"] });
      await pg.send("Page.addScriptToEvaluateOnNewDocument", { source: `
        window.__cls = 0;
        new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: "layout-shift", buffered: true });
      ` });
    });
    await p.waitFor("document.querySelector('h1')", 30000);
    await sleep(1500);
    expect(await p.eval<number>("window.__cls")).toBeLessThan(0.1);
    expect(await p.eval<boolean>("getComputedStyle(document.body).fontFamily.includes('system-ui')")).toBe(true);
    expect(await p.eval<boolean>("document.querySelector('h1').getBoundingClientRect().height > 0")).toBe(true);
    await p.close();
  }, 60000);

  it("U-050: un popover cerca del borde de la ventana no queda cortado", async () => {
    const p = await open(`${BASE}/catalog.html`);
    await p.send("Emulation.setDeviceMetricsOverride", { width: 700, height: 600, deviceScaleFactor: 1, mobile: false });
    await p.waitFor("[...document.querySelectorAll('button')].some(b => b.innerText.trim() === 'Abrir popover')", 30000);
    await p.eval("(() => { const b = [...document.querySelectorAll('button')].filter(b => b.innerText.trim() === 'Abrir popover').at(-1); b.scrollIntoView({block:'center', inline:'end'}); b.click(); })()");
    await p.waitFor("document.querySelector('[data-radix-popper-content-wrapper]')");
    await sleep(300);
    const r = await p.eval<{ l: number; r: number; t: number; b: number; w: number; h: number }>("(() => { const c = document.querySelector('[data-radix-popper-content-wrapper] > *').getBoundingClientRect(); return { l: c.left, r: c.right, t: c.top, b: c.bottom, w: innerWidth, h: innerHeight }; })()");
    expect(r.l).toBeGreaterThanOrEqual(0);
    expect(r.r).toBeLessThanOrEqual(r.w);
    expect(r.t).toBeGreaterThanOrEqual(0);
    expect(r.b).toBeLessThanOrEqual(r.h);
    await p.close();
  }, 60000);

  it("U-065: axe en el navegador real (con contraste) sin infracciones graves en el catálogo, en claro y en oscuro", async () => {
    const p = await open(`${BASE}/catalog.html`);
    await p.waitFor("document.querySelector('h1')", 30000);
    await sleep(800);
    await p.eval(AXE);
    const bad = await p.eval<{ id: string; nodes: string[] }[]>(`axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a','wcag2aa','wcag21a','wcag21aa'] } }).then(r => r.violations.filter(v => v.impact === 'serious' || v.impact === 'critical').map(v => ({ id: v.id, nodes: v.nodes.slice(0,4).map(n => n.target.join(' ') + ' :: ' + n.html.slice(0,100)) })))`);
    if (bad.length) console.log("AXE", JSON.stringify(bad, null, 1).slice(0, 3000));
    expect(bad).toEqual([]);

    // U-181: los avisos temporales apilados tampoco introducen infracciones, en claro y en oscuro.
    await p.eval("(() => { const b = [...document.querySelectorAll('button')].find(b => b.innerText.trim() === 'Mostrar tres avisos'); b.scrollIntoView({ block: 'center' }); b.click(); })()");
    await p.waitFor("document.querySelectorAll('[data-toast-viewport] li[role=status]').length === 3");
    for (const th of ["light", "dark"]) {
      await p.eval(`document.documentElement.setAttribute('data-theme', '${th}')`);
      await sleep(250);
      const toastBad = await p.eval<{ id: string; nodes: string[] }[]>(`axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a','wcag2aa','wcag21a','wcag21aa'] } }).then(r => r.violations.filter(v => v.impact === 'serious' || v.impact === 'critical').map(v => ({ id: v.id, nodes: v.nodes.slice(0,4).map(n => n.target.join(' ') + ' :: ' + n.html.slice(0,100)) })))`);
      if (toastBad.length) console.log("AXE TOASTS", th, JSON.stringify(toastBad, null, 1).slice(0, 2000));
      expect(toastBad, `avisos ${th}`).toEqual([]);
    }
    await p.close();
  }, 90000);
});
