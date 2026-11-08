// T-337 (rendimiento con 500 elementos, RNF-3) y T-338 (accesibilidad del lienzo, RNF-9) — e2e real en Chrome.
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Page } from "./cdp";
import { clickButton, ensureSpace, startWeb, type Web } from "./webHarness";

let web: Web;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const AXE = readFileSync(resolve(__dirname, "../node_modules/axe-core/axe.min.js"), "utf8");
beforeAll(async () => { web = await startWeb(4180, 9339); }, 120000);
afterAll(() => web?.stop());
afterEach(async () => { await web?.closeAll(); });

async function openDiagram(p: Page) {
  await ensureSpace(p);
  await clickButton(p, "Nueva página");
  await p.waitFor("document.querySelector('[aria-label=\"Título de la página\"]')?.value === ''");
  await p.click('[aria-label="Título de la página"]'); await p.typeText("Grande"); await p.key("Enter", "Enter", 13);
  await p.waitFor("document.querySelector('.bn-editor[contenteditable=true]')");
  await p.eval("document.querySelector('.bn-editor').focus()"); await sleep(300);
  await p.send("Input.dispatchKeyEvent", { type: "keyDown", key: "/", text: "/" }); await p.send("Input.dispatchKeyEvent", { type: "keyUp", key: "/" });
  await sleep(400); await p.typeText("diagrama"); await sleep(500); await p.key("Enter", "Enter", 13);
  await p.waitFor("document.querySelector('[data-testid=diagram] .react-flow')", 10000);
}

/** Rellena el bloque con `nodes` formas y `edges` conectores usando la transacción real del editor. */
async function seed(p: Page, nodes: number, edges: number) {
  await p.eval(`(() => {
    const shapes = ['terminator','process','decision','io','note'];
    const ns = Array.from({ length: ${nodes} }, (_, i) => ({ id: 'n' + i, shape: shapes[i % 5], x: (i % 25) * 190, y: Math.floor(i / 25) * 110, w: 140, h: 60, text: 'Paso ' + i, color: '#dbeafe' }));
    const es = Array.from({ length: ${edges} }, (_, i) => ({ id: 'e' + i, from: 'n' + i, to: 'n' + (i + 1), label: '' }));
    const ed = document.querySelector('.bn-editor').editor; const view = ed.view; let target = null;
    view.state.doc.descendants((node, pos) => { if (node.type.name === 'diagram') target = { node, pos }; });
    view.dispatch(view.state.tr.setNodeMarkup(target.pos, undefined, { ...target.node.attrs, data: JSON.stringify({ nodes: ns, edges: es }) }));
  })()`);
}

/** Igual que `seed`, pero en formato v2 con conectores de 90° (spec 003). */
async function seedV2(p: Page, nodes: number, edges: number) {
  await p.eval(`(() => {
    const shapes = ['terminator','process','decision','io','note'], anchors = ['e','s','w','n'];
    const ns = Array.from({ length: ${nodes} }, (_, i) => ({ id: 'n' + i, shape: shapes[i % 5], x: (i % 20) * 220, y: Math.floor(i / 20) * 140, w: 140, h: 60, text: 'Paso ' + i }));
    const es = Array.from({ length: ${edges} }, (_, i) => { const a = i % ${nodes}, b = (a + 1 + (i % 37) * 5) % ${nodes}; return { id: 'e' + i, from: { node: 'n' + a, anchor: anchors[i % 4] }, to: { node: 'n' + b, anchor: anchors[(i + 2) % 4] }, route: 'orthogonal', label: '' }; });
    const ed = document.querySelector('.bn-editor').editor; const view = ed.view; let target = null;
    view.state.doc.descendants((node, pos) => { if (node.type.name === 'diagram') target = { node, pos }; });
    view.dispatch(view.state.tr.setNodeMarkup(target.pos, undefined, { ...target.node.attrs, data: JSON.stringify({ version: 2, nodes: ns, edges: es }) }));
  })()`);
}

