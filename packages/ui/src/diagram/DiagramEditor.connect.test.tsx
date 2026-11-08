// G-051 a G-065, G-067, G-074 a G-076 (prueba primero): conexión por anclajes en el editor de diagramas (jsdom, zoom 1: pantalla = lienzo).
import { describe, it, expect, vi, afterEach } from "vitest";
import { fireEvent, screen, within, act } from "@testing-library/react";
import { renderWithI18n } from "../../tests/renderWithI18n";
import { DiagramEditor } from "./DiagramEditor";
import { addNode, connect, emptyDiagram, parseDiagram, serializeDiagram, connectorPath, pathToSvg, styledPath, isAttached, type Diagram, type Endpoint } from "@vnote/core";

const must = <T,>(r: { ok: boolean; value?: T; error?: { message: string } }): T => { if (!r.ok) throw new Error(r.error?.message); return r.value as T; };
const base = (): Diagram => {
  let d = emptyDiagram();
  d = addNode(d, { shape: "process", x: 0, y: 0, id: "a", text: "A" }).diagram;       // anclaje este (140, 30)
  d = addNode(d, { shape: "process", x: 400, y: 200, id: "b", text: "B" }).diagram;   // oeste (400, 230), norte (470, 200)
  return d;
};
const withEdge = (): Diagram => must(connect(base(), { node: "a", anchor: "e" }, { node: "b", anchor: "w" }, { route: "straight" })).diagram;

async function mount(d: Diagram) {
  const saved: string[] = [];
  const onChange = vi.fn((text: string) => { saved.push(text); });
  const utils = await renderWithI18n(<DiagramEditor value={serializeDiagram(d)} onChange={onChange} />);
  const last = (): Diagram => must(parseDiagram(saved[saved.length - 1]!));
  return { ...utils, saved, onChange, last };
}
const node = (id: string) => [...document.querySelectorAll(".react-flow__node")].find((n) => n.getAttribute("data-id") === id) as HTMLElement;
const groups = () => [...document.querySelectorAll<SVGGElement>("[data-anchor-group]")];
const hit = (nodeId: string, anchor: string) => document.querySelector<SVGElement>(`[data-anchor-group][data-node="${nodeId}"][data-anchor="${anchor}"] [data-anchor-hit]`)!;
const down = (el: Element, x: number, y: number) => fireEvent.pointerDown(el, { clientX: x, clientY: y, button: 0, pointerId: 1, pointerType: "mouse" });
const move = (x: number, y: number) => fireEvent.pointerMove(window, { clientX: x, clientY: y, pointerId: 1, pointerType: "mouse" });
const up = (x: number, y: number) => fireEvent.pointerUp(window, { clientX: x, clientY: y, pointerId: 1, pointerType: "mouse" });
const hover = (id: string) => fireEvent.mouseEnter(node(id));

afterEach(() => { vi.restoreAllMocks(); });

