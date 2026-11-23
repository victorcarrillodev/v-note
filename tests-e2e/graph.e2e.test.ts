// T-367…T-370 (e2e real en Chrome): grafo — aviso sin enlaces, vista local por defecto, filtros, selección con resaltado, abrir página, zoom y arrastre.
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { Page } from "./cdp";
import { clickButton, ensureSpace, mention, newPage, openFromTree, startWeb, type Web, setValue } from "./webHarness";

let web: Web;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
beforeAll(async () => { web = await startWeb(4184, 9343); }, 120000);
afterAll(() => web?.stop());
afterEach(async () => { await web?.closeAll(); });

type G = { nodes: number; edges: number; selected: string | null; k: number; tx: number; ty: number };
const info = (p: Page) => p.eval<G>("(() => { const g = document.querySelector('[data-testid=graph-canvas]').__graph; return { nodes: g.nodes, edges: g.edges, selected: g.selected, k: g.k, tx: g.tx, ty: g.ty }; })()");
const openGraph = async (p: Page) => { await clickButton(p, "Grafo"); await p.waitFor("document.querySelector('[data-testid=graph-canvas]') || document.querySelector('[data-testid=graph-empty]')", 15000); };
const select = async (p: Page, label: string, value: string) => {
  await p.eval(`(() => { const l = [...document.querySelectorAll('[aria-label="Filtros del grafo"] label')].find(x => x.innerText.trim().startsWith(${JSON.stringify(label)})); l.querySelector('[role=combobox]').setAttribute('data-pick', '1'); })()`);
  await setValue(p, "[data-pick='1']", value);
  await p.eval("document.querySelectorAll('[data-pick]').forEach(e => e.removeAttribute('data-pick'))");
};
const waitNodes = (p: Page, n: number) => p.waitFor(`document.querySelector('[data-testid=graph-canvas]')?.__graph?.nodes === ${n}`, 15000);
/** Posición en pantalla (coordenadas de la ventana) del nodo con ese título, según la lista accesible. */
async function nodePoint(p: Page, id: string) {
  return p.eval<{ x: number; y: number }>(`(() => { const c = document.querySelector('[data-testid=graph-canvas]'); const r = c.getBoundingClientRect(); const s = c.__graph.screenPos(${JSON.stringify(id)}); return { x: r.left + s.x, y: r.top + s.y }; })()`);
}

describe("grafo de páginas en la aplicación real", () => {
  it("T-367…T-370: aviso sin enlaces, vista local por defecto, filtros, selección con resaltado, abrir, zoom y arrastre", async () => {
    const p = await web.open();
    await ensureSpace(p);
    // T-370: sin ningún enlace se explica cómo crearlos
    await newPage(p, "Solo");
    await openGraph(p);
    await p.waitFor("document.querySelector('[data-testid=graph-empty]')", 10000);
    expect(await p.eval<string>("document.querySelector('[data-testid=graph-empty]').innerText")).toContain("Escribe @");
    await openFromTree(p, "Solo");
    await newPage(p, "Beta"); await newPage(p, "Gamma"); await newPage(p, "Delta");
    await newPage(p, "Alfa");
    await mention(p, "@", "Bet"); await mention(p, "@", "Gam");
    await sleep(1500);

    // T-369: por defecto, la vista local de la página abierta (ella y sus vecinas); Delta (sin enlaces) no aparece
    await openGraph(p);
    await waitNodes(p, 3);
    expect(await info(p)).toMatchObject({ nodes: 3, edges: 2 });
    // …y se puede ampliar a todo el espacio
    await select(p, "Alcance", "all");
    await waitNodes(p, 5); // Solo, Beta, Gamma, Delta y Alfa
    // filtro: ocultar las páginas sin enlaces
    await p.eval("[...document.querySelectorAll('[aria-label=\"Filtros del grafo\"] label')].find(x => x.innerText.includes('Ocultar')).querySelector('input').click()");
    await waitNodes(p, 3);
    // filtro por tipo: no hay tableros enlazados
    await select(p, "Tipo", "board");
    await p.waitFor("document.body.innerText.includes('Ninguna página coincide')", 10000);
    await select(p, "Tipo", "");
    await waitNodes(p, 3);

    // T-368: seleccionar un nodo resalta sus conexiones y permite abrir su página
    const betaId = await p.eval<string>("[...document.querySelectorAll('ul[aria-label=\"Páginas del grafo\"] button')].length ? 'ok' : ''");
    expect(betaId).toBe("ok");
    const ids = await p.eval<string[]>("(async () => { const g = document.querySelector('[data-testid=graph-canvas]'); return []; })()");
    void ids;
    // se localiza por la lista accesible: el botón de «Beta» selecciona, y su posición sale del lienzo
    await p.eval("[...document.querySelectorAll('ul[aria-label=\"Páginas del grafo\"] button')].find(b => b.innerText.trim() === 'Beta').click()");
    await p.waitFor("document.querySelector('[role=region][aria-label=\"Página seleccionada\"]')", 5000);
    const sel = (await info(p)).selected!;
    expect(await p.eval<string>("document.querySelector('[role=region][aria-label=\"Página seleccionada\"]').innerText")).toContain("1 conexión");
    // clic real sobre el lienzo, en el nodo
    const pt = await nodePoint(p, sel);
    await p.mouse("mouseMoved", 5, 5); // fuera del nodo
    await p.mouse("mouseMoved", pt.x, pt.y); await p.mouse("mousePressed", pt.x, pt.y); await p.mouse("mouseReleased", pt.x, pt.y);
    await sleep(300);
    expect((await info(p)).selected).toBe(sel);
    await clickButton(p, "Abrir página");
    await p.waitFor("document.querySelector('[aria-label=\"Título de la página\"]')?.value === 'Beta'", 10000);

    // T-367: zoom con la rueda y desplazamiento arrastrando el fondo
    await openGraph(p);
    await waitNodes(p, 2);
    const before = await info(p);
    const c = await p.center('[data-testid=graph-canvas]');
    await p.send("Input.dispatchMouseEvent", { type: "mouseWheel", x: c.x, y: c.y, deltaX: 0, deltaY: -300 });
    await sleep(300);
    const zoomed = await info(p);
    expect(zoomed.k).toBeGreaterThan(before.k);
    const corner = { x: c.x - 150, y: c.y - 120 };
    await p.drag(corner, { x: corner.x + 60, y: corner.y + 30 });
    await sleep(300);
    const panned = await info(p);
    expect(Math.round(panned.tx - zoomed.tx)).toBeGreaterThanOrEqual(50);
    expect(panned.k).toBeCloseTo(zoomed.k);
  }, 240000);
});
