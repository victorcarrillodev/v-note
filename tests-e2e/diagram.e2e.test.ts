// T-324…T-336 (e2e real en Chrome): diagrama de flujo — insertar, formas, arrastrar, conectar, editar, eliminar, zoom, ajustar, deshacer, persistir.
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { Page } from "./cdp";
import { clickButton, ensureSpace, setValue, startWeb, type Web } from "./webHarness";

let web: Web;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
beforeAll(async () => { web = await startWeb(4179, 9338); }, 120000);
afterAll(() => web?.stop());
afterEach(async () => { await web?.closeAll(); });

const nodes = (p: Page) => p.eval<{ text: string; shape: string; x: number; y: number; w: number; h: number }[]>(
  `[...document.querySelectorAll('[data-testid=diagram] .react-flow__node')].map(n => { const g = n.querySelector('[role=group]'); return { text: g.innerText.trim(), shape: g.dataset.shape, x: Number(g.dataset.x), y: Number(g.dataset.y), w: n.getBoundingClientRect().width, h: n.getBoundingClientRect().height }; })`);
const canvas = (p: Page) => p.eval<{ left: number; top: number; width: number; height: number }>(`(() => { const r = document.querySelector('[data-testid=diagram] .react-flow').getBoundingClientRect(); return { left: r.left, top: r.top, width: r.width, height: r.height }; })()`);
const transform = (p: Page) => p.eval<{ x: number; y: number; k: number }>(`(() => { const m = new DOMMatrix(getComputedStyle(document.querySelector('[data-testid=diagram] .react-flow__viewport')).transform); return { x: m.e, y: m.f, k: m.a }; })()`);
const edgeCount = (p: Page) => p.eval<number>("document.querySelectorAll('[data-testid=diagram] [data-connector]').length");
const nodeIds = (p: Page) => p.eval<string[]>("[...document.querySelectorAll('[data-testid=diagram] .react-flow__node')].map(n => n.getAttribute('data-id'))");
const anchorHit = (id: string, anchor: string) => `[data-testid=diagram] [data-anchor-group][data-node="${id}"][data-anchor="${anchor}"] [data-anchor-hit]`;

async function openDiagram(p: Page) {
  await ensureSpace(p);
  await clickButton(p, "Nueva página");
  await p.waitFor("document.querySelector('[aria-label=\"Título de la página\"]')?.value === ''");
  await p.click('[aria-label="Título de la página"]'); await p.typeText("Flujo"); await p.key("Enter", "Enter", 13);
  await p.waitFor("document.querySelector('.bn-editor[contenteditable=true]')");
  await p.eval("document.querySelector('.bn-editor').focus()"); await sleep(300);
  await p.send("Input.dispatchKeyEvent", { type: "keyDown", key: "/", text: "/" }); await p.send("Input.dispatchKeyEvent", { type: "keyUp", key: "/" });
  await sleep(400); await p.typeText("diagrama"); await sleep(500); await p.key("Enter", "Enter", 13);
  await p.waitFor("document.querySelector('[data-testid=diagram] .react-flow')", 10000);
}

