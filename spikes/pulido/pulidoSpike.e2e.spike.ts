// Verificaciones previas de la spec 004 (desechable; copia en spikes/pulido/). Resultados en spikes/RESULTS-pulido.md.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Page } from "./cdp";
import { clickButton, ensureSpace, startWeb, type Web } from "./webHarness";
let web: Web;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
beforeAll(async () => { web = await startWeb(4191, 9350); }, 120000);
afterAll(() => web?.stop());

async function openBlock(p: Page, query: string, selector: string) {
  await ensureSpace(p); await clickButton(p, "Nueva página");
  await p.waitFor("document.querySelector('[aria-label=\"Título de la página\"]')?.value === ''");
  await p.click('[aria-label="Título de la página"]'); await p.typeText("Prueba"); await p.key("Enter", "Enter", 13);
  await p.waitFor("document.querySelector('.bn-editor[contenteditable=true]')");
  await p.eval("document.querySelector('.bn-editor').focus()"); await sleep(300);
  await p.send("Input.dispatchKeyEvent", { type: "keyDown", key: "/", text: "/" }); await p.send("Input.dispatchKeyEvent", { type: "keyUp", key: "/" });
  await sleep(400); await p.typeText(query); await sleep(500); await p.key("Enter", "Enter", 13);
  await p.waitFor(`document.querySelector('${selector}')`, 10000);
}

describe("R-001 vista ampliada con posición fija", () => {
  it("el lienzo cubre la ventana, ningún ancestro lo rompe y se reencuadra", async () => {
    const p = await web.open();
    await openBlock(p, "diagrama", "[data-testid=diagram] .react-flow");
    // Ancestros que cambian el bloque contenedor de un elemento `fixed` (transform, filter, perspective, contain, will-change) o lo recortan (overflow).
    const breakers = await p.eval<string[]>(`(() => {
      const out = []; let el = document.querySelector('[data-testid=diagram]').parentElement;
      while (el && el !== document.documentElement) {
        const s = getComputedStyle(el);
        const why = [];
        if (s.transform !== 'none') why.push('transform');
        if (s.filter !== 'none') why.push('filter');
        if (s.perspective !== 'none') why.push('perspective');
        if (s.contain && s.contain !== 'none') why.push('contain:' + s.contain);
        if (s.willChange && s.willChange !== 'auto') why.push('will-change:' + s.willChange);
        if (s.backdropFilter && s.backdropFilter !== 'none') why.push('backdrop-filter');
        if (why.length) out.push((el.className || el.tagName).toString().slice(0, 60) + ' => ' + why.join(','));
        el = el.parentElement;
      } return out; })()`);
    console.log("SPIKE R-001 ancestros que rompen fixed:", JSON.stringify(breakers));
    const before = await p.eval<{ w: number; h: number }>("(() => { const r = document.querySelector('[data-testid=diagram] .react-flow').getBoundingClientRect(); return { w: r.width, h: r.height }; })()");
    // Ampliar: posición fija sobre toda la ventana.
    await p.eval(`(() => { const box = document.querySelector('[data-testid=diagram]'); box.dataset.expanded = '1';
      Object.assign(box.style, { position: 'fixed', inset: '0', zIndex: '9999', background: 'var(--c-canvas, #fff)', margin: '0' });
      const inner = box.querySelector('.vn-diagram'); if (inner) Object.assign(inner.style, { height: '100vh' }); })()`);
    await sleep(600);
    const after = await p.eval<{ x: number; y: number; w: number; h: number; iw: number; ih: number; flowW: number; flowH: number; top: string[] }>(`(() => {
      const r = document.querySelector('[data-testid=diagram]').getBoundingClientRect();
      const f = document.querySelector('[data-testid=diagram] .react-flow').getBoundingClientRect();
      const pts = [[5, 5], [innerWidth - 5, 5], [5, innerHeight - 5], [innerWidth - 5, innerHeight - 5], [innerWidth / 2, innerHeight / 2]];
      const top = pts.map(([x, y]) => { const e = document.elementFromPoint(x, y); return e && document.querySelector('[data-testid=diagram]').contains(e) ? 'dentro' : 'FUERA:' + (e && e.tagName); });
      return { x: r.x, y: r.y, w: r.width, h: r.height, iw: innerWidth, ih: innerHeight, flowW: f.width, flowH: f.height, top }; })()`);
    console.log("SPIKE R-001 antes/después:", JSON.stringify({ before, after }));
    expect(Math.round(after.w)).toBe(after.iw);
    expect(Math.round(after.h)).toBe(after.ih);
    expect(after.top.every((t) => t === "dentro")).toBe(true);
    expect(after.flowW).toBeGreaterThan(before.w);
    expect(after.flowH).toBeGreaterThan(before.h);
    // El lienzo sigue vivo tras ampliar: el zoom de la librería responde.
    const z0 = await p.eval<string>("document.querySelector('[data-testid=diagram] .react-flow__viewport').style.transform");
    await p.eval("document.querySelector('[data-testid=diagram] .react-flow__controls-zoomin')?.click()"); await sleep(500);
    const z1 = await p.eval<string>("document.querySelector('[data-testid=diagram] .react-flow__viewport').style.transform");
    console.log("SPIKE R-001 zoom:", z0, "->", z1);
    // Salir: volver al flujo normal restituye el tamaño anterior.
    await p.eval(`(() => { const box = document.querySelector('[data-testid=diagram]'); box.removeAttribute('style'); const inner = box.querySelector('.vn-diagram'); if (inner) inner.style.height = '420px'; })()`);
    await sleep(500);
    const back = await p.eval<{ w: number; h: number }>("(() => { const r = document.querySelector('[data-testid=diagram] .react-flow').getBoundingClientRect(); return { w: r.width, h: r.height }; })()");
    console.log("SPIKE R-001 regreso:", JSON.stringify(back));
    expect(Math.abs(back.w - before.w)).toBeLessThan(2);
    expect(Math.abs(back.h - before.h)).toBeLessThan(2);
  }, 120000);
});

