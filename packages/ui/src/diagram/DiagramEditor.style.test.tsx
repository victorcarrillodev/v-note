// G-128, G-134, G-139, G-140, G-143 a G-145, G-153 a G-156 (prueba primero): estilo, valores predeterminados y portapapeles en el editor.
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { fireEvent, screen, within, cleanup } from "@testing-library/react";
import { renderWithI18n } from "../../tests/renderWithI18n";
import { DiagramEditor } from "./DiagramEditor";
import { DiagramDefaultsProvider, type DiagramDefaultsApi } from "./DiagramDefaults";
import { clearDiagramClipboard } from "./diagramClipboard";
import { DIAGRAM_SHORTCUTS } from "./shortcuts";
import { addNode, connect, emptyDiagram, parseDiagram, serializeDiagram, setNodeStyle, ACTIONS, normalizeCombo, type Diagram, type DiagramDefaults, type EdgeStyle, type NodeStyle, type Route } from "@vnote/core";

const must = <T,>(r: { ok: boolean; value?: T; error?: { message: string } }): T => { if (!r.ok) throw new Error(r.error?.message); return r.value as T; };
const base = (): Diagram => {
  let d = emptyDiagram();
  d = addNode(d, { shape: "process", x: 0, y: 0, id: "a", text: "A" }).diagram;
  d = addNode(d, { shape: "process", x: 400, y: 200, id: "b", text: "B" }).diagram;
  return d;
};
const withEdge = (): Diagram => must(connect(base(), { node: "a", anchor: "e" }, { node: "b", anchor: "w" }, { route: "straight" })).diagram;
async function mount(d: Diagram, defaults?: DiagramDefaultsApi) {
  const saved: string[] = [];
  const onChange = vi.fn((t: string) => { saved.push(t); });
  const ui = <DiagramEditor value={serializeDiagram(d)} onChange={onChange} />;
  const utils = await renderWithI18n(defaults ? <DiagramDefaultsProvider value={defaults}>{ui}</DiagramDefaultsProvider> : ui);
  return { ...utils, saved, onChange, last: (): Diagram => must(parseDiagram(saved[saved.length - 1]!)) };
}
const node = (id: string) => [...document.querySelectorAll(".react-flow__node")].find((n) => n.getAttribute("data-id") === id) as HTMLElement;
const pick = (id: string) => fireEvent.click(node(id));
const selectEdge = () => fireEvent.keyDown(document.querySelector("[data-connector]")!, { key: "Enter" });
const shapePanel = () => screen.getByRole("group", { name: "Estilo de la forma" });
const edgePanel = () => screen.getByRole("group", { name: "Estilo del conector" });

beforeEach(() => { clearDiagramClipboard(); try { localStorage.clear(); } catch { /* sin almacenamiento */ } });
afterEach(() => { vi.restoreAllMocks(); cleanup(); document.documentElement.removeAttribute("data-theme"); });

