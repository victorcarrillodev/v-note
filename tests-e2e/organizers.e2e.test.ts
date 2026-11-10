// T-341…T-351 y T-355 (e2e real en Chrome): mapa mental, organigrama, línea de tiempo y matriz — insertar, editar, colapsar, reubicar y persistir.
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { Page } from "./cdp";
import { clickButton, ensureSpace, setValue, startWeb, type Web } from "./webHarness";

let web: Web;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
beforeAll(async () => { web = await startWeb(4181, 9340); }, 120000);
afterAll(() => web?.stop());
afterEach(async () => { await web?.closeAll(); });

async function open(p: Page, title: string, query: string, testid: string) {
  await ensureSpace(p);
  await clickButton(p, "Nueva página");
  await p.waitFor("document.querySelector('[aria-label=\"Título de la página\"]')?.value === ''");
  await p.click('[aria-label="Título de la página"]'); await p.typeText(title); await p.key("Enter", "Enter", 13);
  await p.waitFor("document.querySelector('.bn-editor[contenteditable=true]')");
  await p.eval("document.querySelector('.bn-editor').focus()"); await sleep(300);
  await p.send("Input.dispatchKeyEvent", { type: "keyDown", key: "/", text: "/" }); await p.send("Input.dispatchKeyEvent", { type: "keyUp", key: "/" });
  await sleep(400); await p.typeText(query); await sleep(500); await p.key("Enter", "Enter", 13);
  await p.waitFor(`document.querySelector('[data-testid=${testid}]')`, 10000);
}
/** Cierra y vuelve a abrir la aplicación y la página para comprobar lo persistido. */
async function reopen(p: Page, title: string, testid: string) {
  await sleep(1500);
  await p.reload();
  await p.waitFor("document.querySelector('aside nav')", 20000);
  await p.eval(`[...document.querySelectorAll('[role=treeitem]')].find(e => e.getAttribute('aria-label') === ${JSON.stringify(title)}).click()`);
  await p.waitFor(`document.querySelector('[data-testid=${testid}]')`, 15000);
}
const PANEL = '[role=region][aria-label="Propiedades de la idea"] input';
const nodeSel = (label: string) => `[data-testid=%T] [data-node-id][aria-label^="${label}"]`;
const treeNodes = (p: Page, tid: string) => p.eval<{ id: string; text: string; depth: number; x: number; y: number }[]>(
  `[...document.querySelectorAll('[data-testid=${tid}] [data-node-id]')].map(n => { const r = n.getBoundingClientRect(); return { id: n.dataset.nodeId, text: n.innerText.trim(), depth: Number(n.dataset.depth), x: r.x, y: r.y }; })`);
const selectNode = async (p: Page, tid: string, text: string) => {
  const sel = nodeSel(text).replace("%T", tid);
  await sleep(400); // deja asentarse la actualización del bloque antes de pulsar
  await p.click(sel);
  await p.waitFor(`document.querySelector(${JSON.stringify(sel)})?.getAttribute('aria-pressed') === 'true'`, 5000); // el clic se procesa de forma asíncrona
};
const setText = (p: Page, text: string) => setValue(p, PANEL, text);

async function treeFlow(p: Page, kind: "mindmap" | "orgchart", query: string, central: string) {
  await open(p, kind, query, kind);
  // T-341/T-344: parte de la idea central; se agregan rama e hijo
  let ns = await treeNodes(p, kind);
  expect(ns.map((n) => n.text)).toEqual([central]);
  await clickButton(p, "Agregar hijo"); await sleep(200);
  await setText(p, "Rama A");
  await selectNode(p, kind, central);; await clickButton(p, "Agregar hijo"); await sleep(200);
  await setText(p, "Rama B");
  await selectNode(p, kind, "Rama A"); await clickButton(p, "Agregar hijo"); await sleep(200);
  await setText(p, "Hijo A1");
  ns = await treeNodes(p, kind);
  expect(ns.map((n) => `${n.depth}:${n.text}`).sort()).toEqual([`0:${central}`, "1:Rama A", "1:Rama B", "2:Hijo A1"].sort());
  const at = (t: string) => ns.find((n) => n.text.startsWith(t))!;
  if (kind === "orgchart") { // niveles padre-hijo: cada nivel queda más abajo que el anterior
    expect(at("Rama A").y).toBeGreaterThan(at(central).y); expect(at("Hijo A1").y).toBeGreaterThan(at("Rama A").y);
  } else { // las ramas se reparten a ambos lados de la idea central
    expect(at("Rama A").x * at("Rama B").x < 0 || (at("Rama A").x !== at("Rama B").x)).toBe(true);
  }
  // sin solapamientos entre nodos visibles
  for (const a of ns) for (const b of ns) if (a.id < b.id) expect(Math.abs(a.x - b.x) >= 150 || Math.abs(a.y - b.y) >= 38).toBe(true);

  // T-342/T-345: colapsar y recordar el estado tras recargar
  await selectNode(p, kind, "Rama A"); await clickButton(p, "Colapsar"); await sleep(200);
  expect((await treeNodes(p, kind)).map((n) => n.text.replace(/\s*\+$/, ""))).not.toContain("Hijo A1");
  await reopen(p, kind, kind);
  expect((await treeNodes(p, kind)).map((n) => n.text.replace(/\s*\+$/, ""))).not.toContain("Hijo A1");
  await selectNode(p, kind, "Rama A"); await clickButton(p, "Expandir"); await sleep(200);
  expect((await treeNodes(p, kind)).map((n) => n.text)).toContain("Hijo A1");

  // T-343/T-345: arrastrar «Rama B» sobre «Rama A» la reubica como hija suya
  ns = await treeNodes(p, kind);
  const b = await p.center(nodeSel("Rama B").replace("%T", kind)), a = await p.center(nodeSel("Rama A").replace("%T", kind));
  await p.drag(b, a); await sleep(400);
  ns = await treeNodes(p, kind);
  expect(ns.find((n) => n.text === "Rama B")!.depth).toBe(2);
  // y lo reubicado también persiste
  await reopen(p, kind, kind);
  expect((await treeNodes(p, kind)).find((n) => n.text === "Rama B")!.depth).toBe(2);
}

