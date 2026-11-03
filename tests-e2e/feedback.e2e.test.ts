// U-133 (spec 002, e2e real en Chrome): tres avisos a la vez (guardado, respaldo, recordatorio) se apilan sin taparse y sin bloquear los controles de la página.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawn, type ChildProcess } from "node:child_process";
import { resolve } from "node:path";
import { Page, launchChrome } from "./cdp";

const WEB = resolve(__dirname, "../apps/web");
const SERVER_PORT = 4195, CDP_PORT = 9355;
const BASE = `http://localhost:${SERVER_PORT}`;
let server: ChildProcess, chrome: { stop: () => void };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const clickText = (p: Page, text: string) =>
  p.eval(`(() => { const b = [...document.querySelectorAll('button')].find(b => b.innerText.trim() === ${JSON.stringify(text)}); if (!b) throw new Error('no hay «${text}»'); b.scrollIntoView({ block: 'center' }); b.click(); })()`);

beforeAll(async () => {
  server = spawn("bunx", ["vite", "--port", String(SERVER_PORT), "--strictPort"], { cwd: WEB, stdio: "ignore", detached: true });
  for (let i = 0; i < 100; i++) { try { await fetch(`${BASE}/catalog.html`); break; } catch { await sleep(200); } }
  chrome = await launchChrome(CDP_PORT);
}, 120000);
afterAll(() => { chrome?.stop(); try { if (server?.pid) process.kill(-server.pid, "SIGKILL"); } catch { /* ya terminó */ } });

describe("avisos temporales apilados en navegador real", () => {
  it("U-133: tres avisos conviven, no se tapan y los controles de la página siguen respondiendo", async () => {
    const t: any = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/new?about:blank`, { method: "PUT" })).json();
    const ws = new WebSocket(t.webSocketDebuggerUrl);
    await new Promise<void>((res) => ws.addEventListener("open", () => res()));
    const p = new (Page as any)(ws, CDP_PORT, t.id) as Page;
    await p.send("Page.enable"); await p.send("Runtime.enable");
    await p.send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
    await p.send("Page.navigate", { url: `${BASE}/catalog.html` });
    await p.waitFor("document.readyState === 'complete'", 30000);
    await p.waitFor("[...document.querySelectorAll('button')].some(b => b.innerText.trim() === 'Mostrar tres avisos')", 30000);

    await clickText(p, "Mostrar tres avisos");
    await p.waitFor("document.querySelectorAll('[data-toast-viewport] li[role=status]').length === 3", 10000);

    const layout = await p.eval<{ pointerEvents: string; stacked: boolean; count: number }>(`(() => {
      const vp = document.querySelector('[data-toast-viewport]');
      const items = [...vp.querySelectorAll('li[role=status]')];
      const rects = items.map((i) => i.getBoundingClientRect()).sort((a, b) => a.top - b.top);
      const stacked = rects.every((r, i) => i === 0 || r.top >= rects[i - 1].bottom - 0.5);
      return { pointerEvents: getComputedStyle(vp).pointerEvents, stacked, count: items.length };
    })()`);
    expect(layout.count).toBe(3);
    expect(layout.stacked).toBe(true); // no se tapan entre sí
    expect(layout.pointerEvents).toBe("none"); // el velo de los avisos no intercepta los clics de la página

    await clickText(p, "Acción de la página");
    await p.waitFor("document.querySelector('[data-page-action]').textContent.includes('1')", 5000);
    expect(await p.eval<string>("document.querySelector('[data-page-action]').textContent")).toContain("1");
    expect(await p.eval<number>("document.querySelectorAll('[data-toast-viewport] li[role=status]').length")).toBe(3); // siguen los tres
    await p.close();
  }, 60000);
});