describe("estilo de la forma en el panel (G-128, G-134)", () => {
  it("cada control cambia su propiedad y se guarda de inmediato", async () => {
    const { last, onChange } = await mount(base());
    pick("a");
    const p = shapePanel();
    fireEvent.click(within(within(p).getByRole("group", { name: "Relleno" })).getByRole("button", { name: "Rojo" }));
    expect(last().nodes[0]!.style.fill).toBe("palette:red"); expect(onChange).toHaveBeenCalledTimes(1);
    fireEvent.change(within(p).getByLabelText("Relleno: hexadecimal"), { target: { value: "#ff8800" } });
    expect(last().nodes[0]!.style.fill).toBe("#ff8800");
    fireEvent.change(within(p).getByLabelText("Opacidad del relleno"), { target: { value: "40" } });
    expect(last().nodes[0]!.style.fillOpacity).toBe(0.4);
    fireEvent.click(within(within(p).getByRole("group", { name: "Contorno" })).getByRole("button", { name: "Verde" }));
    expect(last().nodes[0]!.style.stroke).toBe("palette:green");
    fireEvent.change(within(p).getByLabelText("Grosor del contorno"), { target: { value: "3" } });
    expect(last().nodes[0]!.style.strokeWidth).toBe(3);
    fireEvent.change(within(p).getByLabelText("Tipo de línea del contorno"), { target: { value: "dashed" } });
    expect(last().nodes[0]!.style.strokeDash).toBe("dashed");
    fireEvent.click(within(within(p).getByRole("group", { name: "Color del texto" })).getByRole("button", { name: "Azul" }));
    expect(last().nodes[0]!.style.textColor).toBe("palette:blue");
  });
  it("«Sin relleno» deja la forma sin color de fondo", async () => {
    const { last } = await mount(base());
    pick("a");
    fireEvent.click(within(within(shapePanel()).getByRole("group", { name: "Relleno" })).getByRole("button", { name: "Sin relleno" }));
    expect(last().nodes[0]!.style.fill).toBe("none");
  });
  it("un color aplicado es un paso de deshacer y Deshacer lo devuelve (G-134)", async () => {
    const { last } = await mount(base());
    pick("a");
    fireEvent.click(within(within(shapePanel()).getByRole("group", { name: "Relleno" })).getByRole("button", { name: "Rojo" }));
    expect(last().nodes[0]!.style.fill).toBe("palette:red");
    fireEvent.click(screen.getByRole("button", { name: "Deshacer" }));
    expect(last().nodes[0]!.style.fill).toBe("palette:blue");
    fireEvent.click(screen.getByRole("button", { name: "Rehacer" }));
    expect(last().nodes[0]!.style.fill).toBe("palette:red");
  });
  it("con la forma dibujada: el relleno personalizado se ve en el lienzo y los guardados de otra versión no lanzan", async () => {
    await mount(setNodeStyle(base(), ["a"], { fill: "#ff8800", fillOpacity: 0.5 }));
    const g = node("a").querySelector("[role=group]") as HTMLElement;
    expect(g.getAttribute("data-fill")).toBe("#ff8800"); expect(g.getAttribute("data-fill-opacity")).toBe("0.5");
  });
  it("con varias formas seleccionadas el cambio llega a todas en un solo paso (G-125)", async () => {
    const { last, onChange } = await mount(base());
    fireEvent.click(node("a"));
    fireEvent.keyDown(document, { key: "Control", code: "ControlLeft", ctrlKey: true });
    fireEvent.click(node("b"), { ctrlKey: true });
    fireEvent.keyUp(document, { key: "Control", code: "ControlLeft" });
    fireEvent.click(within(within(shapePanel()).getByRole("group", { name: "Relleno" })).getByRole("button", { name: "Verde" }));
    expect(last().nodes.map((n) => n.style.fill)).toEqual(["palette:green", "palette:green"]);
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});

describe("aviso de contraste no bloqueante (G-133, CL-7)", () => {
  it("con la tinta sobre el azul de paleta no hay aviso", async () => {
    await mount(base()); pick("a");
    expect(document.querySelector("[data-contrast-warning]")).toBeNull();
  });
  it("con un texto casi igual al relleno avisa, pero deja aplicarlo", async () => {
    const { last } = await mount(setNodeStyle(base(), ["a"], { fill: "#ffffff" }));
    pick("a");
    fireEvent.change(within(shapePanel()).getByLabelText("Color del texto: hexadecimal"), { target: { value: "#fefefe" } });
    expect(last().nodes[0]!.style.textColor).toBe("#fefefe");
    expect(document.querySelector("[data-contrast-warning]")).toHaveTextContent("El texto tiene poco contraste con el relleno (menos de 4,5:1).");
  });
  it("el aviso depende de la opacidad: texto oscuro sobre un relleno oscuro al 0 % se lee sobre el lienzo", async () => {
    await mount(setNodeStyle(base(), ["a"], { fill: "#000000", textColor: "#111111", fillOpacity: 1 }));
    pick("a");
    expect(document.querySelector("[data-contrast-warning]")).not.toBeNull();
    fireEvent.change(within(shapePanel()).getByLabelText("Opacidad del relleno"), { target: { value: "0" } });
    expect(document.querySelector("[data-contrast-warning]")).toBeNull();
  });
});

describe("colores recientes (G-131)", () => {
  it("un color personalizado aplicado aparece después entre los usados recientemente", async () => {
    await mount(base()); pick("a");
    fireEvent.change(within(shapePanel()).getByLabelText("Relleno: hexadecimal"), { target: { value: "#12ab34" } });
    expect(JSON.parse(localStorage.getItem("vnote.diagram.recentColors")!)).toEqual(["#12ab34"]);
  });
});

describe("estilo del conector (G-139, G-140)", () => {
  it("el panel cambia color, grosor, línea, puntas y color del texto, y el lienzo lo dibuja", async () => {
    const { last } = await mount(withEdge());
    selectEdge();
    const p = edgePanel();
    fireEvent.click(within(within(p).getByRole("group", { name: "Color de la línea" })).getByRole("button", { name: "Rojo" }));
    expect(last().edges[0]!.style.color).toBe("palette:red");
    fireEvent.change(within(p).getByLabelText("Grosor de la línea"), { target: { value: "thick" } });
    fireEvent.change(within(p).getByLabelText("Tipo de línea"), { target: { value: "dotted" } });
    fireEvent.change(within(p).getByLabelText("Punta de origen"), { target: { value: "circle" } });
    fireEvent.change(within(p).getByLabelText("Punta de destino"), { target: { value: "diamond" } });
    fireEvent.click(within(within(p).getByRole("group", { name: "Color del texto del conector" })).getByRole("button", { name: "Azul" }));
    expect(last().edges[0]!.style).toMatchObject({ color: "palette:red", width: "thick", dash: "dotted", startCap: "circle", endCap: "diamond", textColor: "palette:blue" });
    const path = document.querySelector("[data-connector-path]")!;
    expect(path.getAttribute("stroke")).toBe("var(--block-red-text)"); expect(path.getAttribute("stroke-width")).toBe("5"); // grueso 4 + 1 por estar seleccionado
    expect(path.getAttribute("stroke-dasharray")).toBe("4 10");
    expect([...document.querySelectorAll("[data-cap]")].map((c) => c.getAttribute("data-cap")).sort()).toEqual(["circle", "diamond"]);
  });
  it("sin puntas no se dibuja ninguna y la línea llega a los anclajes; con flecha se acorta", async () => {
    const d = withEdge();
    await mount({ ...d, edges: d.edges.map((e) => ({ ...e, style: { ...e.style, startCap: "none" as const, endCap: "none" as const } })) });
    expect(document.querySelectorAll("[data-cap]")).toHaveLength(0);
    expect(document.querySelector("[data-connector-path]")!.getAttribute("d")).toBe("M 140 30 L 400 230");
    cleanup();
    await mount(d);
    expect(document.querySelectorAll("[data-cap='arrow']")).toHaveLength(1);
    expect(document.querySelector("[data-connector-path]")!.getAttribute("d")).not.toBe("M 140 30 L 400 230");
  });
  it("la punta hereda el color de la línea", async () => {
    const d = withEdge();
    await mount({ ...d, edges: d.edges.map((e) => ({ ...e, style: { ...e.style, color: "#dc2626" } })) });
    expect(document.querySelector("[data-cap]")!.getAttribute("fill")).toBe("#dc2626");
  });
});

describe("valores predeterminados por espacio (G-143, G-144, G-145)", () => {
  const fake = (initial: DiagramDefaults = {}) => {
    let state: DiagramDefaults = initial;
    const api: DiagramDefaultsApi = {
      load: vi.fn(async () => state),
      saveShape: vi.fn(async (s: NodeStyle) => { state = { ...state, shape: s }; }),
      saveEdge: vi.fn(async (s: EdgeStyle, r: Route) => { state = { ...state, edge: { style: s, route: r } }; }),
      reset: vi.fn(async () => { state = {}; }),
    };
    return api;
  };
  const addShape = (name: string) => fireEvent.click(screen.getByRole("button", { name }));
  it("«Usar como predeterminado» guarda el estilo de la forma y las nuevas nacen con él; las existentes no cambian", async () => {
    const api = fake();
    const { last } = await mount(setNodeStyle(base(), ["a"], { fill: "palette:green", stroke: "#b45309" }), api);
    pick("a");
    fireEvent.click(within(shapePanel()).getByRole("button", { name: "Usar como predeterminado" }));
    await vi.waitFor(() => expect(document.querySelector("[data-diagram-notice]")).toHaveTextContent("predeterminado para las formas nuevas"));
    expect(api.saveShape).toHaveBeenCalledWith(expect.objectContaining({ fill: "palette:green", stroke: "#b45309" }));
    addShape("Proceso");
    expect(last().nodes).toHaveLength(3);
    expect(last().nodes[2]!.style).toMatchObject({ fill: "palette:green", stroke: "#b45309" });
    expect(last().nodes[1]!.style.fill).toBe("palette:blue"); // la que ya existía no cambia
  });
  it("los predeterminados guardados antes se aplican al abrir el editor", async () => {
    const api = fake({ shape: { fill: "palette:red", fillOpacity: 1, stroke: "palette:ink", strokeWidth: 2, strokeDash: "solid", textColor: "palette:ink" } });
    const { last } = await mount(base(), api);
    await vi.waitFor(() => expect(api.load).toHaveBeenCalled());
    await screen.findByRole("button", { name: "Proceso" });
    await new Promise((r) => setTimeout(r, 0));
    addShape("Proceso");
    expect(last().nodes[2]!.style.fill).toBe("palette:red");
  });
  it("el conector guarda su estilo y su trazado, y los nuevos nacen así", async () => {
    const api = fake();
    const d = withEdge();
    await mount({ ...d, edges: d.edges.map((e) => ({ ...e, route: "curved" as const, style: { ...e.style, color: "#dc2626", width: "thick" as const } })) }, api);
    selectEdge();
    fireEvent.click(within(edgePanel()).getByRole("button", { name: "Usar como predeterminado" }));
    await vi.waitFor(() => expect(api.saveEdge).toHaveBeenCalledWith(expect.objectContaining({ color: "#dc2626", width: "thick" }), "curved"));
  });
  it("«Restablecer predeterminados» vuelve a los del sistema", async () => {
    const api = fake({ shape: { fill: "palette:red", fillOpacity: 1, stroke: "palette:ink", strokeWidth: 2, strokeDash: "solid", textColor: "palette:ink" } });
    const { last } = await mount(base(), api);
    await new Promise((r) => setTimeout(r, 0));
    pick("a");
    fireEvent.click(within(shapePanel()).getByRole("button", { name: "Restablecer predeterminados" }));
    await vi.waitFor(() => expect(document.querySelector("[data-diagram-notice]")).toHaveTextContent("Se restablecieron"));
    expect(api.reset).toHaveBeenCalled();
    addShape("Proceso");
    expect(last().nodes[2]!.style.fill).toBe("palette:blue");
  });
  it("sin servicio de predeterminados los botones no se ofrecen", async () => {
    await mount(base()); pick("a");
    expect(within(shapePanel()).queryByRole("button", { name: "Usar como predeterminado" })).toBeNull();
  });
});

describe("copiar y pegar (G-148 a G-156)", () => {
  const nodes = (last: () => Diagram) => last().nodes;
  it("copiar y pegar forma una copia desplazada; el segundo pegado va más lejos; cada pegado es un paso de deshacer", async () => {
    const { last } = await mount(base());
    pick("a");
    fireEvent.click(screen.getByRole("button", { name: "Copiar" }));
    fireEvent.click(screen.getByRole("button", { name: "Pegar" }));
    expect(nodes(last)).toHaveLength(3);
    const first = nodes(last)[2]!; expect([first.x, first.y]).toEqual([24, 24]); expect(first.text).toBe("A");
    fireEvent.click(screen.getByRole("button", { name: "Pegar" }));
    const second = nodes(last)[3]!; expect([second.x, second.y]).toEqual([48, 48]);
    fireEvent.click(screen.getByRole("button", { name: "Deshacer" }));
    expect(nodes(last)).toHaveLength(3);
  });
  it("los atajos Ctrl+C y Ctrl+V hacen lo mismo y no tocan el portapapeles del sistema", async () => {
    const write = vi.fn(), read = vi.fn();
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: write, readText: read, write, read } });
    const { last } = await mount(base());
    pick("a");
    const host = document.querySelector("[data-testid=diagram]")!;
    fireEvent.keyDown(host, { key: "c", ctrlKey: true });
    fireEvent.keyDown(host, { key: "v", ctrlKey: true });
    expect(nodes(last)).toHaveLength(3);
    expect(write).not.toHaveBeenCalled(); expect(read).not.toHaveBeenCalled();
  });
  it("copiar una forma con su conector interno pega ambos; un conector con un solo extremo se pega con el otro extremo libre", async () => {
    const { last } = await mount(withEdge());
    pick("a");
    fireEvent.click(screen.getByRole("button", { name: "Copiar" }));
    fireEvent.click(screen.getByRole("button", { name: "Pegar" }));
    expect(last().edges).toHaveLength(2);
    const pasted = last().edges[1]!;
    expect("node" in pasted.from).toBe(true); expect("node" in pasted.to).toBe(false);
  });
  it("se puede pegar en otro diagrama, incluso tras cerrar el primero", async () => {
    await mount(base());
    pick("a");
    fireEvent.click(screen.getByRole("button", { name: "Copiar" }));
    cleanup();
    const { last } = await mount(addNode(emptyDiagram(), { shape: "note", x: 0, y: 0, id: "z" }).diagram);
    fireEvent.click(screen.getByRole("button", { name: "Pegar" }));
    expect(last().nodes).toHaveLength(2); expect(last().nodes[1]!.text).toBe("A");
  });
  it("pegar sin nada copiado avisa y no cambia el diagrama", async () => {
    const { onChange } = await mount(base());
    fireEvent.click(screen.getByRole("button", { name: "Pegar" }));
    expect(onChange).not.toHaveBeenCalled();
    expect(document.querySelector("[data-diagram-notice]")).toHaveTextContent("No hay nada que pegar");
  });
  it("copiar y pegar formato aplica el estilo sin cambiar el texto ni la posición", async () => {
    const { last } = await mount(setNodeStyle(base(), ["a"], { fill: "palette:red", strokeWidth: 4 }));
    pick("a");
    fireEvent.click(within(shapePanel()).getByRole("button", { name: "Copiar formato" }));
    pick("b");
    fireEvent.click(within(shapePanel()).getByRole("button", { name: "Pegar formato" }));
    expect(last().nodes[1]!.style).toMatchObject({ fill: "palette:red", strokeWidth: 4 });
    expect(last().nodes[1]).toMatchObject({ text: "B", x: 400, y: 200 });
  });
  it("el formato de una forma no se pega sobre un conector", async () => {
    const { onChange } = await mount(withEdge());
    pick("a");
    fireEvent.click(within(shapePanel()).getByRole("button", { name: "Copiar formato" }));
    selectEdge();
    fireEvent.click(within(edgePanel()).getByRole("button", { name: "Pegar formato" }));
    expect(onChange).not.toHaveBeenCalled();
    expect(document.querySelector("[data-diagram-notice]")).toHaveTextContent("No hay formato copiado de este tipo de elemento.");
  });
});

describe("atajos sin conflicto (G-155)", () => {
  it("ninguno de los atajos del diagrama coincide con uno de la aplicación", () => {
    const app = new Set(ACTIONS.map((a) => normalizeCombo(a.defaultCombo)));
    for (const [id, combo] of Object.entries(DIAGRAM_SHORTCUTS)) expect(app.has(normalizeCombo(combo)), id).toBe(false);
    expect(new Set(Object.values(DIAGRAM_SHORTCUTS).map(normalizeCombo)).size).toBe(Object.keys(DIAGRAM_SHORTCUTS).length);
  });
});
