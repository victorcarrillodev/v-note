// R-100 y R-102 (e2e real en Chrome, spec 004): puntos de quiebre con doble clic, curva continua y fluidez con muchos conectores con puntos.
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { Page } from "./cdp";
import { clickButton, ensureSpace, startWeb, type Web } from "./webHarness";

let web: Web;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
beforeAll(async () => { web = await startWeb(4195, 9354); }, 120000);
afterAll(() => web?.stop());
afterEach(async () => { await web?.closeAll(); });

async function openDiagram(p: Page) {
  await ensureSpace(p); await clickButton(p, "Nueva página");
  await p.waitFor("document.querySelector('[aria-label=\"Título de la página\"]')?.value === ''");
  await new Promise((r) => setTimeout(r, 500)); // el título se vuelve a montar al abrir la página: sin pausa se pierde lo escrito
  await p.click('[aria-label="Título de la página"]'); await p.typeText("Quiebres"); await p.key("Enter", "Enter", 13);
  await p.waitFor("document.querySelector('.bn-editor[contenteditable=true]')");
  await p.eval("document.querySelector('.bn-editor').focus()"); await sleep(300);
  await p.send("Input.dispatchKeyEvent", { type: "keyDown", key: "/", text: "/" }); await p.send("Input.dispatchKeyEvent", { type: "keyUp", key: "/" });
  await sleep(400); await p.typeText("diagrama"); await sleep(500); await p.key("Enter", "Enter", 13);
  await p.waitFor("document.querySelector('[data-testid=diagram] .react-flow')", 10000);
}
async function setDiagram(p: Page, diagram: unknown) {
  await p.eval(`(() => {
    const view = document.querySelector('.bn-editor').editor.view; let target = null;
    view.state.doc.descendants((node, pos) => { if (node.type.name === 'diagram') target = { node, pos }; });
    view.dispatch(view.state.tr.setNodeMarkup(target.pos, undefined, { ...target.node.attrs, data: JSON.stringify(${JSON.stringify(diagram)}) }));
  })()`);
}
const savedEdges = (p: Page) => p.eval<{ route: string; points?: { x: number; y: number }[]; waypoints?: { x: number; y: number }[] }[]>(`(() => { let out = []; document.querySelector('.bn-editor').editor.view.state.doc.descendants((n) => { if (n.type.name === 'diagram') out = JSON.parse(n.attrs.data).edges; }); return out; })()`);
const twoNodes = [
  { id: "a", shape: "process", x: 60, y: 60, w: 140, h: 60, text: "A" },
  { id: "b", shape: "process", x: 460, y: 220, w: 140, h: 60, text: "B" },
];
const edge = (route: string, extra: object = {}) => ({ id: "e1", from: { node: "a", anchor: "e" }, to: { node: "b", anchor: "w" }, route, label: "", ...extra });
/** Punto de la pantalla a una fracción del trazado del conector. */
const onScreen = (p: Page, t: number) => p.eval<{ x: number; y: number }>(`(() => { const path = document.querySelector('[data-testid=diagram] [data-connector-path]'); const pt = path.getPointAtLength(path.getTotalLength() * ${t}); const m = path.getScreenCTM(); return { x: pt.x * m.a + pt.y * m.c + m.e, y: pt.x * m.b + pt.y * m.d + m.f }; })()`);
const dblclick = async (p: Page, x: number, y: number) => {
  await p.send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
  for (const n of [1, 2]) {
    await p.send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: n });
    await p.send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: n });
  }
};
const viewportTransform = (p: Page) => p.eval<string>("document.querySelector('[data-testid=diagram] .react-flow__viewport').style.transform");

