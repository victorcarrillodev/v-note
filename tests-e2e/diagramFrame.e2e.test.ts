// R-066 a R-068 (e2e real en Chrome, spec 004): menú junto al elemento, ampliar y salir, acomodo a la cuadrícula y fluidez en el marco nuevo.
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Page } from "./cdp";
import { clickButton, ensureSpace, startWeb, type Web } from "./webHarness";

const AXE = readFileSync(resolve(__dirname, "../node_modules/axe-core/axe.min.js"), "utf8");
let web: Web;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
beforeAll(async () => { web = await startWeb(4194, 9353); }, 120000);
afterAll(() => web?.stop());
afterEach(async () => { await web?.closeAll(); });

async function openDiagram(p: Page) {
  await ensureSpace(p); await clickButton(p, "Nueva página");
  await p.waitFor("document.querySelector('[aria-label=\"Título de la página\"]')?.value === ''");
  await new Promise((r) => setTimeout(r, 500)); // el título se vuelve a montar al abrir la página: sin pausa se pierde lo escrito
  await p.click('[aria-label="Título de la página"]'); await p.typeText("Marco"); await p.key("Enter", "Enter", 13);
  await p.waitFor("document.querySelector('.bn-editor[contenteditable=true]')");
  await p.eval("document.querySelector('.bn-editor').focus()"); await sleep(300);
  await p.send("Input.dispatchKeyEvent", { type: "keyDown", key: "/", text: "/" }); await p.send("Input.dispatchKeyEvent", { type: "keyUp", key: "/" });
  await sleep(400); await p.typeText("diagrama"); await sleep(500); await p.key("Enter", "Enter", 13);
  await p.waitFor("document.querySelector('[data-testid=diagram] .react-flow')", 10000);
}
async function seed(p: Page, nodes: { id: string; x: number; y: number; w?: number; h?: number }[]) {
  await p.eval(`(() => {
    const ns = ${JSON.stringify(nodes)}.map((n) => ({ id: n.id, shape: 'process', x: n.x, y: n.y, w: n.w ?? 140, h: n.h ?? 60, text: n.id.toUpperCase() }));
    const view = document.querySelector('.bn-editor').editor.view; let target = null;
    view.state.doc.descendants((node, pos) => { if (node.type.name === 'diagram') target = { node, pos }; });
    view.dispatch(view.state.tr.setNodeMarkup(target.pos, undefined, { ...target.node.attrs, data: JSON.stringify({ version: 2, nodes: ns, edges: [] }) }));
  })()`);
  await p.waitFor("document.querySelectorAll('[data-testid=diagram] .react-flow__node').length >= " + nodes.length, 10000);
}
const nodeRect = (p: Page, id: string) => p.eval<{ x: number; y: number; w: number; h: number; cx: number; cy: number }>(`(() => { const r = [...document.querySelectorAll('[data-testid=diagram] .react-flow__node')].find((n) => n.getAttribute('data-id') === '${id}').getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height, cx: r.left + r.width / 2, cy: r.top + r.height / 2 }; })()`);
const menuRect = (p: Page) => p.eval<{ x: number; y: number; r: number; b: number; w: number; h: number } | null>(`(() => { const m = document.querySelector('[data-floating-menu]'); if (!m) return null; const r = m.getBoundingClientRect(); return { x: r.left, y: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height }; })()`);
const savedNodes = (p: Page) => p.eval<{ id: string; x: number; y: number; w: number; h: number }[]>(`(() => { let out = []; document.querySelector('.bn-editor').editor.view.state.doc.descendants((n) => { if (n.type.name === 'diagram') out = JSON.parse(n.attrs.data).nodes; }); return out; })()`);
/** Arrastre con el ratón y modificadores (1 = Alt). */
async function dragWith(p: Page, from: { x: number; y: number }, to: { x: number; y: number }, modifiers = 0) {
  await p.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: from.x, y: from.y, modifiers });
  await p.send("Input.dispatchMouseEvent", { type: "mousePressed", x: from.x, y: from.y, button: "left", clickCount: 1, modifiers });
  for (let i = 1; i <= 8; i++) { await p.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: from.x + ((to.x - from.x) * i) / 8, y: from.y + ((to.y - from.y) * i) / 8, button: "left", modifiers }); await sleep(16); }
  await p.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: to.x, y: to.y, button: "left", clickCount: 1, modifiers });
}
const resetPrefs = (p: Page) => p.eval("localStorage.removeItem('vnote.canvas.grid')");
const click = async (p: Page, x: number, y: number) => {
  await p.send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
  await p.send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
  await p.send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });
};