describe("diagrama de flujo en la aplicación real", () => {
  it("T-324…T-336: flujo completo y persistencia", async () => {
    const p = await web.open();
    await openDiagram(p);

    // T-324: bloque con lienzo vacío; T-335/CL-8: «Ajustar a pantalla» está disponible aun vacío
    expect(await nodes(p)).toEqual([]);
    expect(await p.eval<boolean>("[...document.querySelectorAll('button')].some(b => b.getAttribute('aria-label') === 'Ajustar a pantalla')")).toBe(true);

    // T-326: la paleta muestra las cinco formas
    expect(await p.eval<string[]>("[...document.querySelectorAll('[data-shape-button]')].map(b => b.dataset.shapeButton)")).toEqual(["terminator", "process", "decision", "io", "note"]);

    // T-327: arrastrar una forma de la paleta a un punto del lienzo la deja allí
    const cv = await canvas(p);
    const from = await p.center('[data-shape-button="process"]');
    const drop = { x: cv.left + 150, y: cv.top + 120 };
    await p.drag(from, drop);
    await p.waitFor("document.querySelectorAll('[data-testid=diagram] .react-flow__node').length === 1", 8000);
    let ns = await nodes(p);
    expect(ns[0]!.shape).toBe("process");
    // La forma soltada se acomoda a la cuadrícula de 20 (spec 004): queda a menos de media celda de donde se soltó.
    expect(Math.abs(ns[0]!.x - 150)).toBeLessThanOrEqual(10); expect(Math.abs(ns[0]!.y - 120)).toBeLessThanOrEqual(10);
    expect(ns[0]!.x % 20).toBe(0); expect(ns[0]!.y % 20).toBe(0);

    // una segunda forma con un clic en la paleta (accesible sin arrastrar)
    await p.click('[data-shape-button="decision"]');
    await p.waitFor("document.querySelectorAll('[data-testid=diagram] .react-flow__node').length === 2", 8000);
    // se aparta la segunda forma para que no tape los puntos de conexión de la primera
    const d0 = await p.center('[data-testid=diagram] .react-flow__node:nth-of-type(2) [role=group]');
    await p.drag(d0, { x: cv.left + 520, y: cv.top + 300 });
    await sleep(300);
    ns = await nodes(p);

    // T-328: mover la forma arrastrándola
    const n1 = await p.center('[data-testid=diagram] .react-flow__node:nth-of-type(1) [role=group]');
    await p.drag(n1, { x: n1.x + 60, y: n1.y + 40 });
    await sleep(300);
    const moved = (await nodes(p))[0]!;
    expect(Math.abs(moved.x - (ns[0]!.x + 60))).toBeLessThanOrEqual(8); // el arrastre de React Flow descuenta unos píxeles del umbral

    // T-329: editar el texto de la forma seleccionada
    await p.click('[data-testid=diagram] .react-flow__node:nth-of-type(1) [role=group]');
    await p.waitFor("document.querySelector('[role=region][aria-label=\"Propiedades de la forma\"]')");
    await setValue(p, '[role=region][aria-label="Propiedades de la forma"] input[aria-label="Texto"]', "Revisar");
    await p.waitFor("document.querySelector('[data-testid=diagram] .react-flow__node [role=group]').innerText.includes('Revisar')");

    // T-328: redimensionar con el tirador de la esquina de la forma seleccionada
    const wBefore = (await nodes(p))[0]!.w;
    const handle = await p.center('[data-testid=diagram] .react-flow__node:nth-of-type(1) .react-flow__resize-control.handle.bottom.right');
    await p.drag(handle, { x: handle.x + 50, y: handle.y + 20 });
    await sleep(300);
    expect((await nodes(p))[0]!.w).toBeGreaterThan(wBefore + 20);

    // T-332 (spec 003): cambiar el relleno con el selector de color (botón de la paleta)
    await p.eval(`document.querySelector('[role=region][aria-label="Propiedades de la forma"] button[aria-label="Relleno"][aria-expanded="false"]')?.click()`); await sleep(200);
    await p.eval(`[...document.querySelectorAll('[role=region][aria-label="Propiedades de la forma"] [role=group][aria-label=Relleno] button')].find(b => b.getAttribute('aria-label') === 'Verde').click()`);
    await p.waitFor("getComputedStyle(document.querySelector('[data-testid=diagram] .react-flow__node [role=group]')).backgroundColor === 'rgb(221, 241, 229)'");

    // T-330 (spec 003): conectar arrastrando de un punto de unión de una forma al de la otra; el conector sigue a las formas
    await p.eval("document.querySelector('[data-testid=diagram] .react-flow__pane').click()");
    const [idA, idB] = await nodeIds(p);
    await p.click('[data-testid=diagram] .react-flow__node:nth-of-type(1) [role=group]'); // seleccionar la forma muestra sus puntos de unión
    await p.waitFor(`document.querySelector('${anchorHit(idA!, "e")}')`, 5000);
    const h1 = await p.center(anchorHit(idA!, "e"));
    await p.drag(h1, await p.center('[data-testid=diagram] .react-flow__node:nth-of-type(2) [role=group]')); // se suelta sobre la forma: el imán busca el punto más cercano
    await p.waitFor("document.querySelectorAll('[data-testid=diagram] [data-connector]').length === 1", 8000);
    const pathBefore = await p.eval<string>("document.querySelector('[data-testid=diagram] [data-connector-path]').getAttribute('d')");
    const b2 = await p.center('[data-testid=diagram] .react-flow__node:nth-of-type(2) [role=group]');
    await p.drag(b2, { x: b2.x + 40, y: b2.y + 90 });
    await sleep(300);
    expect(await p.eval<string>("document.querySelector('[data-testid=diagram] [data-connector-path]').getAttribute('d')")).not.toBe(pathBefore);
    expect(idB).toBeTruthy();

    // CDP no emite `click` sobre el trazo SVG del conector; se usa el teclado, que React Flow soporta (Enter).
    await p.eval(`document.querySelector('[data-testid=diagram] [data-connector]').focus()`);
    await p.key('Enter', 'Enter', 13);
    await p.waitFor("document.querySelector('[role=region][aria-label=\"Propiedades del conector\"]')", 5000);
    await setValue(p, '[role=region][aria-label="Propiedades del conector"] input[aria-label="Texto del conector"]', "sí");
    await p.waitFor("document.querySelector('[data-testid=diagram] [data-connector] text')?.textContent.includes('sí')");

    // CL-9 / T-335: centrar en cualquiera de los extremos del conector
    await clickButton(p, "Centrar en el destino");
    await sleep(300);

    // T-334: zoom con los controles y desplazamiento arrastrando el fondo
    const k0 = (await transform(p)).k;
    await clickButton(p, "Acercar");
    await sleep(400);
    expect((await transform(p)).k).toBeGreaterThan(k0);
    await clickButton(p, "Alejar");
    await clickButton(p, "Alejar");
    await sleep(400);
    expect((await transform(p)).k).toBeLessThan(k0);
    const t0 = await transform(p);
    const cv2 = await canvas(p);
    await p.drag({ x: cv2.left + cv2.width - 30, y: cv2.top + cv2.height - 30 }, { x: cv2.left + cv2.width - 130, y: cv2.top + cv2.height - 80 });
    await sleep(300);
    const t1 = await transform(p);
    expect(t1.x).not.toBe(t0.x);

    // T-335: ajustar a pantalla deja todas las formas dentro del lienzo
    await clickButton(p, "Ajustar a pantalla");
    await sleep(500);
    const area = await canvas(p);
    const inside = await p.eval<boolean>(`[...document.querySelectorAll('[data-testid=diagram] .react-flow__node')].every(n => { const r = n.getBoundingClientRect(); return r.left >= ${area.left} - 1 && r.right <= ${area.left + area.width} + 1 && r.top >= ${area.top} - 1 && r.bottom <= ${area.top + area.height} + 1; })`);
    expect(inside).toBe(true);

    // T-333 (spec 003, RF-4): eliminar una forma NO pierde sus conectores: quedan con extremo libre y se informa
    await p.click('[data-testid=diagram] .react-flow__node:nth-of-type(1) [role=group]');
    await p.waitFor("document.querySelector('[role=region][aria-label=\"Propiedades de la forma\"]')");
    await clickButton(p, "Eliminar forma");
    await p.waitFor("document.querySelectorAll('[data-testid=diagram] .react-flow__node').length === 1", 5000);
    expect(await edgeCount(p)).toBe(1);
    expect(await p.eval<string>("document.querySelector('[data-diagram-notice]').innerText")).toMatch(/1 conector/);

    // T-336: deshacer devuelve la forma y reúne su conector; rehacer vuelve a liberarlo
    await clickButton(p, "Deshacer");
    await p.waitFor("document.querySelectorAll('[data-testid=diagram] .react-flow__node').length === 2", 5000);
    expect(await edgeCount(p)).toBe(1);
    await clickButton(p, "Rehacer");
    await p.waitFor("document.querySelectorAll('[data-testid=diagram] .react-flow__node').length === 1", 5000);
    await clickButton(p, "Deshacer");
    await p.waitFor("document.querySelectorAll('[data-testid=diagram] .react-flow__node').length === 2", 5000);

    // T-325: el estado persiste al recargar
    await sleep(1500);
    await p.reload();
    await p.waitFor("document.querySelector('aside nav')", 20000);
    await p.eval("[...document.querySelectorAll('[role=treeitem]')].find(e => e.getAttribute('aria-label') === 'Flujo').click()");
    await p.waitFor("document.querySelectorAll('[data-testid=diagram] .react-flow__node').length === 2", 15000);
    expect(await edgeCount(p)).toBe(1);
    expect((await nodes(p)).some((n) => n.text.includes("Revisar"))).toBe(true);
    await p.close();
  }, 180000);
});
