// Spike R-004 y R-005 (desechable): servidor de desarrollo de spikes/pulido y Chrome por CDP.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawn, type ChildProcess } from "node:child_process";
import { resolve } from "node:path";
import { Page, launchChrome } from "./cdp";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let server: ChildProcess, chrome: { stop(): void }, page: Page;
const URL_ = "http://localhost:4192/";
beforeAll(async () => {
  server = spawn(resolve(__dirname, "../apps/web/node_modules/.bin/vite"), ["--port", "4192", "--strictPort"], { cwd: resolve(__dirname, "../packages/ui/.spike-pulido"), stdio: "ignore", detached: true });
  for (let i = 0; i < 60; i++) { try { await fetch(URL_); break; } catch { await sleep(300); } }
  chrome = await launchChrome(9351);
  page = await Page.open(9351, URL_);
  await page.waitFor("document.querySelector('[data-bubble=a]')", 20000);
}, 120000);
afterAll(() => { chrome?.stop(); try { if (server.pid) process.kill(-server.pid, "SIGKILL"); } catch { /* ya terminó */ } });

const gap = () => page.eval<{ dx: number; dy: number; popX: number; popY: number; anchorVisible: boolean }>(`(() => { const r = window.__api.popRect(), e = window.__api.expectedPoint(); return { anchorVisible: e.x >= 0 && e.y >= 0 && e.x <= innerWidth && e.y <= innerHeight, dx: Math.round(r.left + r.width / 2 - e.x), dy: Math.round(r.bottom - e.y), popX: Math.round(r.left), popY: Math.round(r.top) }; })()`);

describe("R-004 menú anclado a un punto virtual", () => {
  it("sigue el zoom y el desplazamiento sin desfase", async () => {
    const results: unknown[] = [];
    results.push({ paso: "inicial", ...(await gap()) });
    for (let i = 0; i < 3; i++) {
      await page.send("Input.dispatchMouseEvent", { type: "mouseWheel", x: 500, y: 300, deltaX: 0, deltaY: -150, modifiers: 2 }); await sleep(250);
      results.push({ paso: "zoom+" + (i + 1), ...(await gap()) });
    }
    await page.drag({ x: 700, y: 500 }, { x: 560, y: 430 }); await sleep(300);
    results.push({ paso: "desplazar", ...(await gap()) });
    for (let i = 0; i < 4; i++) { await page.send("Input.dispatchMouseEvent", { type: "mouseWheel", x: 500, y: 300, deltaX: 0, deltaY: 180, modifiers: 2 }); await sleep(250); }
    results.push({ paso: "zoom-", ...(await gap()) });
    console.log("SPIKE R-004:", JSON.stringify(results));
    // Con el ancla visible, el menú queda centrado en ella y a 8 px encima, o debajo si arriba no cabe (colisión).
    for (const r of results as { dx: number; dy: number; popY: number; anchorVisible: boolean }[]) { if (!r.anchorVisible) continue; expect(Math.abs(r.dx)).toBeLessThanOrEqual(2); expect([-8, 36].includes(r.dy) || Math.abs(r.dy) <= 40).toBe(true); }
    // Hallazgo: con el ancla fuera de la ventana el menú se queda pegado al borde (hay que ocultarlo).
    expect((results as { anchorVisible: boolean }[]).some((r) => !r.anchorVisible)).toBe(true);
  }, 60000);
});

describe("R-005 clic frente a arrastre sobre un nodo con campo de texto", () => {
  it("un clic sin movimiento selecciona y abre el campo; un arrastre mayor de 5 px no", async () => {
    const c = await page.center("[data-bubble=a]");
    // clic
    await page.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: c.x, y: c.y });
    await page.send("Input.dispatchMouseEvent", { type: "mousePressed", x: c.x, y: c.y, button: "left", clickCount: 1 });
    await page.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: c.x, y: c.y, button: "left", clickCount: 1 }); await sleep(300);
    const clickState = await page.eval<{ editing: string | null; selected: string | null; focus: string }>("({ editing: window.__api.editing(), selected: window.__api.selected(), focus: document.activeElement && document.activeElement.tagName })");
    // soltar el campo y arrastrar el otro globo
    await page.eval("document.activeElement.blur()"); await sleep(100);
    const d = await page.center("[data-bubble=b]");
    await page.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: d.x, y: d.y });
    await page.send("Input.dispatchMouseEvent", { type: "mousePressed", x: d.x, y: d.y, button: "left", clickCount: 1 });
    for (let i = 1; i <= 10; i++) { await page.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: d.x + i * 6, y: d.y + i * 3, button: "left" }); await sleep(16); }
    await page.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: d.x + 60, y: d.y + 30, button: "left", clickCount: 1 }); await sleep(300);
    const dragState = await page.eval<{ editing: string | null; log: string[]; moved: boolean }>("({ editing: window.__api.editing(), log: window.__log, moved: document.querySelector('[data-bubble=b]').getBoundingClientRect().left > 0 })");
    // un movimiento de 3 px sigue siendo un clic (temblor de la mano)
    const e = await page.center("[data-bubble=b]");
    await page.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: e.x, y: e.y });
    await page.send("Input.dispatchMouseEvent", { type: "mousePressed", x: e.x, y: e.y, button: "left", clickCount: 1 });
    await page.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: e.x + 3, y: e.y + 1, button: "left" });
    await page.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: e.x + 3, y: e.y + 1, button: "left", clickCount: 1 }); await sleep(300);
    const jitter = await page.eval<{ editing: string | null; log: string[] }>("({ editing: window.__api.editing(), log: window.__log })");
    console.log("SPIKE R-005:", JSON.stringify({ clickState, dragState, jitter }));
    expect(clickState.editing).toBe("a"); expect(clickState.selected).toBe("a"); expect(clickState.focus).toBe("INPUT");
    expect(dragState.log).toContain("arrastre:b"); expect(dragState.editing).toBeNull();
    expect(jitter.editing).toBe("b");
  }, 60000);
});