describe("la librería ya no pone sus puntos de unión, conectores ni controles (G-051, G-067)", () => {
  it("las formas se dibujan sin Handle, y los controles de zoom son los propios", async () => {
    await mount(base());
    expect(document.querySelectorAll(".react-flow__node")).toHaveLength(2);
    expect(document.querySelectorAll(".react-flow__handle")).toHaveLength(0);
    expect(document.querySelectorAll(".react-flow__controls")).toHaveLength(0);
    expect(document.querySelector("[data-canvas-controls]")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Acercar" })).toBeInTheDocument();
  });
});

describe("anclajes visibles (G-052, G-053)", () => {
  it("sin hover ni selección no hay anclajes; al pasar el puntero por una forma aparecen sus 8 en las posiciones del núcleo", async () => {
    await mount(base());
    expect(groups()).toHaveLength(0);
    hover("a");
    expect(groups()).toHaveLength(8);
    const e = groups().find((g) => g.dataset.anchor === "e")!;
    expect([Number(e.dataset.x), Number(e.dataset.y)]).toEqual([140, 30]);
    expect(groups().every((g) => g.dataset.node === "a")).toBe(true);
  });
  it("mientras se arrastra un extremo cerca de otra forma se muestran sus anclajes y se resalta el más cercano", async () => {
    await mount(base());
    hover("a");
    down(hit("a", "e"), 140, 30);
    move(405, 232);
    const active = groups().filter((g) => g.dataset.active === "true");
    expect(active).toHaveLength(1);
    expect([active[0]!.dataset.node, active[0]!.dataset.anchor]).toEqual(["b", "w"]);
    up(405, 232);
  });
});

describe("selección (G-057, G-052)", () => {
  it("al seleccionar una forma aparece su contorno de selección con el acento y sus 8 anclajes, sin necesidad de pasar el puntero", async () => {
    await mount(base());
    expect(document.querySelectorAll("[data-selection-ring]")).toHaveLength(0);
    fireEvent.click(node("a"));
    const ring = document.querySelector("[data-selection-ring='a']")!;
    expect(ring.getAttribute("stroke")).toBe("var(--c-accent)");
    expect(groups().filter((g) => g.dataset.node === "a")).toHaveLength(8);
    expect(document.querySelector("[data-selection-ring='b']")).toBeNull();
  });
  it("también se rodean las formas no rectangulares con su propio contorno", async () => {
    let d = emptyDiagram();
    d = addNode(d, { shape: "decision", x: 0, y: 0, id: "r", text: "¿?" }).diagram;
    await mount(d);
    fireEvent.click(node("r"));
    expect(document.querySelector("[data-selection-ring='r']")!.getAttribute("d")!.split("L")).toHaveLength(4); // rombo = 4 vértices
  });
});

describe("crear un conector arrastrando desde un anclaje (G-060, G-061, G-062, G-064)", () => {
  it("soltar a 10 px de un anclaje lo une a él, y todo el gesto es un solo cambio guardado", async () => {
    const { onChange, last } = await mount(base());
    hover("a");
    down(hit("a", "e"), 140, 30);
    for (let i = 1; i <= 20; i++) move(140 + i * 13, 30 + i * 10);   // 20 movimientos
    move(410, 230);
    expect(onChange).not.toHaveBeenCalled();                         // vista previa: nada guardado todavía
    up(410, 230);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(last().edges).toHaveLength(1);
    expect(last().edges[0]).toMatchObject({ from: { node: "a", anchor: "e" }, to: { node: "b", anchor: "w" } });
  });
  it("soltar a 30 px de cualquier anclaje deja el extremo libre en el punto soltado", async () => {
    const { last } = await mount(base());
    hover("a");
    down(hit("a", "e"), 140, 30);
    move(430, 230); up(430, 230);
    const e = last().edges[0]!;
    expect(e.from).toEqual({ node: "a", anchor: "e" });
    expect(isAttached(e.to)).toBe(false); expect(e.to).toEqual({ x: 430, y: 230 });
  });
  it("soltar en el vacío también deja el extremo libre", async () => {
    const { last } = await mount(base());
    hover("a");
    down(hit("a", "s"), 70, 60);
    move(70, 400); up(70, 400);
    expect(last().edges[0]!.to).toEqual({ x: 70, y: 400 });
  });
  it("Escape cancela el gesto sin guardar nada", async () => {
    const { onChange } = await mount(base());
    hover("a");
    down(hit("a", "e"), 140, 30);
    move(300, 100);
    fireEvent.keyDown(document.querySelector("[data-testid=diagram]")!, { key: "Escape" });
    up(300, 100);
    expect(onChange).not.toHaveBeenCalled();
  });
  it("unir los dos extremos al mismo anclaje se rechaza con un aviso, sin crear nada", async () => {
    const { onChange } = await mount(base());
    hover("a");
    down(hit("a", "e"), 140, 30);
    move(141, 31); up(141, 31); // vuelve al mismo anclaje de origen
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("conectores dibujados (G-058, G-059, G-074)", () => {
  it("se dibuja el camino del núcleo", async () => {
    const d = withEdge();
    await mount(d);
    const p = document.querySelector<SVGPathElement>("[data-connector-path]")!;
    const cp = connectorPath(d, d.edges[0]!)!;
    expect(p.getAttribute("d")).toBe(pathToSvg({ ...cp, cmds: styledPath(cp, d.edges[0]!.style).cmds })); // la línea se acorta bajo la punta
  });
  it("cada conector tiene un nombre accesible con forma y punto de unión de cada extremo, y los libres se leen como «extremo libre»", async () => {
    let d = withEdge();
    d = must(connect(d, { node: "a", anchor: "s" }, { x: 5, y: 500 })).diagram;
    await mount(d);
    const names = [...document.querySelectorAll("[data-connector]")].map((g) => g.getAttribute("aria-label"));
    expect(names).toContain("Conector de A (derecha) a B (izquierda)");
    expect(names).toContain("Conector de A (abajo) a extremo libre");
  });
  it("el conector es alcanzable con el teclado y Enter lo selecciona, mostrando las asas de sus dos extremos", async () => {
    await mount(withEdge());
    const g = document.querySelector<SVGGElement>("[data-connector]")!;
    expect(g.getAttribute("tabindex")).toBe("0");
    expect(document.querySelectorAll("[data-end-handle]")).toHaveLength(0);
    fireEvent.keyDown(g, { key: "Enter" });
    const handles = [...document.querySelectorAll<SVGGElement>("[data-end-handle]")];
    expect(handles.map((h) => h.dataset.endHandle).sort()).toEqual(["from", "to"]);
    for (const h of handles) expect(Number(h.querySelector("[data-end-hit]")!.getAttribute("r")) * 2).toBeGreaterThanOrEqual(32); // área activa ≥ 32 px a zoom 1
  });
  it("también se selecciona con un clic en su trazo", async () => {
    await mount(withEdge());
    fireEvent.click(document.querySelector("[data-connector-hit]")!);
    expect(document.querySelectorAll("[data-end-handle]")).toHaveLength(2);
  });
});

describe("arrastrar un extremo ya unido (G-063)", () => {
  const select = () => fireEvent.keyDown(document.querySelector("[data-connector]")!, { key: "Enter" });
  const endHit = (end: string) => document.querySelector(`[data-end-handle="${end}"] [data-end-hit]`)!;
  it("hacia otro anclaje lo reubica y el otro extremo no cambia", async () => {
    const { last, onChange } = await mount(withEdge());
    select();
    down(endHit("to"), 400, 230);
    move(468, 203); up(468, 203);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(last().edges[0]).toMatchObject({ from: { node: "a", anchor: "e" }, to: { node: "b", anchor: "n" } });
  });
  it("hacia el vacío lo despega y queda libre en ese punto", async () => {
    const { last } = await mount(withEdge());
    select();
    down(endHit("to"), 400, 230);
    move(700, 500); up(700, 500);
    expect(last().edges[0]!.to).toEqual({ x: 700, y: 500 });
    expect(last().edges[0]!.from).toEqual({ node: "a", anchor: "e" });
  });
  it("un extremo libre puede volver a unirse a un anclaje", async () => {
    const free = must(connect(base(), { node: "a", anchor: "e" }, { x: 700, y: 500 }, { route: "straight" })).diagram;
    const { last } = await mount(free);
    select();
    down(endHit("to"), 700, 500);
    move(402, 231); up(402, 231);
    expect(last().edges[0]!.to).toEqual({ node: "b", anchor: "w" });
  });
});

describe("borrar una forma deja sus conectores con extremo libre (G-065, RF-4, CL-14)", () => {
  it("avisa cuántos quedaron libres y Deshacer restituye forma y uniones", async () => {
    const { last } = await mount(withEdge());
    fireEvent.click(node("a"));
    fireEvent.click(await screen.findByRole("button", { name: "Eliminar forma" }));
    expect(document.querySelector("[data-diagram-notice]")).toHaveTextContent("Se eliminó «A». 1 conector(es) quedaron con extremo libre.");
    expect(last().nodes.map((n) => n.id)).toEqual(["b"]);
    expect(last().edges).toHaveLength(1);
    expect(last().edges[0]!.from).toEqual({ x: 140, y: 30 });
    expect(isAttached(last().edges[0]!.to)).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Deshacer" }));
    expect(last().nodes.map((n) => n.id).sort()).toEqual(["a", "b"]);
    expect(last().edges[0]!.from).toEqual({ node: "a", anchor: "e" });
  });
});

describe("puntero grueso (G-055, G-076)", () => {
  it("con puntero grueso el área activa es de 44 px y el imán de 24 px", async () => {
    vi.stubGlobal("matchMedia", (q: string) => ({ matches: q.includes("coarse"), media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false }));
    const { last } = await mount(base());
    hover("a");
    expect(Number(hit("a", "e").getAttribute("r")) * 2).toBe(44);
    down(hit("a", "e"), 140, 30);
    move(422, 230); up(422, 230); // a 22 px del anclaje oeste de B: dentro de 24, fuera de 16
    expect(last().edges[0]!.to).toEqual({ node: "b", anchor: "w" });
    vi.unstubAllGlobals();
  });
  it("con puntero fino el área activa es de 32 px", async () => {
    await mount(base());
    hover("a");
    expect(Number(hit("a", "e").getAttribute("r")) * 2).toBe(32);
  });
});

describe("orden de capas (G-071)", () => {
  it("los trazos van debajo de las formas; anclajes, asas y controles de zoom, encima de todo", async () => {
    await mount(withEdge());
    hover("a");
    fireEvent.keyDown(document.querySelector("[data-connector]")!, { key: "Enter" });
    const z = (el: Element) => Number(getComputedStyle(el.closest("svg")!).zIndex);
    expect(z(document.querySelector("[data-connector]")!)).toBeLessThan(0);
    expect(z(document.querySelector("[data-anchor-group]")!)).toBeGreaterThan(1000); // la librería eleva una forma seleccionada a 1000
    expect(z(document.querySelector("[data-end-handle]")!)).toBeGreaterThan(1000);
    expect(screen.getByRole("group", { name: "Zoom del diagrama" }).className).toContain("z-[var(--z-sticky)]");
  });
});

describe("sin animaciones propias (G-075)", () => {
  it("la capa de conectores y anclajes no usa transiciones ni animaciones", async () => {
    await mount(withEdge());
    hover("a");
    const all = document.querySelectorAll("[data-connector] *, [data-anchor-group] *, [data-end-handle] *");
    for (const el of all) { const s = (el as SVGElement).getAttribute("style") ?? ""; expect(s).not.toMatch(/transition|animation/); }
    expect(all.length).toBeGreaterThan(0);
  });
});

describe("tipos usados en las pruebas", () => {
  it("Endpoint existe", () => { const e: Endpoint = { x: 0, y: 0 }; expect(e).toBeTruthy(); expect(within).toBeDefined(); expect(act).toBeDefined(); });
});