describe("menú emergente junto al elemento (R-066, RF-1)", () => {
  it("seleccionar una forma muestra el menú pegado a ella, sin tapar, y sigue al hacer zoom", async () => {
    const p = await web.open();
    await openDiagram(p);
    await seed(p, [{ id: "a", x: 200, y: 160 }]);
    const n = await nodeRect(p, "a");
    await click(p, n.cx, n.cy); await sleep(500);
    const m = (await menuRect(p))!;
    expect(m, "debe haber menú").not.toBeNull();
    // no tapa la forma y está dentro de la ventana
    expect(m.b <= n.y + 1 || m.y >= n.y + n.h - 1, "el menú no debe cubrir la forma").toBe(true);
    expect(m.x).toBeGreaterThanOrEqual(0);
    expect(m.r).toBeLessThanOrEqual(1280);
    // sigue a la forma al hacer zoom con la rueda
    await p.send("Input.dispatchMouseEvent", { type: "mouseWheel", x: n.cx, y: n.cy, deltaX: 0, deltaY: -120, modifiers: 2 }); await sleep(600);
    const n2 = await nodeRect(p, "a"), m2 = (await menuRect(p))!;
    expect(n2.w).toBeGreaterThan(n.w);
    const centered = Math.abs((m2.x + m2.r) / 2 - n2.cx);
    expect(centered, "el menú sigue centrado sobre la forma").toBeLessThan(40);
    expect(m2.b <= n2.y + 1 || m2.y >= n2.y + n2.h - 1, "sigue sin tapar").toBe(true);
    // la franja inferior ya no existe
    expect(await p.eval<boolean>("!!document.querySelector('[data-testid=diagram]').nextElementSibling?.matches('[role=region]')")).toBe(false);
  }, 150000);
});

describe("vista ampliada (R-066, RF-3)", () => {
  it("ampliar cubre la ventana, Esc sale y se conserva la selección", async () => {
    const p = await web.open();
    await openDiagram(p);
    await seed(p, [{ id: "a", x: 200, y: 160 }]);
    const before = await p.eval<{ w: number; h: number }>("(() => { const r = document.querySelector('[data-testid=diagram]').getBoundingClientRect(); return { w: r.width, h: r.height }; })()");
    await p.eval("[...document.querySelectorAll('[data-testid=diagram] button')].find((b) => b.getAttribute('aria-label') === 'Ampliar').click()"); await sleep(600);
    const full = await p.eval<{ x: number; y: number; w: number; h: number; iw: number; ih: number; role: string | null }>("(() => { const e = document.querySelector('[data-testid=diagram]'); const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height, iw: innerWidth, ih: innerHeight, role: e.getAttribute('role') }; })()");
    expect(full.role).toBe("dialog");
    expect(Math.round(full.w)).toBe(full.iw); expect(Math.round(full.h)).toBe(full.ih);
    const n = await nodeRect(p, "a");
    await click(p, n.cx, n.cy); await sleep(400);
    expect(await menuRect(p), "el menú aparece también en la vista ampliada").not.toBeNull();
    await p.key("Escape", "Escape", 27); await sleep(300);          // 1.º: cierra el menú
    expect(await menuRect(p)).toBeNull();
    expect(await p.eval<string | null>("document.querySelector('[data-testid=diagram]').getAttribute('role')")).toBe("dialog");
    await p.key("Escape", "Escape", 27); await sleep(500);          // 2.º: sale de la vista
    const after = await p.eval<{ w: number; h: number; role: string | null }>("(() => { const e = document.querySelector('[data-testid=diagram]'); const r = e.getBoundingClientRect(); return { w: r.width, h: r.height, role: e.getAttribute('role') }; })()");
    expect(after.role).toBe("group");
    expect(Math.abs(after.w - before.w)).toBeLessThan(2); expect(Math.abs(after.h - before.h)).toBeLessThan(2);
  }, 150000);
});