describe("diagrama grande y accesibilidad", () => {
  it("G-118 (RNF-1): 200 formas y 300 conectores de 90° se desplazan, se amplían y se mueven sin pausas notorias", async () => {
    const p = await web.open();
    await openDiagram(p);
    await seedV2(p, 200, 300);
    await p.waitFor("document.querySelectorAll('[data-testid=diagram] .react-flow__node').length >= 4", 15000);
    await p.waitFor("document.querySelectorAll('[data-testid=diagram] [data-connector]').length >= 1", 15000);
    await p.eval(`window.__gaps = []; (function loop(last) { requestAnimationFrame((t) => { if (last) window.__gaps.push(t - last); loop(t); }); })(0)`);
    const r = await p.eval<{ left: number; top: number; width: number; height: number }>(`(() => { const r = document.querySelector('[data-testid=diagram] .react-flow').getBoundingClientRect(); return { left: r.left, top: r.top, width: r.width, height: r.height }; })()`);
    const a = { x: r.left + r.width - 30, y: r.top + r.height - 30 };
    await p.drag(a, { x: a.x - 120, y: a.y - 60 });                   // desplazar el lienzo
    for (let i = 0; i < 4; i++) { await p.send("Input.dispatchMouseEvent", { type: "mouseWheel", x: r.left + r.width / 2, y: r.top + r.height / 2, deltaX: 0, deltaY: -120, modifiers: 2 }); await sleep(60); }
    const c = await p.center("[data-testid=diagram] .react-flow__node [role=group]");
    await p.drag(c, { x: c.x + 60, y: c.y + 40 });                   // mover una forma con conectores
    await sleep(400);
    const gaps = await p.eval<number[]>("window.__gaps");
    const worst = Math.max(...gaps);
    console.log("G-118 peor fotograma (ms):", Math.round(worst), "fotogramas:", gaps.length);
    expect(gaps.length).toBeGreaterThan(10);
    expect(worst).toBeLessThan(250);
    const sorted = [...gaps].sort((x, y) => x - y);
    expect(sorted[Math.floor(sorted.length * 0.95)]!).toBeLessThan(100);
  }, 120000);

  it("T-337: 500 elementos se mueven y se amplían sin pausas notorias", async () => {
    const p = await web.open();
    await openDiagram(p);
    await seed(p, 300, 200);
    await p.waitFor("document.querySelectorAll('[data-testid=diagram] .react-flow__node').length >= 4", 15000);
    // mide la duración de los fotogramas durante un arrastre del fondo (desplazamiento) y un zoom con la rueda
    await p.eval(`window.__gaps = []; (function loop(last) { requestAnimationFrame((t) => { if (last) window.__gaps.push(t - last); loop(t); }); })(0)`);
    const r = await p.eval<{ left: number; top: number; width: number; height: number }>(`(() => { const r = document.querySelector('[data-testid=diagram] .react-flow').getBoundingClientRect(); return { left: r.left, top: r.top, width: r.width, height: r.height }; })()`);
    const a = { x: r.left + r.width - 30, y: r.top + r.height - 30 };
    await p.drag(a, { x: a.x - 120, y: a.y - 60 });
    for (let i = 0; i < 6; i++) { await p.send("Input.dispatchMouseEvent", { type: "mouseWheel", x: r.left + r.width / 2, y: r.top + r.height / 2, deltaX: 0, deltaY: -120, modifiers: 2 }); await sleep(60); }
    await sleep(300);
    const gaps = await p.eval<number[]>("window.__gaps");
    const worst = Math.max(...gaps);
    console.log("T-337 peor fotograma (ms):", Math.round(worst), "fotogramas:", gaps.length, "lentos:", gaps.map((g, i) => (g > 80 ? i + ":" + Math.round(g) : "")).filter(Boolean).join(" "));
    expect(gaps.length).toBeGreaterThan(10);
    expect(worst).toBeLessThan(250); // pausa notoria ≈ >250 ms
    const sorted = [...gaps].sort((x, y) => x - y);
    expect(sorted[Math.floor(sorted.length * 0.95)]!).toBeLessThan(100);
  }, 120000);

  it("T-338: axe sin infracciones graves y operable con teclado", async () => {
    const p = await web.open();
    await openDiagram(p);
    await seed(p, 3, 2);
    await p.waitFor("document.querySelectorAll('[data-testid=diagram] .react-flow__node').length === 3", 10000);
    await p.eval(AXE);
    const bad = await p.eval<{ id: string; impact: string; nodes: { target: string[] }[] }[]>(`axe.run(document.querySelector('[data-testid=diagram]'), { runOnly: { type: 'tag', values: ['wcag2a','wcag2aa','wcag21a','wcag21aa'] } }).then(r => r.violations.filter(v => v.impact === 'serious' || v.impact === 'critical').map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.map(n => ({ target: n.target })) })))`);
    if (bad.length) console.log("AXE", JSON.stringify(bad, null, 1).slice(0, 2000));
    expect(bad).toEqual([]);
    // cada forma tiene etiqueta accesible y es alcanzable con teclado
    expect(await p.eval<boolean>("[...document.querySelectorAll('[data-testid=diagram] .react-flow__node [role=group]')].every(g => (g.getAttribute('aria-label') || '').length > 0)")).toBe(true);
    expect(await p.eval<boolean>("[...document.querySelectorAll('[data-testid=diagram] .react-flow__node')].every(n => n.tabIndex >= 0)")).toBe(true);
    await p.eval("document.querySelector('[data-testid=diagram] .react-flow__node').focus()");
    await p.key("Enter", "Enter", 13);
    await p.waitFor("document.querySelector('[role=region][aria-label=\"Propiedades de la forma\"]')", 5000);
  }, 120000);
});
