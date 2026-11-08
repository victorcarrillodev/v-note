// G-160 a G-164 (e2e real en Chrome, spec 003): estilo de formas y conectores, valores predeterminados por espacio y portapapeles.
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { Page } from "./cdp";
import { clickButton, ensureSpace, newPage, openFromTree, setValue, startWeb, type Web } from "./webHarness";

let web: Web;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
beforeAll(async () => { web = await startWeb(4187, 9346); }, 120000);
afterAll(() => web?.stop());
afterEach(async () => { await web?.closeAll(); });

const Q = "[data-testid=diagram]";
const nodeSel = (i: number) => `${Q} .react-flow__node:nth-of-type(${i}) [role=group]`;
const count = (p: Page, sel: string) => p.eval<number>(`document.querySelectorAll('${sel}').length`);
const shapeRegion = '[role=region][aria-label="Propiedades de la forma"]';
const edgeRegion = '[role=region][aria-label="Propiedades del conector"]';
const pickColor = (p: Page, region: string, group: string, name: string) =>
  p.eval(`[...document.querySelectorAll('${region} [role=group][aria-label="${group}"] button')].find(b => b.getAttribute('aria-label') === ${JSON.stringify(name)}).click()`);

async function insertDiagram(p: Page) {
  await p.eval("document.querySelector('.bn-editor').focus()"); await sleep(300);
  await p.send("Input.dispatchKeyEvent", { type: "keyDown", key: "/", text: "/" }); await p.send("Input.dispatchKeyEvent", { type: "keyUp", key: "/" });
  await sleep(400); await p.typeText("diagrama"); await sleep(500); await p.key("Enter", "Enter", 13);
  await p.waitFor(`document.querySelector('${Q} .react-flow')`, 10000);
}
async function pageWithDiagram(p: Page, title: string) { await newPage(p, title); await insertDiagram(p); }
const addShape = async (p: Page, shape: string, expected: number) => { await p.click(`[data-shape-button="${shape}"]`); await p.waitFor(`document.querySelectorAll('${Q} .react-flow__node').length === ${expected}`, 8000); await sleep(200); };
/** Abre el menú del espacio activo (Radix lo abre con el ratón) y elige una opción. */
const menuItem = async (p: Page, text: string) => {
  await p.click("aside button");
  await p.waitFor("document.querySelector('[role=menuitem]')", 5000);
  await p.eval(`[...document.querySelectorAll('[role=menuitem]')].find(e => e.innerText.trim() === ${JSON.stringify(text)}).click()`);
};
const reopen = async (p: Page, title: string, nodes: number) => {
  await sleep(1500); await p.reload();
  await p.waitFor("document.querySelector('aside nav')", 20000);
  await openFromTree(p, title);
  await p.waitFor(`document.querySelectorAll('${Q} .react-flow__node').length === ${nodes}`, 15000);
};
const fill = (p: Page, i = 1) => p.eval<{ fill: string; opacity: string }>(`(() => { const g = document.querySelector('${nodeSel(i)}'); return { fill: g.dataset.fill, opacity: g.dataset.fillOpacity }; })()`);

