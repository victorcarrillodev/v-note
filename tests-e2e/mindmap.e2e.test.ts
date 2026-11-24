// R-148, R-167 a R-169 (e2e real en Chrome, spec 004): mapa mental — clic escribe y abre menú, mover con rama y reabrir, color de rama,
// zoom, alto persistido, mismo ancho que otros bloques y fluidez con 200 globos.
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Page } from "./cdp";
import { clickButton, ensureSpace, startWeb, type Web } from "./webHarness";

const AXE = readFileSync(resolve(__dirname, "../node_modules/axe-core/axe.min.js"), "utf8");
let web: Web;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
beforeAll(async () => { web = await startWeb(4196, 9355); }, 120000);
afterAll(() => web?.stop());
afterEach(async () => { await web?.closeAll(); });

const Q = "[data-testid=mindmap]";
async function openMap(p: Page, title = "Mapa") {
  await ensureSpace(p); await clickButton(p, "Nueva página");
  await p.waitFor("document.querySelector('[aria-label=\"Título de la página\"]')?.value === ''");
  await new Promise((r) => setTimeout(r, 500)); // el título se vuelve a montar al abrir la página: sin pausa se pierde lo escrito
  await p.click('[aria-label="Título de la página"]'); await p.typeText(title); await p.key("Enter", "Enter", 13);
  await p.waitFor("document.querySelector('.bn-editor[contenteditable=true]')");
  await p.eval("document.querySelector('.bn-editor').focus()"); await sleep(300);
  await p.send("Input.dispatchKeyEvent", { type: "keyDown", key: "/", text: "/" }); await p.send("Input.dispatchKeyEvent", { type: "keyUp", key: "/" });
  await sleep(400); await p.typeText("mapa mental"); await sleep(500); await p.key("Enter", "Enter", 13);
  await p.waitFor(`document.querySelector('${Q} .react-flow__node')`, 10000);
  await sleep(500);
}
const reopen = async (p: Page, title = "Mapa") => {
  await sleep(1500); await p.reload();
  await p.waitFor("document.querySelector('aside nav')", 20000);
  await p.eval(`[...document.querySelectorAll('[role=treeitem]')].find(e => e.getAttribute('aria-label') === ${JSON.stringify(title)}).click()`);
  await p.waitFor(`document.querySelector('${Q} .react-flow__node')`, 15000);
  await sleep(500);
};
type TNode = { id: string; text: string; children: TNode[]; off?: { x: number; y: number }; style?: Record<string, string> };
const saved = (p: Page) => p.eval<{ root: TNode; view?: { height: number } }>(`(() => { let out = null; document.querySelector('.bn-editor').editor.view.state.doc.descendants((n) => { if (n.type.name === 'mindmap') out = JSON.parse(n.attrs.data); }); return out; })()`);
const bubble = (id: string) => `${Q} [data-mind-id="${id}"]`;
const rect = (p: Page, sel: string) => p.eval<{ x: number; y: number; w: number; h: number; cx: number; cy: number }>(`(() => { const r = document.querySelector('${sel}').getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height, cx: r.left + r.width / 2, cy: r.top + r.height / 2 }; })()`);
const mouse = async (p: Page, type: string, x: number, y: number) => p.send("Input.dispatchMouseEvent", { type, x, y, button: "left", clickCount: 1 });
const click = async (p: Page, x: number, y: number) => { await mouse(p, "mouseMoved", x, y); await mouse(p, "mousePressed", x, y); await mouse(p, "mouseReleased", x, y); };
async function dragBy(p: Page, from: { x: number; y: number }, dx: number, dy: number) {
  await mouse(p, "mouseMoved", from.x, from.y); await mouse(p, "mousePressed", from.x, from.y);
  for (let i = 1; i <= 8; i++) { await p.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: from.x + (dx * i) / 8, y: from.y + (dy * i) / 8, button: "left" }); await sleep(16); }
  await mouse(p, "mouseReleased", from.x + dx, from.y + dy);
}
const resetPrefs = (p: Page) => p.eval("localStorage.removeItem('vnote.canvas.grid')");
async function addChildTo(p: Page, id: string, text: string) {
  const r = await rect(p, bubble(id)); await click(p, r.cx, r.cy); await sleep(400);
  await p.eval(`[...document.querySelectorAll('[data-floating-menu] button')].find(b => b.getAttribute('aria-label') === 'Agregar hijo').click()`); await sleep(300);
  await p.typeText(text); await p.key("Enter", "Enter", 13); await sleep(400);
}