const SCAN = `(() => {
  const root = getComputedStyle(document.documentElement);
  const hex = root.getPropertyValue('--c-accent').trim();
  const probe = document.createElement('i'); probe.style.color = hex; document.body.appendChild(probe);
  const accent = getComputedStyle(probe).color; probe.remove();
  const out = [];
  for (const el of document.querySelectorAll('body *')) {
    const s = getComputedStyle(el); const why = [];
    if (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0 && s.outlineColor === accent) why.push('outline');
    if (s.boxShadow && s.boxShadow.includes(accent)) why.push('box-shadow');
    for (const side of ['Top', 'Right', 'Bottom', 'Left']) if (s['border' + side + 'Style'] !== 'none' && parseFloat(s['border' + side + 'Width']) > 0 && s['border' + side + 'Color'] === accent) { why.push('border'); break; }
    if (why.length) { const r = el.getBoundingClientRect(); if (r.width > 0 && r.height > 0) out.push(el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\\s+/).slice(0, 3).join('.') : '') + '[' + (el.getAttribute('role') || el.getAttribute('data-testid') || el.getAttribute('aria-label') || '') + '] ' + why.join('+') + ' ' + (el === document.activeElement ? '(activo)' : '')); }
  }
  return { accent, found: out };
})()`;

describe("R-002 fuentes del azul al hacer clic", () => {
  it("lista todo contorno, borde o sombra con el color de acento tras un clic de ratón", async () => {
    const p = await web.open();
    await openBlock(p, "mapa mental", "[data-testid=mindmap]");
    const idle = await p.eval<{ accent: string; found: string[] }>(SCAN);
    console.log("SPIKE R-002 reposo:", JSON.stringify(idle));
    await p.click('[data-testid=mindmap] [data-node-id=root]'); await sleep(300);
    const afterNode = await p.eval<{ accent: string; found: string[] }>(SCAN);
    console.log("SPIKE R-002 clic en globo:", JSON.stringify(afterNode));
    await p.click('[data-testid=mindmap] [role=region] button'); await sleep(300);
    const afterBtn = await p.eval<{ accent: string; found: string[] }>(SCAN);
    console.log("SPIKE R-002 clic en botón del panel:", JSON.stringify(afterBtn));
    await p.click('[data-testid=mindmap] [role=region] input'); await sleep(300);
    const afterInput = await p.eval<{ accent: string; found: string[] }>(SCAN);
    console.log("SPIKE R-002 clic en campo del panel:", JSON.stringify(afterInput));
    // El bloque entero (atómico) al hacer clic en su borde/margen.
    const box = await p.eval<{ x: number; y: number }>("(() => { const r = document.querySelector('[data-testid=mindmap]').parentElement.getBoundingClientRect(); return { x: r.left + 4, y: r.top + 4 }; })()");
    await p.send("Input.dispatchMouseEvent", { type: "mousePressed", x: box.x, y: box.y, button: "left", clickCount: 1 });
    await p.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: box.x, y: box.y, button: "left", clickCount: 1 }); await sleep(300);
    const afterBlock = await p.eval<{ accent: string; found: string[] }>(SCAN);
    console.log("SPIKE R-002 clic en el borde del bloque:", JSON.stringify(afterBlock));
    expect(afterNode.accent).toMatch(/^rgb/);
  }, 150000);
  it("lo mismo en el diagrama de flujo", async () => {
    await web.closeAll();
    const p = await web.open();
    await openBlock(p, "diagrama", "[data-testid=diagram] .react-flow");
    await p.click('[data-testid=diagram] .react-flow__pane'); await sleep(300);
    const pane = await p.eval<{ accent: string; found: string[] }>(SCAN);
    console.log("SPIKE R-002 diagrama, clic en el fondo:", JSON.stringify(pane));
    const hasNode = await p.eval<boolean>("!!document.querySelector('[data-testid=diagram] .react-flow__node')");
    if (hasNode) {
      await p.click('[data-testid=diagram] .react-flow__node'); await sleep(300);
      console.log("SPIKE R-002 diagrama, clic en forma:", JSON.stringify(await p.eval(SCAN)));
    }
    expect(pane.accent).toMatch(/^rgb/);
  }, 150000);
});

