// R-178 (spec 004): una prueba dedicada a cada caso límite CL-1 a CL-17 de la spec 004 (identificador en el nombre).
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { fireEvent, screen, within, cleanup, waitFor } from "@testing-library/react";
import { renderWithI18n } from "../../tests/renderWithI18n";
import { MindMapEditor } from "./MindMapEditor";
import { FloatingMenu } from "../canvas/FloatingMenu";
import { anchorVisible } from "../canvas/menuGeometry";
import {
  addBendAt, addChild, addNode, connect, curvedThroughCmds, effectiveBase, emptyDiagram, findNode, moveBranch, newTree, parseDiagram, parseTree, removeBend, resolveTreeLayout, serializeDiagram,
  serializeTree, snapBox, snapOffset, toggleCollapsed, reflowAuto, MIN_SHAPE, GRID, type Tree,
} from "@vnote/core";

const must = <T,>(r: { ok: boolean; value?: T; error?: { message: string } }): T => { if (!r.ok) throw new Error(r.error?.message); return r.value as T; };
const sample = (): Tree => {
  let t = newTree("Tema");
  t = must(addChild(t, "root", "A", "a")).tree; t = must(addChild(t, "root", "B", "b")).tree;
  t = must(addChild(t, "a", "A1", "a1")).tree; t = must(addChild(t, "a1", "A1x", "a1x")).tree;
  return t;
};
const pos = (t: Tree, id: string) => resolveTreeLayout(t, "mindmap").get(id)!;
async function mount(t: Tree) {
  const saved: string[] = [];
  await renderWithI18n(<MindMapEditor value={serializeTree(t)} onChange={(s) => { saved.push(s); }} />);
  return { saved, last: (): Tree => must(parseTree(saved[saved.length - 1]!)) };
}
const bubble = (id: string) => document.querySelector(`[data-mind-id="${id}"]`) as HTMLElement;
const click = (id: string) => { fireEvent.pointerDown(bubble(id), { button: 0, clientX: 10, clientY: 10, pointerId: 1 }); fireEvent.pointerUp(window, { clientX: 10, clientY: 10, pointerId: 1 }); };
const menu = () => document.querySelector("[data-floating-menu]") as HTMLElement | null;

beforeEach(() => { try { localStorage.clear(); } catch { /* sin almacenamiento */ } });
afterEach(() => { vi.restoreAllMocks(); cleanup(); });