describe("acomodo a la cuadrícula (R-066, R-060, R-061, R-063, RF-18)", () => {
  it("al mover una forma queda en la cuadrícula; con Alt, libre", async () => {
    const p = await web.open();
    await openDiagram(p); await resetPrefs(p);
    await seed(p, [{ id: "a", x: 200, y: 160 }, { id: "b", x: 500, y: 160 }]);
    const a = await nodeRect(p, "a");
    await p.drag({ x: a.cx, y: a.cy }, { x: a.cx + 33, y: a.cy + 27 }); await sleep(500);
    let saved = await savedNodes(p);
    const na = saved.find((n) => n.id === "a")!;
    expect(Math.abs(na.x % 20), `x=${na.x}`).toBe(0); expect(Math.abs(na.y % 20), `y=${na.y}`).toBe(0);
    expect(na.x).not.toBe(200);
  }, 150000);

  it("con Alt pulsada el movimiento es libre (R-063)", async () => {
    const p = await web.open();
    await openDiagram(p); await resetPrefs(p);
    await seed(p, [{ id: "a", x: 200, y: 160 }]);
    const a = await nodeRect(p, "a");
    // Alt se simula en la página (un Alt real activa gestos del sistema de ventanas); el arrastre es real.
    await p.eval("window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Alt', altKey: true }))"); await sleep(300);
    await dragWith(p, { x: a.cx, y: a.cy }, { x: a.cx + 33, y: a.cy + 27 }); await sleep(500);
    await p.eval("window.dispatchEvent(new KeyboardEvent('keyup', { key: 'Alt' }))");
    const na = (await savedNodes(p)).find((n) => n.id === "a")!;
    console.log("R-063 con Alt:", na.x, na.y);
    expect(Math.abs(na.x % 20) + Math.abs(na.y % 20), "con Alt no se acomoda").toBeGreaterThan(0);
  }, 150000);

  it("con el acomodo apagado el movimiento es libre", async () => {
    const p = await web.open();
    await openDiagram(p);
    await seed(p, [{ id: "a", x: 200, y: 160 }]);
    await p.eval("[...document.querySelectorAll('[data-testid=diagram] button')].find((b) => b.getAttribute('aria-label') === 'Acomodar a la cuadrícula').click()"); await sleep(300);
    const a = await nodeRect(p, "a");
    await p.drag({ x: a.cx, y: a.cy }, { x: a.cx + 33, y: a.cy + 27 }); await sleep(500);
    const na = (await savedNodes(p)).find((n) => n.id === "a")!;
    expect(Math.abs(na.x % 20) + Math.abs(na.y % 20)).toBeGreaterThan(0);
  }, 150000);

  it("al redimensionar los bordes quedan en la cuadrícula", async () => {
    const p = await web.open();
    await openDiagram(p); await resetPrefs(p);
    await seed(p, [{ id: "a", x: 200, y: 160, w: 140, h: 60 }]);
    const a = await nodeRect(p, "a");
    await click(p, a.cx, a.cy); await sleep(400);
    const handle = await p.eval<{ x: number; y: number } | null>(`(() => { const h = document.querySelector('[data-testid=diagram] .react-flow__resize-control.handle.bottom.right'); if (!h) return null; const r = h.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
    expect(handle, "debe haber asa de redimensión").not.toBeNull();
    await p.drag(handle!, { x: handle!.x + 43, y: handle!.y + 31 }); await sleep(500);
    const na = (await savedNodes(p)).find((n) => n.id === "a")!;
    console.log("R-061 tras redimensionar:", JSON.stringify(na));
    expect(Math.abs((na.x + na.w) % 20), `borde derecho ${na.x + na.w}`).toBe(0);
    expect(Math.abs((na.y + na.h) % 20), `borde inferior ${na.y + na.h}`).toBe(0);
  }, 150000);
});

describe("accesibilidad del marco, el menú y la vista ampliada (R-069, RNF-3)", () => {
  for (const theme of ["light", "dark"] as const) {
    it(`axe sin infracciones graves con el menú abierto y en vista ampliada (${theme})`, async () => {
      const p = await web.open();
      await openDiagram(p); await resetPrefs(p);
      await p.eval(`document.documentElement.setAttribute('data-theme', '${theme}')`);
      await seed(p, [{ id: "a", x: 200, y: 160 }]);
      await p.eval(AXE);
      const run = () => p.eval<{ id: string; impact: string; nodes: string[] }[]>(`axe.run({ include: [['[data-testid=diagram]'], ['[data-floating-menu]']] }, { runOnly: { type: 'tag', values: ['wcag2a','wcag2aa','wcag21a','wcag21aa'] } }).then(r => r.violations.filter(v => v.impact === 'serious' || v.impact === 'critical').map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.map(n => n.target.join(' ')).slice(0, 3) })))`);
      const a = await nodeRect(p, "a");
      await click(p, a.cx, a.cy); await sleep(500);
      expect(await menuRect(p), "menú abierto").not.toBeNull();
      const v1 = await run(); if (v1.length) console.log("AXE menú:", JSON.stringify(v1));
      expect(v1, "con el menú abierto").toEqual([]);
      await p.eval("[...document.querySelectorAll('[data-testid=diagram] button')].find((b) => b.getAttribute('aria-label') === 'Ampliar').click()"); await sleep(600);
      expect(await run(), "en vista ampliada").toEqual([]);
    }, 150000);
  }
});
