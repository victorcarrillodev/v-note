// G-080, G-081, G-082 (e2e real en Chrome, spec 003): conectar a un anclaje concreto, seguimiento al mover/redimensionar y extremos libres.
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Page } from "./cdp";
import { clickButton, ensureSpace, startWeb, type Web } from "./webHarness";

const AXE = readFileSync(resolve(__dirname, "../node_modules/axe-core/axe.min.js"), "utf8");
let web: Web;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
beforeAll(async () => { web = await startWeb(4183, 9342); }, 120000);
afterAll(() => web?.stop());
afterEach(async () => { await web?.closeAll(); });

const Q = "[data-testid=diagram]";
const nodeById = (id: string) => `${Q} .react-flow__node[data-id="${id}"] [role=group]`;
const node = (i: number) => `${Q} .react-flow__node:nth-of-type(${i}) [role=group]`;
const ids = (p: Page) => p.eval<string[]>(`[...document.querySelectorAll('${Q} .react-flow__node')].map(n => n.getAttribute('data-id'))`);
const hitSel = (id: string, a: string) => `${Q} [data-anchor-group][data-node="${id}"][data-anchor="${a}"] [data-anchor-hit]`;
const names = (p: Page) => p.eval<string[]>(`[...document.querySelectorAll('${Q} [data-connector]')].map(g => g.getAttribute('aria-label'))`);
const pathD = (p: Page) => p.eval<string>(`document.querySelector('${Q} [data-connector-path]').getAttribute('d')`);
const rect = (p: Page, sel: string) => p.eval<{ left: number; top: number; width: number; height: number }>(`(() => { const r = document.querySelector('${sel}').getBoundingClientRect(); return { left: r.left, top: r.top, width: r.width, height: r.height }; })()`);

async function openTwoShapes(p: Page) {
  await ensureSpace(p); await clickButton(p, "Nueva página");
  await p.waitFor("document.querySelector('[aria-label=\"Título de la página\"]')?.value === ''");
  await p.click('[aria-label="Título de la página"]'); await p.typeText("Flujo"); await p.key("Enter", "Enter", 13);
  await p.waitFor("document.querySelector('.bn-editor[contenteditable=true]')");
  await p.eval("document.querySelector('.bn-editor').focus()"); await sleep(300);
  await p.send("Input.dispatchKeyEvent", { type: "keyDown", key: "/", text: "/" }); await p.send("Input.dispatchKeyEvent", { type: "keyUp", key: "/" });
  await sleep(400); await p.typeText("diagrama"); await sleep(500); await p.key("Enter", "Enter", 13);
  await p.waitFor(`document.querySelector('${Q} .react-flow')`, 10000);
  const cv = await rect(p, `${Q} .react-flow`);
  await p.drag(await p.center('[data-shape-button="process"]'), { x: cv.left + 40, y: cv.top + 50 });
  await p.waitFor(`document.querySelectorAll('${Q} .react-flow__node').length === 1`, 8000);
  await p.click('[data-shape-button="note"]');
  await p.waitFor(`document.querySelectorAll('${Q} .react-flow__node').length === 2`, 8000);
  await p.drag(await p.center(node(2)), { x: cv.left + 330, y: cv.top + 250 }); // el lienzo mide unos 500 px de ancho: todo debe quedar dentro
  await sleep(300);
  return cv;
}
const reopen = async (p: Page) => {
  await sleep(1500); await p.reload();
  await p.waitFor("document.querySelector('aside nav')", 20000);
  await p.eval("[...document.querySelectorAll('[role=treeitem]')].find(e => e.getAttribute('aria-label') === 'Flujo').click()");
  await p.waitFor(`document.querySelectorAll('${Q} .react-flow__node').length === 2`, 15000);
};