describe("R-003 arrastrar una rama completa de 200 elementos sobre @xyflow/react", () => {
  it("mide el peor fotograma al mover 200 nodos seleccionados a la vez", async () => {
    await web.closeAll();
    const p = await web.open();
    await openBlock(p, "diagrama", "[data-testid=diagram] .react-flow");
    await p.eval(`(() => {
      const shapes = ['terminator','process','decision','io','note'];
      const ns = Array.from({ length: 200 }, (_, i) => ({ id: 'n' + i, shape: shapes[i % 5], x: (i % 20) * 190, y: Math.floor(i / 20) * 100, w: 140, h: 60, text: 'Paso ' + i }));
      const es = Array.from({ length: ${Number(process.env.SPIKE_EDGES ?? 199)} }, (_, i) => ({ id: 'e' + i, from: { node: 'n' + i, anchor: 'e' }, to: { node: 'n' + (i + 1), anchor: 'w' }, route: 'curved', label: '' }));
      const view = document.querySelector('.bn-editor').editor.view; let target = null;
      view.state.doc.descendants((node, pos) => { if (node.type.name === 'diagram') target = { node, pos }; });
      view.dispatch(view.state.tr.setNodeMarkup(target.pos, undefined, { ...target.node.attrs, data: JSON.stringify({ version: 2, nodes: ns, edges: es }) }));
    })()`);
    await p.waitFor("document.querySelectorAll('[data-testid=diagram] .react-flow__node').length >= 4", 15000);
    const r = await p.eval<{ left: number; top: number; width: number; height: number }>(`(() => { const r = document.querySelector('[data-testid=diagram] .react-flow').getBoundingClientRect(); return { left: r.left, top: r.top, width: r.width, height: r.height }; })()`);
    // alejar hasta ver todo
    for (let i = 0; i < 14; i++) { await p.send("Input.dispatchMouseEvent", { type: "mouseWheel", x: r.left + r.width / 2, y: r.top + r.height / 2, deltaX: 0, deltaY: 200, modifiers: 2 }); await sleep(40); }
    await sleep(500);
    const visible = await p.eval<number>("document.querySelectorAll('[data-testid=diagram] .react-flow__node').length");
    // selección por recuadro con Mayús sobre todo el lienzo
    const a = { x: r.left + 4, y: r.top + 4 }, b = { x: r.left + r.width - 4, y: r.top + r.height - 4 };
    await p.send("Input.dispatchKeyEvent", { type: "rawKeyDown", key: "Shift", code: "ShiftLeft", windowsVirtualKeyCode: 16, modifiers: 8 });
    await p.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: a.x, y: a.y, modifiers: 8 });
    await p.send("Input.dispatchMouseEvent", { type: "mousePressed", x: a.x, y: a.y, button: "left", clickCount: 1, modifiers: 8 });
    await p.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: b.x, y: b.y, button: "left", modifiers: 8 });
    await p.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: b.x, y: b.y, button: "left", clickCount: 1, modifiers: 8 });
    await p.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Shift", code: "ShiftLeft", windowsVirtualKeyCode: 16 });
    await sleep(500);
    const selected = await p.eval<number>("document.querySelectorAll('[data-testid=diagram] .react-flow__node.selected').length");
    console.log("SPIKE R-003 nodos montados:", visible, "seleccionados:", selected);
    expect(selected).toBeGreaterThan(50);
    await p.eval(`window.__gaps = []; (function loop(last) { requestAnimationFrame((t) => { if (last) window.__gaps.push(t - last); loop(t); }); })(0)`);
    const c = await p.center("[data-testid=diagram] .react-flow__node.selected");
    await p.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: c.x, y: c.y });
    await p.send("Input.dispatchMouseEvent", { type: "mousePressed", x: c.x, y: c.y, button: "left", clickCount: 1 });
    for (let i = 1; i <= 30; i++) { await p.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: c.x + i * 3, y: c.y + i * 2, button: "left" }); await sleep(16); }
    await p.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: c.x + 90, y: c.y + 60, button: "left", clickCount: 1 });
    await sleep(400);
    const gaps = await p.eval<number[]>("window.__gaps");
    const sorted = [...gaps].sort((x, y) => x - y);
    console.log("SPIKE R-003 conectores:", process.env.SPIKE_EDGES ?? 199, "peor fotograma (ms):", Math.round(Math.max(...gaps)), "p95:", Math.round(sorted[Math.floor(sorted.length * 0.95)]!), "fotogramas:", gaps.length);
    expect(gaps.length).toBeGreaterThan(10);
  }, 150000);
});