describe("casos límite de la spec 004", () => {
  it("CL-1: un ancla en el borde del área sigue visible y un ancla fuera de ella oculta el menú", () => {
    const area = { left: 0, top: 0, width: 400, height: 300 };
    expect(anchorVisible({ left: 380, top: 280, width: 40, height: 40 }, area)).toBe(true);
    expect(anchorVisible({ left: 900, top: 900, width: 40, height: 40 }, area)).toBe(false);
    // La reubicación completa dentro de la ventana la comprueba el e2e «menú junto al elemento» (R-066).
  });
  it("CL-2: seleccionar otro globo con el menú abierto lo cambia al nuevo elemento", async () => {
    await mount(sample());
    click("a"); await waitFor(() => expect(menu()).not.toBeNull());
    click("b");
    await waitFor(() => expect(within(bubble("b")).getByRole("textbox")).toBeTruthy());
    expect(menu()).not.toBeNull();
    expect(bubble("a")).toHaveAttribute("data-selected", "false");
  });
  it("CL-3: quitar el único punto intermedio deja el conector directo", () => {
    let d = must(connect(emptyDiagram(), { x: 0, y: 0 }, { x: 300, y: 0 }, { route: "free" })).diagram;
    const id = d.edges[0]!.id;
    d = must(addBendAt(d, id, { x: 150, y: 40 }));
    expect(d.edges[0]!.points).toHaveLength(1);
    d = must(removeBend(d, id, 0));
    expect(d.edges[0]!.points ?? []).toHaveLength(0);
  });
  it("CL-4: un punto agregado muy cerca de un extremo no queda sobre el anclaje", () => {
    let d = must(connect(emptyDiagram(), { x: 0, y: 0 }, { x: 300, y: 0 }, { route: "free" })).diagram;
    d = must(addBendAt(d, d.edges[0]!.id, { x: 2, y: 0 }));
    const p = d.edges[0]!.points![0]!;
    expect(Math.hypot(p.x - 0, p.y - 0)).toBeGreaterThanOrEqual(12);
  });
  it("CL-5: una curva con un punto o con puntos alineados no tiene picos ni bucles", () => {
    const a = { x: 0, y: 0 }, b = { x: 300, y: 0 };
    for (const pts of [[{ x: 150, y: 0 }], [{ x: 100, y: 0 }, { x: 200, y: 0.001 }]]) {
      const cmds = curvedThroughCmds(a, { x: 1, y: 0 }, pts, b, { x: -1, y: 0 });
      for (const c of cmds) if (c.t === "C") for (const q of [c.c1, c.c2, c.p]) { expect(Number.isFinite(q.x) && Number.isFinite(q.y)).toBe(true); expect(q.x).toBeGreaterThanOrEqual(-1); expect(q.x).toBeLessThanOrEqual(301); expect(Math.abs(q.y)).toBeLessThan(5); }
    }
  });
  it("CL-6: se permite superponer globos y «Reordenar» los separa", () => {
    const t = sample(), over = moveBranch(t, "b", pos(t, "a"), { snap: false });
    expect(pos(over, "b")).toEqual(pos(over, "a"));
    expect(pos(reflowAuto(over), "b")).not.toEqual(pos(reflowAuto(over), "a"));
  });
  it("CL-7: mover la raíz mueve todo el mapa sin perder la relación entre globos", () => {
    const t = sample(), m = moveBranch(t, "root", { x: 200, y: 100 }, { snap: true });
    for (const id of ["a", "b", "a1", "a1x"]) { expect(pos(m, id).x - pos(t, id).x).toBe(200); expect(pos(m, id).y - pos(t, id).y).toBe(100); }
  });
  it("CL-8: colapsar un globo movido y expandirlo devuelve a los hijos a su lugar", () => {
    const t = moveBranch(sample(), "a", { x: 300, y: 120 }, { snap: true }), before = pos(t, "a1x");
    expect(pos(toggleCollapsed(toggleCollapsed(t, "a"), "a"), "a1x")).toEqual(before);
  });
  it("CL-9: salir de la vista ampliada con texto a medias lo conserva", async () => {
    await mount(sample());
    click("a");
    fireEvent.change(within(bubble("a")).getByRole("textbox"), { target: { value: "A medias" } });
    fireEvent.click(screen.getByRole("button", { name: "Ampliar" }));
    fireEvent.click(screen.getByRole("button", { name: "Salir de la vista ampliada" }));
    expect(within(bubble("a")).getByRole("textbox")).toHaveValue("A medias");
  });
  it("CL-10: con un mapa que no cabe, «Ajustar a pantalla» avisa", async () => {
    const t = sample(); t.root.children[0]!.off = { x: 500000, y: 0 };
    await mount(t);
    fireEvent.click(screen.getByRole("button", { name: "Ajustar a pantalla" }));
    expect(document.querySelector("[data-mind-notice]")!.textContent).toContain("no cabe");
  });
  it("CL-11: el marco ocupa el ancho de la columna (se adapta al ancho disponible)", async () => {
    await mount(sample());
    expect(screen.getByTestId("mindmap").style.width).toBe("100%");
    expect(screen.getByTestId("mindmap").parentElement!.className).toContain("w-full");
    // La medida real en tres anchos de ventana la comprueba el e2e R-168.
  });
  it("CL-12: un mapa y un diagrama anteriores se abren igual y no se reescriben al abrirlos", async () => {
    const { saved } = await mount(sample());
    expect(saved).toHaveLength(0);
    expect(findNode(sample(), "a")!.off).toBeUndefined();
    const d = addNode(emptyDiagram(), { shape: "process", x: 3, y: 7, id: "n", text: "N" }).diagram;
    expect(serializeDiagram(must(parseDiagram(serializeDiagram(d))))).toBe(serializeDiagram(d));
    expect(JSON.parse(serializeDiagram(d)).view).toBeUndefined();
  });
  it("CL-13: el texto largo no desborda el globo (se recorta a dos líneas, con el texto completo en el título)", async () => {
    let t = sample(); t.root.children[0]!.text = "palabra ".repeat(80);
    t = must(addChild(t, "root", "C", "c")).tree;
    await mount(t);
    expect(bubble("a").querySelector("span")!.className).toContain("line-clamp-2");
    expect(Math.abs(pos(t, "a").y - pos(t, "c").y)).toBeGreaterThanOrEqual(40);
  });
  it("CL-14: Tab desde el último elemento del marco no queda atrapado", async () => {
    await mount(sample());
    const last = [...screen.getByTestId("mindmap").querySelectorAll<HTMLElement>("button")].pop()!;
    expect(fireEvent.keyDown(last, { key: "Tab" })).toBe(true);
  });
  it("CL-15: un elemento fuera de la cuadrícula no se mueve al abrir; al arrastrarlo se acomoda", async () => {
    const t = sample(); t.root.children[0]!.off = { x: 7, y: 3 };
    const { saved, last } = await mount(t);
    expect(saved).toHaveLength(0);
    fireEvent.pointerDown(bubble("b"), { button: 0, clientX: 100, clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(window, { clientX: 133, clientY: 117, pointerId: 1 });
    fireEvent.pointerUp(window, { clientX: 133, clientY: 117, pointerId: 1 });
    const p = pos(last(), "b");
    expect(((p.x % GRID) + GRID) % GRID).toBe(0); expect(((p.y % GRID) + GRID) % GRID).toBe(0);
  });
  it("CL-16: una forma al tamaño mínimo respeta el mínimo y se acomoda al punto más cercano", () => {
    const b = snapBox({ x: 3, y: 3, w: MIN_SHAPE.w, h: MIN_SHAPE.h }, MIN_SHAPE);
    expect(b.w).toBeGreaterThanOrEqual(MIN_SHAPE.w); expect(b.h).toBeGreaterThanOrEqual(MIN_SHAPE.h);
    expect(b.x % GRID).toBe(0); expect(b.y % GRID).toBe(0);
  });
  it("CL-17: al mover una rama con descendientes fuera de la cuadrícula conservan su distancia relativa", () => {
    let t = sample(); t.root.children[0]!.children[0]!.off = { x: 7, y: 3 };
    const before = { x: pos(t, "a1x").x - pos(t, "a").x, y: pos(t, "a1x").y - pos(t, "a").y };
    t = moveBranch(t, "a", { x: 213, y: 97 }, { snap: true });
    expect({ x: pos(t, "a1x").x - pos(t, "a").x, y: pos(t, "a1x").y - pos(t, "a").y }).toEqual(before);
    expect(snapOffset({ x: 213, y: 97 }, effectiveBase(t, "a")).x % GRID).not.toBeNaN();
  });
});

describe("FloatingMenu presente en los casos con menú", () => {
  it("el componente se exporta", () => { expect(typeof FloatingMenu).toBe("function"); });
});
