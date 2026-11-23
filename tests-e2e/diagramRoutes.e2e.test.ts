// G-119, G-120 (e2e real en Chrome, spec 003): crear y ajustar los cuatro trazados y deshacer/rehacer cada acción.
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Page } from "./cdp";
import { clickButton, ensureSpace, setValue, startWeb, type Web } from "./webHarness";

const AXE = readFileSync(resolve(__dirname, "../node_modules/axe-core/axe.min.js"), "utf8");
let web: Web;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
beforeAll(async () => { web = await startWeb(4185, 9344); }, 120000);
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

const d = (p: Page) => pathD(p);
const click = (p: Page, text: string) => clickButton(p, text);
const waitD = async (p: Page, differentFrom: string) => { await p.waitFor(`document.querySelector('${Q} [data-connector-path]').getAttribute('d') !== ${JSON.stringify(differentFrom)}`, 5000); return pathD(p); };

describe("trazados en el navegador real", () => {
  it("G-119 y G-120: cada trazado se crea, se ajusta, se deshace y se rehace", async () => {
    const p = await web.open();
    await openTwoShapes(p);
    const [a] = await ids(p);
    await p.click(node(1));
    await p.waitFor(`document.querySelector('${hitSel(a!, "e")}')`, 5000);
    const b = await rect(p, node(2));
    await p.drag(await p.center(hitSel(a!, "e")), { x: b.left + 2, y: b.top + b.height / 2 + 2 });
    await p.waitFor(`document.querySelectorAll('${Q} [data-connector]').length === 1`, 8000);
    await p.eval(`document.querySelector('${Q} [data-connector]').focus()`); await p.key("Enter", "Enter", 13);
    const panel = '[role=region][aria-label="Propiedades del conector"]';
    await p.waitFor(`document.querySelector('${panel}')`, 5000);

    // 90°: solo tramos H/V; arrastrar el tramo central lo mueve (punto de paso)
    const d0 = await d(p);
    expect(d0).not.toMatch(/ C /); expect(d0).toMatch(/^M [\d.-]+ [\d.-]+( L [\d.-]+ [\d.-]+)+$/);
    await p.waitFor(`document.querySelectorAll('${Q} [data-segment-handle]').length >= 1`, 5000);
    const seg = await p.center(`${Q} [data-segment-handle] [data-segment-hit]`);
    await p.drag(seg, { x: seg.x + 25, y: seg.y + 25 });
    const d1 = await waitD(p, d0);
    expect((await names(p))[0]).toMatch(/\(derecha\) a .* \(izquierda\)$/); // se movió el tramo, no se despegó ningún extremo
    await click(p, "Deshacer"); expect(await waitD(p, d1)).toBe(d0);
    await click(p, "Rehacer"); expect(await waitD(p, d0)).toBe(d1);

    // redondeado: cambia a curva; arrastrar el asa cambia la curvatura
    await setValue(p, `${panel} [role=combobox][aria-label="Trazado"]`, "curved");
    const d2 = await waitD(p, d1);
    expect(d2).toMatch(/ C /);
    await p.waitFor(`document.querySelector('${Q} [data-curve-hit]')`, 5000);
    const h = await p.center(`${Q} [data-curve-hit]`);
    await p.drag(h, { x: h.x + 40, y: h.y });
    const d3 = await waitD(p, d2);
    await click(p, "Deshacer"); expect(await waitD(p, d3)).toBe(d2);
    await click(p, "Rehacer"); expect(await waitD(p, d2)).toBe(d3);

    // libre: añadir un punto desde el panel, arrastrarlo y suavizar
    await setValue(p, `${panel} [role=combobox][aria-label="Trazado"]`, "free");
    const d4 = await waitD(p, d3);
    expect(d4).toMatch(/^M [\d.-]+ [\d.-]+ L [\d.-]+ [\d.-]+$/);
    await click(p, "Añadir punto");
    const d5 = await waitD(p, d4);
    const cp = await p.center(`${Q} [data-control-hit]`);
    await p.drag(cp, { x: cp.x + 30, y: cp.y - 40 });
    const d6 = await waitD(p, d5);
    // arrastrar un punto lo selecciona y su menú sustituye al del conector (R-093): se vuelve a seleccionar el conector
    await p.eval(`document.querySelector('${Q} [data-connector]').focus()`); await p.key("Enter", "Enter", 13);
    await p.waitFor(`document.querySelector('${panel}')`, 5000);
    await p.eval(`[...document.querySelectorAll('${panel} label')].find(l => l.innerText.includes('Suavizado')).querySelector('input').click()`);
    const d7 = await waitD(p, d6);
    expect(d7).toMatch(/ C /);
    await click(p, "Deshacer"); expect(await waitD(p, d7)).toBe(d6);
    await click(p, "Deshacer"); expect(await waitD(p, d6)).toBe(d5);
    await click(p, "Rehacer"); await click(p, "Rehacer"); expect(await waitD(p, d5)).toBe(d7);

    // recto: una sola línea
    await setValue(p, `${panel} [role=combobox][aria-label="Trazado"]`, "straight");
    expect(await waitD(p, d7)).toMatch(/^M [\d.-]+ [\d.-]+ L [\d.-]+ [\d.-]+$/);
    await p.close();
  }, 150000);
});
