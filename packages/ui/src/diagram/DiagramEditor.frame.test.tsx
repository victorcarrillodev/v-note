// R-053 a R-058, R-062, R-064, R-065 (prueba primero): el diagrama vive en el marco compartido, con menús emergentes y acomodo a la cuadrícula (spec 004).
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { fireEvent, screen, within, cleanup, waitFor } from "@testing-library/react";
import { renderWithI18n } from "../../tests/renderWithI18n";
import { DiagramEditor } from "./DiagramEditor";
import { clearDiagramClipboard } from "./diagramClipboard";
import { GRID_PREFS_KEY } from "../canvas/gridPrefs";
import { addNode, connect, emptyDiagram, parseDiagram, serializeDiagram, type Diagram } from "@vnote/core";

const must = <T,>(r: { ok: boolean; value?: T; error?: { message: string } }): T => { if (!r.ok) throw new Error(r.error?.message); return r.value as T; };
const base = (extra: Partial<Diagram> = {}): Diagram => {
  let d: Diagram = { ...emptyDiagram(), ...extra };
  d = addNode(d, { shape: "process", x: 0, y: 0, id: "a", text: "A" }).diagram;
  d = addNode(d, { shape: "process", x: 400, y: 200, id: "b", text: "B" }).diagram;
  return d;
};
const withEdge = (): Diagram => must(connect(base(), { node: "a", anchor: "e" }, { node: "b", anchor: "w" }, { route: "straight" })).diagram;
async function mount(d: Diagram) {
  const saved: string[] = [];
  const onChange = vi.fn((t: string) => { saved.push(t); });
  const utils = await renderWithI18n(<DiagramEditor value={serializeDiagram(d)} onChange={onChange} />);
  return { ...utils, saved, onChange, last: (): Diagram => must(parseDiagram(saved[saved.length - 1]!)) };
}
const node = (id: string) => [...document.querySelectorAll(".react-flow__node")].find((n) => n.getAttribute("data-id") === id) as HTMLElement;
const pick = (id: string) => fireEvent.click(node(id));
const selectEdge = () => fireEvent.keyDown(document.querySelector("[data-connector]")!, { key: "Enter" });
const frame = () => screen.getByTestId("diagram");

beforeEach(() => { clearDiagramClipboard(); try { localStorage.clear(); } catch { /* sin almacenamiento */ } });
afterEach(() => { vi.restoreAllMocks(); cleanup(); });

describe("dentro del marco compartido (R-053, R-054)", () => {
  it("es un grupo con nombre, con el ancho de la columna", async () => {
    await mount(base());
    expect(frame()).toHaveAttribute("role", "group");
    expect(frame()).toHaveAccessibleName("Lienzo del diagrama");
    expect(frame().style.width).toBe("100%");
    expect(frame().querySelector(".react-flow")).not.toBeNull();
  });
  it("un diagrama anterior (sin view) conserva 420 px y no se reescribe al abrirlo", async () => {
    const { onChange } = await mount(base());
    expect(frame().style.height).toBe("420px");
    expect(onChange).not.toHaveBeenCalled();
  });
  it("con view guardado usa ese alto", async () => {
    await mount(base({ view: { height: 600 } }));
    expect(frame().style.height).toBe("600px");
  });
  it("cambiar el alto con el teclado lo guarda en view, un paso por pulsación", async () => {
    const { onChange, last } = await mount(base());
    const sep = screen.getByRole("separator", { name: "Alto del lienzo" });
    fireEvent.keyDown(sep, { key: "ArrowDown" });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(last().view).toEqual({ height: 440 });
    expect(last().nodes).toHaveLength(2);
    expect(frame().style.height).toBe("440px");
  });
  it("el cambio de alto se puede deshacer", async () => {
    const { last } = await mount(base());
    fireEvent.keyDown(screen.getByRole("separator"), { key: "ArrowDown" });
    fireEvent.click(screen.getByRole("button", { name: "Deshacer" }));
    expect(last().view).toBeUndefined();
    expect(frame().style.height).toBe("420px");
  });
});