describe("conexión por anclajes en el navegador real", () => {
  it("G-080: se conecta al anclaje elegido (abajo → arriba) y sigue ahí tras recargar", async () => {
    const p = await web.open();
    await openTwoShapes(p);
    const [a] = await ids(p);
    await p.click(node(1));                                           // seleccionar la forma muestra sus puntos de unión
    await p.waitFor(`document.querySelector('${hitSel(a!, "s")}')`, 5000);
    const from = await p.center(hitSel(a!, "s"));
    const b = await rect(p, node(2));
    await p.drag(from, { x: b.left + b.width / 2 + 3, y: b.top + 3 });  // junto al punto superior de la segunda forma: el imán lo une
    await p.waitFor(`document.querySelectorAll('${Q} [data-connector]').length === 1`, 8000);
    expect((await names(p))[0]).toMatch(/\(abajo\) a .* \(arriba\)$/);
    await reopen(p);
    expect((await names(p))[0]).toMatch(/\(abajo\) a .* \(arriba\)$/);
    await p.close();
  }, 120000);

  it("G-081: al mover y redimensionar las formas el conector sigue en los mismos anclajes", async () => {
    const p = await web.open();
    await openTwoShapes(p);
    const [a, bId] = await ids(p);
    await p.click(node(1));
    await p.waitFor(`document.querySelector('${hitSel(a!, "e")}')`, 5000);
    const b = await rect(p, nodeById(bId!));
    await p.drag(await p.center(hitSel(a!, "e")), { x: b.left + 2, y: b.top + b.height / 2 + 2 }); // oeste de la segunda forma
    await p.waitFor(`document.querySelectorAll('${Q} [data-connector]').length === 1`, 8000);
    const label = (await names(p))[0];
    const d0 = await pathD(p);
    const c = await p.center(nodeById(bId!));
    await p.drag(c, { x: c.x + 30, y: c.y - 50 });                    // mover (hacia arriba: el tirador debe seguir dentro del lienzo)
    await sleep(300);
    expect(await pathD(p)).not.toBe(d0);
    expect((await names(p))[0]).toBe(label);
    const d1 = await pathD(p);
    await p.click(nodeById(bId!));
    const handle = await p.center(`${Q} .react-flow__node[data-id="${bId}"] .react-flow__resize-control.handle.bottom.right`);
    await p.drag(handle, { x: handle.x + 40, y: handle.y + 30 });     // redimensionar
    await sleep(300);
    expect(await pathD(p)).not.toBe(d1);
    expect((await names(p))[0]).toBe(label);
    await p.close();
  }, 120000);

  it("G-082: extremo libre, volver a unirlo y borrar una forma con conectores (deshacer)", async () => {
    const p = await web.open();
    const cv = await openTwoShapes(p);
    const [a] = await ids(p);
    await p.click(node(1));
    await p.waitFor(`document.querySelector('${hitSel(a!, "e")}')`, 5000);
    await p.drag(await p.center(hitSel(a!, "e")), { x: cv.left + 300, y: cv.top + 40 });            // al vacío: queda libre
    await p.waitFor(`document.querySelectorAll('${Q} [data-connector]').length === 1`, 8000);
    expect((await names(p))[0]).toMatch(/\(derecha\) a extremo libre$/);

    // volver a unirlo: seleccionar el conector (Enter) y arrastrar su asa de destino al oeste de la segunda forma
    await p.eval(`document.querySelector('${Q} [data-connector]').focus()`); await p.key("Enter", "Enter", 13);
    await p.waitFor(`document.querySelector('${Q} [data-end-handle="to"] [data-end-hit]')`, 5000);
    const b = await rect(p, node(2));
    await p.drag(await p.center(`${Q} [data-end-handle="to"] [data-end-hit]`), { x: b.left + 2, y: b.top + b.height / 2 });
    await sleep(300);
    expect((await names(p))[0]).toMatch(/\(derecha\) a .* \(izquierda\)$/);

    // borrar la primera forma: el conector se conserva con el origen libre; deshacer lo reúne
    await p.click(node(1));
    await clickButton(p, "Eliminar forma");
    await p.waitFor(`document.querySelectorAll('${Q} .react-flow__node').length === 1`, 5000);
    expect((await names(p))[0]).toMatch(/^Conector de extremo libre a /);
    await clickButton(p, "Deshacer");
    await p.waitFor(`document.querySelectorAll('${Q} .react-flow__node').length === 2`, 5000);
    expect((await names(p))[0]).toMatch(/\(derecha\) a .* \(izquierda\)$/);
    await p.close();
  }, 120000);

  it("G-083 y G-166: axe sin infracciones graves en el editor con un conector y con una forma seleccionados, en claro y oscuro", async () => {
    const p = await web.open();
    await openTwoShapes(p);
    const [a] = await ids(p);
    await p.click(node(1));
    await p.waitFor(`document.querySelector('${hitSel(a!, "e")}')`, 5000);
    const b = await rect(p, node(2));
    await p.drag(await p.center(hitSel(a!, "e")), { x: b.left + 2, y: b.top + b.height / 2 + 2 });
    await p.waitFor(`document.querySelectorAll('${Q} [data-connector]').length === 1`, 8000);
    await p.eval(`document.querySelector('${Q} [data-connector]').focus()`); await p.key("Enter", "Enter", 13);
    await p.waitFor(`document.querySelector('${Q} [data-end-handle]')`, 5000);
    await p.eval(AXE);
    const audit = async (label: string) => {
      for (const theme of ["light", "dark"] as const) {
        await p.eval(`document.documentElement.setAttribute('data-theme', '${theme}')`); await sleep(300);
        const bad = await p.eval<{ id: string; impact: string; nodes: { target: string[]; html: string }[] }[]>(`axe.run(document.querySelector('${Q}'), { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } }).then(r => r.violations.filter(v => v.impact === 'serious' || v.impact === 'critical').map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.slice(0, 3).map(n => ({ target: n.target, html: n.html.slice(0, 160) })) })))`);
        if (bad.length) console.log(`AXE [${label} ${theme}]`, JSON.stringify(bad, null, 1).slice(0, 2500));
        expect(bad, `${label} ${theme}`).toEqual([]);
      }
    };
    await audit("conector (panel de trazado y estilo)");
    // forma seleccionada: panel de estilo con paleta, campos hexadecimales, controles de opacidad y aviso
    await p.click(node(1));
    await p.waitFor(`document.querySelector('[role=region][aria-label="Propiedades de la forma"] button[aria-label="Relleno"]')`, 5000);
    await audit("forma (panel de estilo)");
    await p.close();
  }, 120000);
});
