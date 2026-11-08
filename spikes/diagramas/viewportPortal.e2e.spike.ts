import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Page } from "./cdp";
import { clickButton, ensureSpace, startWeb, type Web } from "./webHarness";
let web: Web;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
beforeAll(async () => { web = await startWeb(4181, 9340); }, 120000);
afterAll(() => web?.stop());
async function openDiagram(p: Page) {
  await ensureSpace(p); await clickButton(p, "Nueva página");
  await p.waitFor("document.querySelector('[aria-label=\"Título de la página\"]')?.value === ''");
  await p.click('[aria-label="Título de la página"]'); await p.typeText("Flujo"); await p.key("Enter", "Enter", 13);
  await p.waitFor("document.querySelector('.bn-editor[contenteditable=true]')");
  await p.eval("document.querySelector('.bn-editor').focus()"); await sleep(300);
  await p.send("Input.dispatchKeyEvent", { type: "keyDown", key: "/", text: "/" }); await p.send("Input.dispatchKeyEvent", { type: "keyUp", key: "/" });
  await sleep(400); await p.typeText("diagrama"); await sleep(500); await p.key("Enter", "Enter", 13);
  await p.waitFor("document.querySelector('[data-testid=diagram] .react-flow')", 10000);
}
describe("spike G-001", () => {
  it("la capa propia sigue el zoom y recibe eventos de puntero", async () => {
    const p = await web.open();
    await openDiagram(p);
    const rect = () => p.eval<{ x: number; y: number; w: number }>("(() => { const r = document.querySelector('[data-spike]').getBoundingClientRect(); const c = document.querySelector('[data-testid=diagram] .react-flow').getBoundingClientRect(); return { x: r.left - c.left, y: r.top - c.top, w: r.width }; })()");
    const a = await rect();
    await p.eval("document.querySelector('[data-testid=diagram] .react-flow__controls-zoomin').click()"); await sleep(500);
    const b = await rect();
    await p.eval("document.querySelector('[data-testid=diagram] .react-flow__controls-zoomin').click()"); await sleep(500);
    const c = await rect();
    console.log("SPIKE zoom:", JSON.stringify({ a, b, c }));
    expect(b.w).toBeGreaterThan(a.w); expect(c.w).toBeGreaterThan(b.w);
    // desplazamiento: arrastrar el fondo mueve también la capa
    const pane = await p.center('[data-testid=diagram] .react-flow__pane');
    await p.drag({ x: pane.x - 100, y: pane.y + 60 }, { x: pane.x - 40, y: pane.y + 100 }); await sleep(300);
    const d = await rect();
    console.log("SPIKE pan:", JSON.stringify(d));
    expect(d.x).not.toBe(c.x);
    // puntero: clic sobre la capa llega a su manejador
    const spike = await p.center('[data-spike]');
    await p.click('[data-spike]'); await sleep(200);
    const n = await p.eval<number>("window.__spike ?? 0");
    console.log("SPIKE clicks:", n, "centro", JSON.stringify(spike));
    expect(n).toBeGreaterThan(0);
  }, 90000);
});