describe("organizadores gráficos en la aplicación real", () => {
  // El mapa mental (spec 004) se prueba en mindmap.e2e.test.ts; aquí queda el organigrama, que sigue con el editor anterior.
  it("T-344, T-345: organigrama — niveles, colapsar y reubicar", async () => { await treeFlow(await web.open(), "orgchart", "organigrama", "Cargo principal"); }, 180000);

  it("T-346, T-349: línea de tiempo — eventos en orden y arrastre cambia la fecha", async () => {
    const p = await web.open();
    await open(p, "timeline", "timeline", "timeline");
    const addEv = async (date: string, title: string) => {
      await setValue(p, '[data-testid=timeline] input[type=date]', date);
      await setValue(p, '[data-testid=timeline] input:not([type=date])', title);
      await clickButton(p, "Agregar evento"); await sleep(250);
    };
    await addEv("2026-03-10", "Segundo"); await addEv("2026-03-01", "Primero"); await addEv("2026-03-10", "Empate");
    const evs = () => p.eval<{ title: string; date: string; lane: number; x: number; y: number; w: number; h: number }[]>(
      `[...document.querySelectorAll('[data-testid=timeline] [data-event-id]')].map(n => { const r = n.getBoundingClientRect(); return { title: n.innerText.split(' · ')[0], date: n.dataset.date, lane: Number(n.dataset.lane), x: r.x, y: r.y, w: r.width, h: r.height }; })`);
    let es = await evs();
    expect(es.map((e) => e.title)).toEqual(["Primero", "Segundo", "Empate"]); // cronológico, empate estable
    const segundo = es[1]!, empate = es[2]!;
    expect(segundo.lane).not.toBe(empate.lane); // CL-10: no se solapan
    // arrastrar «Primero» 60 px a la derecha (10 días con 6 px/día) cambia su fecha
    const c = await p.center('[data-testid=timeline] [data-event-id][data-date="2026-03-01"]');
    await p.drag(c, { x: c.x + 60, y: c.y }); await sleep(400);
    es = await evs();
    expect(es.find((e) => e.title === "Primero")!.date).toBe("2026-03-11");
    await reopen(p, "timeline", "timeline");
    expect((await evs()).find((e) => e.title === "Primero")!.date).toBe("2026-03-11");
  }, 180000);

  it("T-350, T-351: matriz — plantilla 2×2, editar celdas y arrastrar elementos", async () => {
    const p = await web.open();
    await open(p, "matrix", "matriz", "matrix");
    const titles = () => p.eval<string[]>("[...document.querySelectorAll('[data-testid=matrix] th input')].map(i => i.value)");
    expect(await titles()).toEqual(["Urgente", "No urgente", "Importante", "No importante"]);
    const cells = () => p.eval<Record<string, string[]>>(`Object.fromEntries([...document.querySelectorAll('[data-testid=matrix] td[data-cell]')].map(td => [td.dataset.row + '|' + td.dataset.col, [...td.querySelectorAll('[data-item-id] input')].map(i => i.value)]))`);
    const first = '[data-testid=matrix] tbody tr:nth-of-type(1) td[data-cell]:nth-of-type(1)';
    await setValue(p, `${first} > input`, "Entregar informe");
    await p.eval(`document.querySelector('${first} > input').focus()`); await p.key("Enter", "Enter", 13); await sleep(300);
    expect(Object.values(await cells()).flat()).toEqual(["Entregar informe"]);
    // editar el elemento
    await setValue(p, `${first} [data-item-id] input`, "Entregar informe hoy");
    // arrastrar el elemento a la celda de otra fila y columna
    const handle = await p.center(`${first} [data-item-id] button`);
    const target = await p.center('[data-testid=matrix] tbody tr:nth-of-type(2) td[data-cell]:nth-of-type(2)');
    await p.drag(handle, target); await sleep(400);
    const cs = await cells();
    expect(Object.values(cs).flat()).toEqual(["Entregar informe hoy"]);
    const where = Object.entries(cs).find(([, v]) => v.length)![0];
    expect(where).not.toBe(Object.keys(cs)[0]);
    await reopen(p, "matrix", "matrix");
    expect(Object.values(await cells()).flat()).toEqual(["Entregar informe hoy"]);
    expect(await titles()).toEqual(["Urgente", "No urgente", "Importante", "No importante"]);
  }, 180000);
});