describe("estilo y portapapeles en el navegador real", () => {
  it("G-160 y G-164: relleno, opacidad, contorno y texto se aplican, se deshacen, se rehacen y sobreviven a recargar", async () => {
    const p = await web.open();
    await ensureSpace(p); await pageWithDiagram(p, "Estilos");
    await addShape(p, "process", 1);
    await p.click(nodeSel(1));
    await p.waitFor(`document.querySelector('${shapeRegion}')`, 5000);
    await pickColor(p, shapeRegion, "Relleno", "Rojo");
    expect((await fill(p)).fill).toBe("palette:red");
    await setValue(p, `${shapeRegion} input[aria-label="Relleno: hexadecimal"]`, "#ff8800");
    await p.waitFor(`document.querySelector('${nodeSel(1)}').dataset.fill === '#ff8800'`, 5000);
    await setValue(p, `${shapeRegion} input[aria-label="Opacidad del relleno"]`, "40");
    await p.waitFor(`document.querySelector('${nodeSel(1)}').dataset.fillOpacity === '0.4'`, 5000);
    await setValue(p, `${shapeRegion} select[aria-label="Grosor del contorno"]`, "4");
    await setValue(p, `${shapeRegion} select[aria-label="Tipo de línea del contorno"]`, "dashed");
    await pickColor(p, shapeRegion, "Contorno", "Verde");
    await pickColor(p, shapeRegion, "Color del texto", "Azul");
    const css = await p.eval<{ border: string; color: string; bg: string }>(`(() => { const s = getComputedStyle(document.querySelector('${nodeSel(1)}')); return { border: s.borderTopWidth + ' ' + s.borderTopStyle, color: s.color, bg: s.backgroundColor }; })()`);
    expect(css.border).toBe("4px dashed");
    expect(css.bg).toMatch(/color\(srgb 1 0\.5333\d* 0 \/ 0\.4\)|rgba\(255, 136, 0, 0\.4\)/); // el naranja personalizado al 40 % de opacidad
    // deshacer y rehacer la opacidad
    await clickButton(p, "Deshacer"); await clickButton(p, "Deshacer"); await clickButton(p, "Deshacer");
    expect((await fill(p)).opacity).toBe("0.4");
    for (let i = 0; i < 4; i++) await clickButton(p, "Deshacer");
    await p.waitFor(`document.querySelector('${nodeSel(1)}').dataset.fillOpacity === '1'`, 5000);
    for (let i = 0; i < 7; i++) await clickButton(p, "Rehacer");
    await p.waitFor(`document.querySelector('${nodeSel(1)}').dataset.fill === '#ff8800' && document.querySelector('${nodeSel(1)}').dataset.fillOpacity === '0.4'`, 5000);
    await reopen(p, "Estilos", 1);
    expect(await fill(p)).toEqual({ fill: "#ff8800", opacity: "0.4" });
    const after = await p.eval<string>(`(() => { const s = getComputedStyle(document.querySelector('${nodeSel(1)}')); return s.borderTopWidth + ' ' + s.borderTopStyle; })()`);
    expect(after).toBe("4px dashed");
    await p.close();
  }, 180000);

  it("G-161 y G-164: estilo del conector con puntas distintas, persistente y reversible", async () => {
    const p = await web.open();
    await ensureSpace(p); await pageWithDiagram(p, "Conectores");
    const cv = await p.eval<{ left: number; top: number }>(`(() => { const r = document.querySelector('${Q} .react-flow').getBoundingClientRect(); return { left: r.left, top: r.top }; })()`);
    await p.drag(await p.center('[data-shape-button="process"]'), { x: cv.left + 40, y: cv.top + 50 });
    await p.waitFor(`document.querySelectorAll('${Q} .react-flow__node').length === 1`, 8000);
    await addShape(p, "note", 2);
    await p.drag(await p.center(nodeSel(2)), { x: cv.left + 330, y: cv.top + 250 }); await sleep(300);
    const [a] = await p.eval<string[]>(`[...document.querySelectorAll('${Q} .react-flow__node')].map(n => n.getAttribute('data-id'))`);
    await p.click(nodeSel(1));
    await p.waitFor(`document.querySelector('${Q} [data-anchor-group][data-node="${a}"][data-anchor="e"] [data-anchor-hit]')`, 5000);
    const b = await p.eval<{ left: number; top: number; height: number }>(`(() => { const r = document.querySelector('${nodeSel(2)}').getBoundingClientRect(); return { left: r.left, top: r.top, height: r.height }; })()`);
    await p.drag(await p.center(`${Q} [data-anchor-group][data-node="${a}"][data-anchor="e"] [data-anchor-hit]`), { x: b.left + 2, y: b.top + b.height / 2 + 2 });
    await p.waitFor(`document.querySelectorAll('${Q} [data-connector]').length === 1`, 8000);
    await p.eval(`document.querySelector('${Q} [data-connector]').focus()`); await p.key("Enter", "Enter", 13);
    await p.waitFor(`document.querySelector('${edgeRegion}')`, 5000);
    await pickColor(p, edgeRegion, "Color de la línea", "Rojo");
    await setValue(p, `${edgeRegion} select[aria-label="Grosor de la línea"]`, "thick");
    await setValue(p, `${edgeRegion} select[aria-label="Tipo de línea"]`, "dotted");
    await setValue(p, `${edgeRegion} select[aria-label="Punta de origen"]`, "circle");
    await setValue(p, `${edgeRegion} select[aria-label="Punta de destino"]`, "diamond");
    const caps = () => p.eval<string[]>(`[...document.querySelectorAll('${Q} [data-cap]')].map(c => c.getAttribute('data-cap')).sort()`);
    expect(await caps()).toEqual(["circle", "diamond"]);
    expect(await p.eval<string>(`document.querySelector('${Q} [data-connector-path]').getAttribute('stroke-dasharray')`)).toBe("4 10");
    await clickButton(p, "Deshacer"); await p.waitFor(`[...document.querySelectorAll('${Q} [data-cap]')].map(c => c.getAttribute('data-cap')).sort().join() === 'arrow,circle'`, 5000); // la punta de destino vuelve a la flecha
    await clickButton(p, "Rehacer"); await p.waitFor(`[...document.querySelectorAll('${Q} [data-cap]')].map(c => c.getAttribute('data-cap')).sort().join() === 'circle,diamond'`, 5000);
    await reopen(p, "Conectores", 2);
    expect(await caps()).toEqual(["circle", "diamond"]);
    expect(await p.eval<string>(`document.querySelector('${Q} [data-connector-path]').getAttribute('stroke')`)).toBe("var(--block-red-text)");
    await p.close();
  }, 180000);

  it("G-162: los estilos predeterminados son de cada espacio de trabajo", async () => {
    const p = await web.open();
    await ensureSpace(p, "Personal"); await pageWithDiagram(p, "Uno");
    await addShape(p, "process", 1);
    await p.click(nodeSel(1));
    await p.waitFor(`document.querySelector('${shapeRegion}')`, 5000);
    await pickColor(p, shapeRegion, "Relleno", "Verde");
    await p.eval(`[...document.querySelectorAll('${shapeRegion} button')].find(b => b.innerText.trim() === 'Usar como predeterminado').click()`);
    await p.waitFor(`document.querySelector('${Q} [data-diagram-notice]')?.innerText.includes('predeterminado')`, 5000);
    await addShape(p, "process", 2);
    expect((await fill(p, 2)).fill).toBe("palette:green");
    expect((await fill(p, 1)).fill).toBe("palette:green");
    // espacio nuevo: sus formas nacen con el estilo del sistema
    await sleep(1500);
    await menuItem(p, "Gestionar espacios");
    await p.waitFor("document.querySelector('input[aria-label=\"Nombre del espacio\"]')", 10000);
    await setValue(p, 'input[aria-label="Nombre del espacio"]', "Trabajo");
    await clickButton(p, "Crear espacio");
    await p.waitFor("document.querySelector('aside button')?.innerText.includes('Trabajo')", 15000);
    await pageWithDiagram(p, "Otro");
    await addShape(p, "process", 1);
    expect((await fill(p)).fill).toBe("palette:blue");
    // de vuelta en el primero: sigue el predeterminado verde
    await sleep(1500);
    await menuItem(p, "Personal");
    await p.waitFor("document.querySelector('aside button')?.innerText.includes('Personal') && document.querySelector('aside nav')", 15000);
    await sleep(800);
    await newPage(p, "Dos"); await insertDiagram(p);
    await addShape(p, "process", 1);
    expect((await fill(p)).fill).toBe("palette:green");
    // se deja el espacio como estaba para no afectar a otras pruebas del mismo perfil
    await p.click(nodeSel(1));
    await p.eval(`[...document.querySelectorAll('${shapeRegion} button')].find(b => b.innerText.trim() === 'Restablecer predeterminados').click()`);
    await p.waitFor(`document.querySelector('${Q} [data-diagram-notice]')?.innerText.includes('Se restablecieron')`, 5000);
    await p.close();
  }, 240000);

  it("G-163 y G-164: copiar y pegar dentro de un diagrama y entre dos; cada pegado se deshace de una vez", async () => {
    const p = await web.open();
    await ensureSpace(p); await pageWithDiagram(p, "Origen");
    await addShape(p, "process", 1);
    const source = await fill(p);
    await p.click(nodeSel(1));
    await clickButton(p, "Copiar");
    await clickButton(p, "Pegar");
    await p.waitFor(`document.querySelectorAll('${Q} .react-flow__node').length === 2`, 5000);
    await clickButton(p, "Pegar");
    await p.waitFor(`document.querySelectorAll('${Q} .react-flow__node').length === 3`, 5000);
    await clickButton(p, "Deshacer");
    await p.waitFor(`document.querySelectorAll('${Q} .react-flow__node').length === 2`, 5000);
    await clickButton(p, "Rehacer");
    await p.waitFor(`document.querySelectorAll('${Q} .react-flow__node').length === 3`, 5000);
    // entre dos diagramas
    await sleep(1500);
    await pageWithDiagram(p, "Destino");
    await clickButton(p, "Pegar");
    await p.waitFor(`document.querySelectorAll('${Q} .react-flow__node').length === 1`, 5000);
    expect((await fill(p)).fill).toBe(source.fill); // el pegado conserva el estilo del original
    await p.close();
  }, 180000);
});