describe("sin franja inferior: menús emergentes (R-055 a R-058)", () => {
  it("seleccionar una forma no deja ningún panel suelto fuera del menú", async () => {
    await mount(base());
    pick("a");
    await screen.findByRole("dialog", { name: "Opciones de la forma" });
    const loose = [...document.querySelectorAll("[role=region]")].filter((r) => !r.closest("[role=dialog]"));
    expect(loose).toEqual([]);
    expect(frame().nextElementSibling).toBeNull();
  });
  it("R-056: el menú de la forma trae apariencia, estructura y acciones", async () => {
    await mount(base());
    pick("a");
    const menu = await screen.findByRole("dialog", { name: "Opciones de la forma" });
    expect(within(menu).getByRole("group", { name: "Estilo de la forma" })).toBeInTheDocument();
    expect(within(menu).getByRole("textbox", { name: "Texto" })).toBeInTheDocument();
    expect(within(menu).getByRole("button", { name: "Eliminar forma" })).toBeInTheDocument();
    expect(within(menu).getAllByRole("group").map((g) => g.getAttribute("aria-label"))).toEqual(expect.arrayContaining(["Apariencia", "Estructura", "Acciones"]));
  });
  it("R-056: editar el texto desde el menú guarda", async () => {
    const { last } = await mount(base());
    pick("a");
    const menu = await screen.findByRole("dialog", { name: "Opciones de la forma" });
    fireEvent.change(within(menu).getByRole("textbox", { name: "Texto" }), { target: { value: "Nuevo" } });
    expect(last().nodes[0]!.text).toBe("Nuevo");
  });
  it("R-057: el menú del conector trae trazado, estilo, extremos y eliminar", async () => {
    await mount(withEdge());
    selectEdge();
    const menu = await screen.findByRole("dialog", { name: "Opciones del conector" });
    expect(within(menu).getByRole("group", { name: "Estilo del conector" })).toBeInTheDocument();
    expect(within(menu).getByRole("button", { name: "Eliminar conector" })).toBeInTheDocument();
    expect(within(menu).getByRole("textbox", { name: "Texto del conector" })).toBeInTheDocument();
    expect(within(menu).getAllByRole("group").map((g) => g.getAttribute("aria-label"))).toEqual(expect.arrayContaining(["Apariencia", "Estructura", "Acciones"]));
  });
  it("sin selección no hay menú y la barra general es compacta y está arriba", async () => {
    await mount(base());
    expect(screen.queryByRole("dialog", { name: /Opciones/ })).toBeNull();
    const bar = within(frame()).getByRole("toolbar", { name: "Herramientas del lienzo" });
    expect(bar.querySelectorAll("[data-shape-button]")).toHaveLength(5);
    for (const n of ["Deshacer", "Rehacer", "Ampliar"]) expect(within(bar).getByRole("button", { name: n })).toBeInTheDocument();
    expect(within(frame()).getByRole("group", { name: "Zoom del diagrama" })).toBeInTheDocument();
    expect(frame().nextElementSibling).toBeNull();
  });
  it("Esc cierra el menú y deja la forma", async () => {
    await mount(base());
    pick("a");
    await screen.findByRole("dialog", { name: "Opciones de la forma" });
    fireEvent.keyDown(document.body, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Opciones de la forma" })).toBeNull());
    expect(node("a")).toBeInTheDocument();
  });
});

describe("acomodo a la cuadrícula en formas nuevas y pegadas (R-062, R-064, R-065)", () => {
  it("una forma insertada desde la barra queda en un punto de la cuadrícula", async () => {
    const { last } = await mount(base());
    fireEvent.click(screen.getByRole("button", { name: "Decisión" }));
    const n = last().nodes.at(-1)!;
    expect(Math.abs(n.x % 20)).toBe(0);
    expect(Math.abs(n.y % 20)).toBe(0);
  });
  it("con el acomodo apagado se conserva la posición exacta", async () => {
    localStorage.setItem(GRID_PREFS_KEY, JSON.stringify({ show: true, snap: false }));
    const { last } = await mount(base());
    fireEvent.click(screen.getByRole("button", { name: "Decisión" }));
    const n = last().nodes.at(-1)!;
    expect(n.x).toBe(-70);
    expect(Math.abs(n.x) % 20).not.toBe(0);
  });
  it("una forma pegada queda en la cuadrícula", async () => {
    const { last } = await mount(base());
    pick("a");
    fireEvent.click(screen.getByRole("button", { name: "Copiar" }));
    fireEvent.click(screen.getByRole("button", { name: "Pegar" }));
    const n = last().nodes.at(-1)!;
    expect(Math.abs(n.x % 20)).toBe(0);
    expect(Math.abs(n.y % 20)).toBe(0);
  });
  it("un diagrama anterior con posiciones fuera de la cuadrícula no se mueve ni se reescribe al abrirlo (CL-15)", async () => {
    let d = emptyDiagram();
    d = addNode(d, { shape: "process", x: 13, y: 7, id: "a", text: "A" }).diagram;
    const { onChange } = await mount(d);
    expect(onChange).not.toHaveBeenCalled();
    expect(node("a").style.transform).toMatch(/13px,\s*7px/);
  });
  it("la cuadrícula se puede ocultar con el interruptor compartido y se recuerda", async () => {
    await mount(base());
    expect(document.querySelector(".react-flow__background")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Mostrar cuadrícula" }));
    expect(document.querySelector(".react-flow__background")).toBeNull();
    expect(JSON.parse(localStorage.getItem(GRID_PREFS_KEY)!)).toEqual({ show: false, snap: true });
    cleanup();
    await mount(base());
    expect(document.querySelector(".react-flow__background")).toBeNull();
    expect(screen.getByRole("button", { name: "Mostrar cuadrícula" })).toHaveAttribute("aria-pressed", "false");
  });
});