describe("agregar y quitar puntos de quiebre con doble clic (R-100)", () => {
  for (const route of ["curved", "orthogonal", "free"] as const) {
    it(`${route}: doble clic en el tramo agrega un punto y doble clic en el punto lo quita`, async () => {
      const p = await web.open();
      await openDiagram(p);
      await setDiagram(p, { version: 2, nodes: twoNodes, edges: [edge(route)] });
      await p.waitFor("document.querySelector('[data-testid=diagram] [data-connector-path]')", 10000);
      await p.eval("localStorage.setItem('vnote.canvas.grid', JSON.stringify({ show: true, snap: false }))");
      const mid = await onScreen(p, 0.5);
      await p.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: mid.x, y: mid.y });
      await p.send("Input.dispatchMouseEvent", { type: "mousePressed", x: mid.x, y: mid.y, button: "left", clickCount: 1 });
      await p.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: mid.x, y: mid.y, button: "left", clickCount: 1 });
      await sleep(400);
      const zoom0 = await viewportTransform(p);
      const at = await onScreen(p, 0.6);
      await dblclick(p, at.x, at.y); await sleep(500);
      let e = (await savedEdges(p))[0]!;
      const list = (route === "orthogonal" ? e.waypoints : e.points) ?? [];
      expect(list, "debe haberse agregado un punto").toHaveLength(1);
      expect(await viewportTransform(p), "el doble clic no hace zoom").toBe(zoom0);
      if (route === "curved") {
        const d = await p.eval<string>("document.querySelector('[data-testid=diagram] [data-connector-path]').getAttribute('d')");
        expect(d).toMatch(/^M [\d. -]+( C [\d. -]+)+$/);   // curva continua: sin tramos rectos
      }
      // doble clic sobre el punto: se elimina
      const pt = await p.center("[data-testid=diagram] [data-control-point='0'] [data-control-hit]");
      await dblclick(p, pt.x, pt.y); await sleep(500);
      e = (await savedEdges(p))[0]!;
      expect((route === "orthogonal" ? e.waypoints : e.points) ?? []).toHaveLength(0);
      expect(await viewportTransform(p), "tampoco hace zoom").toBe(zoom0);
    }, 150000);
  }
});

describe("fluidez con muchos conectores con puntos (R-102, RNF-1)", () => {
  it("200 formas y 300 conectores curvos con dos puntos cada uno", async () => {
    const p = await web.open();
    await openDiagram(p);
    const shapes = ["terminator", "process", "decision", "io", "note"];
    const nodes = Array.from({ length: 200 }, (_, i) => ({ id: "n" + i, shape: shapes[i % 5], x: (i % 20) * 220, y: Math.floor(i / 20) * 140, w: 140, h: 60, text: "Paso " + i }));
    const anchors = ["e", "s", "w", "n"];
    const edges = Array.from({ length: 300 }, (_, i) => { const a = i % 200, b = (a + 1 + (i % 37) * 5) % 200; const ax = (a % 20) * 220 + 70, ay = Math.floor(a / 20) * 140 + 30, bx = (b % 20) * 220 + 70, by = Math.floor(b / 20) * 140 + 30; return { id: "e" + i, from: { node: "n" + a, anchor: anchors[i % 4] }, to: { node: "n" + b, anchor: anchors[(i + 2) % 4] }, route: "curved", label: "", points: [{ x: ax + (bx - ax) / 3, y: ay + 40 }, { x: ax + (2 * (bx - ax)) / 3, y: by - 40 }] }; });
    await setDiagram(p, { version: 2, nodes, edges });
    await p.waitFor("document.querySelectorAll('[data-testid=diagram] .react-flow__node').length >= 4", 15000);
    await p.waitFor("document.querySelectorAll('[data-testid=diagram] [data-connector]').length >= 1", 15000);
    await p.eval(`window.__gaps = []; (function loop(last) { requestAnimationFrame((t) => { if (last) window.__gaps.push(t - last); loop(t); }); })(0)`);
    const r = await p.eval<{ left: number; top: number; width: number; height: number }>(`(() => { const r = document.querySelector('[data-testid=diagram] .react-flow').getBoundingClientRect(); return { left: r.left, top: r.top, width: r.width, height: r.height }; })()`);
    const a = { x: r.left + r.width - 30, y: r.top + r.height - 30 };
    await p.drag(a, { x: a.x - 120, y: a.y - 60 });
    for (let i = 0; i < 4; i++) { await p.send("Input.dispatchMouseEvent", { type: "mouseWheel", x: r.left + r.width / 2, y: r.top + r.height / 2, deltaX: 0, deltaY: -120, modifiers: 2 }); await sleep(60); }
    const c = await p.center("[data-testid=diagram] .react-flow__node [role=group]");
    await p.drag(c, { x: c.x + 60, y: c.y + 40 });
    await sleep(400);
    const gaps = await p.eval<number[]>("window.__gaps");
    const worst = Math.max(...gaps), sorted = [...gaps].sort((x, y) => x - y);
    console.log("R-102 peor fotograma (ms):", Math.round(worst), "p95:", Math.round(sorted[Math.floor(sorted.length * 0.95)]!), "fotogramas:", gaps.length);
    expect(gaps.length).toBeGreaterThan(10);
    expect(worst).toBeLessThan(250);
    expect(sorted[Math.floor(sorted.length * 0.95)]!).toBeLessThan(100);
  }, 150000);
});