describe("mapa mental en el navegador real", () => {
  it("R-167 y R-148: un clic escribe y abre el menú; mover con su rama persiste; color de rama; zoom y alto", async () => {
    const p = await web.open();
    await openMap(p); await resetPrefs(p);
    // un clic: selecciona, abre el menú y deja escribir
    const r0 = await rect(p, bubble("root")); await click(p, r0.cx, r0.cy); await sleep(500);
    expect(await p.eval("!!document.querySelector('[data-floating-menu]')")).toBe(true);
    expect(await p.eval(`document.activeElement?.tagName`)).toBe("INPUT");
    await p.typeText("Tema"); await p.key("Enter", "Enter", 13); await sleep(400);
    expect((await saved(p)).root.text).toBe("Tema");
    await addChildTo(p, "root", "Rama A");
    const a = (await saved(p)).root.children[0]!;
    await addChildTo(p, a.id, "Hijo A1");
    const ids = (await saved(p)).root.children[0]!;
    expect(ids.children[0]!.text).toBe("Hijo A1");

    // mover una rama: el hijo se mueve con ella y el desplazamiento persiste
    const before = await rect(p, bubble(ids.children[0]!.id));
    const ra = await rect(p, bubble(a.id));
    await dragBy(p, { x: ra.cx, y: ra.cy }, 100, 80); await sleep(500);
    const after = await rect(p, bubble(ids.children[0]!.id));
    expect(Math.round(after.x - before.x)).toBeGreaterThanOrEqual(80); expect(Math.round(after.y - before.y)).toBeGreaterThanOrEqual(60);
    const s1 = await saved(p);
    expect(s1.root.children[0]!.off).toBeDefined();
    expect(s1.root.children[0]!.children[0]!.off).toBeUndefined();
    expect(await p.eval("!!document.querySelector('[data-floating-menu]')")).toBe(true);
    expect(await p.eval(`!!document.querySelector('${bubble(a.id)} input')`)).toBe(false); // arrastrar no abre el campo
    const relBefore = (after.x - (await rect(p, bubble(a.id))).x) / after.w;
    await reopen(p);
    const ca = await rect(p, bubble(ids.children[0]!.id)), aa = await rect(p, bubble(a.id));
    expect(Math.abs((ca.x - aa.x) / ca.w - relBefore), "el hijo sigue en su sitio respecto a su padre").toBeLessThan(0.05);
    expect((await saved(p)).root.children[0]!.off, "el desplazamiento persiste al reabrir").toBeDefined();

    // color de la rama
    const rb = await rect(p, bubble(a.id)); await click(p, rb.cx, rb.cy); await sleep(500);
    await p.eval(`[...document.querySelectorAll('[data-floating-menu] button')].find(b => b.innerText.trim() === 'Relleno').click()`); await sleep(200);
    await p.eval(`(() => { const g = [...document.querySelectorAll('[data-floating-menu] [role=group]')].find(x => x.getAttribute('aria-label') === 'Relleno'); g.querySelectorAll('button')[1].click(); })()`); await sleep(200);
    await p.eval(`[...document.querySelectorAll('[data-floating-menu] button')].find(b => b.getAttribute('aria-label') === 'Aplicar a la rama').click()`); await sleep(400);
    const s2 = await saved(p);
    expect(s2.root.children[0]!.style!.fill).toMatch(/^palette:/);
    expect(s2.root.children[0]!.children[0]!.style!.fill).toBe(s2.root.children[0]!.style!.fill);
    expect(s2.root.style).toBeUndefined();

    // zoom y 100 %
    const lvl = () => p.eval<string>(`document.querySelector('[aria-label="Nivel de zoom"]').textContent`);
    await clickButton(p, "Restablecer al 100 %"); await sleep(400);
    expect(await lvl()).toContain("100");
    const c = await rect(p, Q);
    await p.send("Input.dispatchMouseEvent", { type: "mouseWheel", x: c.x + c.w - 40, y: c.y + c.h - 60, deltaX: 0, deltaY: -120 }); await sleep(300);
    expect(await lvl(), "la rueda sola no hace zoom (desplaza la página)").toContain("100");
    await p.send("Input.dispatchMouseEvent", { type: "mouseWheel", x: c.x + c.w - 40, y: c.y + c.h - 60, deltaX: 0, deltaY: -120, modifiers: 2 }); await sleep(400);
    expect(await lvl(), "Ctrl + rueda hace zoom").not.toContain("100 %");
    await p.eval(`document.querySelector('[aria-label="Alejar"]').click()`); await sleep(400);

    // alto persistido
    const h0 = (await rect(p, Q)).h;
    await p.eval(`document.querySelector('[role=separator][aria-label="Alto del lienzo"]').focus()`);
    await p.key("ArrowDown", "ArrowDown", 40); await p.key("ArrowDown", "ArrowDown", 40); await sleep(500);
    const h1 = (await rect(p, Q)).h;
    expect(h1).toBeGreaterThan(h0 + 30);
    expect((await saved(p)).view!.height).toBeGreaterThan(300);
    await reopen(p);
    expect(Math.abs((await rect(p, Q)).h - h1)).toBeLessThan(3);
  }, 240000);

  it("alta rápida: el botón + junto al globo y Tab mientras se escribe agregan hijos sin perder el texto", async () => {
    const p = await web.open();
    await openMap(p, "Rápido");
    const r = await rect(p, bubble("root")); await click(p, r.cx, r.cy); await sleep(500);
    const add = await rect(p, '[data-mind-add="root"]'); await click(p, add.cx, add.cy); await sleep(400);
    await p.typeText("Investigar"); await sleep(100);
    await p.key("Tab", "Tab", 9); await sleep(400);
    await p.typeText("Entrevistas"); await p.key("Enter", "Enter", 13); await sleep(400);
    const t = await saved(p);
    expect(t.root.children.map((c) => c.text)).toEqual(["Investigar"]);
    expect(t.root.children[0]!.children.map((c) => c.text)).toEqual(["Entrevistas"]);
    // todo el mapa sigue a la vista tras agregar
    const f = await rect(p, Q);
    for (const id of ["root", t.root.children[0]!.id, t.root.children[0]!.children[0]!.id]) {
      const b = await rect(p, bubble(id));
      expect(b.x, `el globo ${id} no se sale por la izquierda`).toBeGreaterThanOrEqual(f.x - 1);
      expect(b.x + b.w, `el globo ${id} no se sale por la derecha`).toBeLessThanOrEqual(f.x + f.w + 1);
    }
    await p.close();
  }, 120000);

  it("R-168: el mapa tiene el ancho de la columna en tres anchos de ventana", async () => {
    const p = await web.open();
    await openMap(p, "Ancho");
    for (const w of [1280, 900, 600]) {
      await p.send("Emulation.setDeviceMetricsOverride", { width: w, height: 800, deviceScaleFactor: 1, mobile: false }); await sleep(500);
      const m = await p.eval<{ frame: number; col: number; ed: number }>(`(() => { const f = document.querySelector('${Q}').getBoundingClientRect(); const c = document.querySelector('.bn-block-content[data-content-type=paragraph]').getBoundingClientRect(); return { frame: f.width, col: c.width, ed: document.querySelector('.bn-editor').getBoundingClientRect().width }; })()`);
      console.log('ancho', w, JSON.stringify(m)); expect(Math.abs(m.frame - m.col), `ancho ${w}`).toBeLessThan(4);
    }
    await p.send("Emulation.clearDeviceMetricsOverride");
  }, 120000);

  it("R-169: arrastrar una rama con 200 globos es fluido", async () => {
    const p = await web.open();
    await openMap(p, "Grande");
    const kids = Array.from({ length: 10 }, (_, i) => ({ id: "k" + i, text: "Rama " + i, children: Array.from({ length: 19 }, (_, j) => ({ id: `k${i}_${j}`, text: `Idea ${i}.${j}`, children: [] })) }));
    await p.eval(`(() => {
      const data = JSON.stringify({ root: { id: 'root', text: 'Tema', children: ${JSON.stringify(kids)} } });
      const view = document.querySelector('.bn-editor').editor.view; let t = null;
      view.state.doc.descendants((node, pos) => { if (node.type.name === 'mindmap') t = { node, pos }; });
      view.dispatch(view.state.tr.setNodeMarkup(t.pos, undefined, { ...t.node.attrs, data }));
    })()`);
    await p.waitFor(`document.querySelectorAll('${Q} .react-flow__node').length >= 3`, 15000);
    await sleep(500);
    const mounted = await p.eval<number>(`document.querySelectorAll('${Q} [data-mind-id]').length`);
    expect(mounted, "R-131: solo se montan los globos visibles").toBeLessThan(200);
    await clickButton(p, "Ajustar a pantalla"); await sleep(800);
    await p.eval(`window.__gaps = []; (function loop(last) { requestAnimationFrame((t) => { if (last) window.__gaps.push(t - last); loop(t); }); })(0)`);
    const r = await rect(p, bubble("k0")); await dragBy(p, { x: r.cx, y: r.cy }, 60, 40); await sleep(400);
    const gaps = await p.eval<number[]>("window.__gaps");
    const worst = Math.max(...gaps), sorted = [...gaps].sort((x, y) => x - y);
    console.log("R-169 peor fotograma (ms):", Math.round(worst), "p95:", Math.round(sorted[Math.floor(sorted.length * 0.95)]!), "fotogramas:", gaps.length);
    expect(gaps.length).toBeGreaterThan(10);
    expect(worst).toBeLessThan(250);
    expect(sorted[Math.floor(sorted.length * 0.95)]!).toBeLessThan(100);
    expect((await saved(p)).root.children[0]!.off).toBeDefined();
  }, 180000);

  for (const theme of ["light", "dark"] as const) {
    it(`R-179: axe sin infracciones graves con el menú abierto y en vista ampliada (${theme})`, async () => {
      const p = await web.open();
      await openMap(p, "Accesible"); await resetPrefs(p);
      await p.eval(`document.documentElement.setAttribute('data-theme', '${theme}')`);
      await p.eval(AXE);
      const run = () => p.eval<{ id: string; nodes: string[] }[]>(`axe.run({ include: [['${Q}'], ['[data-floating-menu]']] }, { runOnly: { type: 'tag', values: ['wcag2a','wcag2aa','wcag21a','wcag21aa'] } }).then(r => r.violations.filter(v => v.impact === 'serious' || v.impact === 'critical').map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target.join(' ')).slice(0, 3) })))`);
      const r = await rect(p, bubble("root")); await click(p, r.cx, r.cy); await sleep(600);
      expect(await p.eval("!!document.querySelector('[data-floating-menu]')")).toBe(true);
      const v1 = await run(); if (v1.length) console.log("AXE menú:", JSON.stringify(v1));
      expect(v1, "con el menú abierto").toEqual([]);
      await p.eval(`[...document.querySelectorAll('${Q} button')].find((b) => b.getAttribute('aria-label') === 'Ampliar').click()`); await sleep(600);
      const v2 = await run(); if (v2.length) console.log("AXE ampliada:", JSON.stringify(v2));
      expect(v2, "en vista ampliada").toEqual([]);
    }, 150000);
  }

  it("R-180: ninguna petición a destinos externos en el flujo del mapa", async () => {
    const p = await web.open();
    await openMap(p, "Red");
    const r = await rect(p, bubble("root")); await click(p, r.cx, r.cy); await sleep(400);
    await addChildTo(p, "root", "Rama"); await sleep(400);
    const hosts = await p.eval<string[]>(`[...new Set(performance.getEntriesByType('resource').map((e) => new URL(e.name).origin).filter((o) => o !== location.origin && !o.startsWith('blob:') && !o.startsWith('data:')))]`);
    expect(hosts).toEqual([]);
  }, 120000);
});
