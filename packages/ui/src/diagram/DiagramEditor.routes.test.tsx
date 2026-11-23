// G-107 a G-116 (prueba primero): trazados en el editor: selector, tramos arrastrables, curvatura, puntos de control y avisos.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, screen, within } from "@testing-library/react";
import { renderWithI18n } from "../../tests/renderWithI18n";
import { DiagramEditor } from "./DiagramEditor";
import { GRID_PREFS_KEY } from "../canvas/gridPrefs";
import { addNode, connect, curveHandle, connectorPath, styledPath, emptyDiagram, parseDiagram, pathToSvg, serializeDiagram, type DEdge, type Diagram, type Route } from "@vnote/core";
import { choose, dropdownOptions } from "../../tests/dropdown";
import userEvent from "@testing-library/user-event";

// Estas pruebas comprueban gestos con coordenadas exactas: el acomodo a la cuadrícula (spec 004) se prueba aparte, en DiagramEditor.frame.test.tsx.
beforeEach(() => { try { localStorage.setItem(GRID_PREFS_KEY, JSON.stringify({ show: true, snap: false })); } catch { /* sin almacenamiento */ } });


const must = <T,>(r: { ok: boolean; value?: T; error?: { message: string } }): T => { if (!r.ok) throw new Error(r.error?.message); return r.value as T; };
const two = (): Diagram => {
  let d = emptyDiagram();
  d = addNode(d, { shape: "process", x: 0, y: 0, id: "a", text: "A" }).diagram;
  d = addNode(d, { shape: "process", x: 400, y: 200, id: "b", text: "B" }).diagram;
  return d;
};
const withRoute = (route: Route, patch: Partial<DEdge> = {}): Diagram => {
  const r = must(connect(two(), { node: "a", anchor: "e" }, { node: "b", anchor: "w" }, { route }));
  return { ...r.diagram, edges: r.diagram.edges.map((e) => ({ ...e, ...patch })) };
};
async function mount(d: Diagram) {
  const saved: string[] = [];
  const onChange = vi.fn((t: string) => { saved.push(t); });
  await renderWithI18n(<DiagramEditor value={serializeDiagram(d)} onChange={onChange} />);
  return { saved, onChange, last: (): Diagram => must(parseDiagram(saved[saved.length - 1]!)) };
}
const select = () => fireEvent.keyDown(document.querySelector("[data-connector]")!, { key: "Enter" });
const down = (el: Element, x: number, y: number) => fireEvent.pointerDown(el, { clientX: x, clientY: y, button: 0, pointerId: 1, pointerType: "mouse" });
const move = (x: number, y: number) => fireEvent.pointerMove(window, { clientX: x, clientY: y, pointerId: 1, pointerType: "mouse" });
const up = (x: number, y: number) => fireEvent.pointerUp(window, { clientX: x, clientY: y, pointerId: 1, pointerType: "mouse" });

describe("los cuatro trazados se dibujan con el camino del núcleo (G-107)", () => {
  for (const route of ["straight", "orthogonal", "curved", "free"] as const) {
    it(route, async () => {
      const d = withRoute(route, route === "free" ? { points: [{ x: 200, y: 100 }] } : {});
      await mount(d);
      const cp = connectorPath(d, d.edges[0]!)!;
      expect(document.querySelector("[data-connector-path]")!.getAttribute("d")).toBe(pathToSvg({ ...cp, cmds: styledPath(cp, d.edges[0]!.style).cmds }));
    });
  }
});

describe("selector de trazado (G-108, G-116, CL-9)", () => {
  it("lista los cuatro trazados y cambiar conserva las uniones", async () => {
    const { last } = await mount(withRoute("orthogonal"));
    select();
    const sel = screen.getByLabelText("Trazado");
    expect((await dropdownOptions(sel)).map((o) => o.label)).toEqual(["Recto", "Ángulos de 90°", "Redondeado", "Libre"]);
    expect(sel).toHaveAttribute("data-value", "orthogonal");
    await choose(userEvent, sel, "curved");
    expect(last().edges[0]).toMatchObject({ route: "curved", from: { node: "a", anchor: "e" }, to: { node: "b", anchor: "w" } });
  });
  it("si había ajustes del trazado anterior avisa que se descartaron y Deshacer los devuelve", async () => {
    const { last } = await mount(withRoute("orthogonal", { waypoints: [{ x: 300, y: 130 }] }));
    select();
    await choose(userEvent, screen.getByLabelText("Trazado"), "straight");
    expect(document.querySelector("[data-diagram-notice]")).toHaveTextContent("Se descartaron los ajustes del trazado anterior.");
    expect(last().edges[0]!.waypoints).toBeUndefined();
    fireEvent.click(screen.getByRole("button", { name: "Deshacer" }));
    expect(last().edges[0]).toMatchObject({ route: "orthogonal", waypoints: [{ x: 300, y: 130 }] });
  });
  it("sin ajustes que perder no hay aviso", async () => {
    await mount(withRoute("orthogonal"));
    select();
    fireEvent.change(screen.getByLabelText("Trazado"), { target: { value: "free" } });
    expect(document.querySelector("[data-diagram-notice]")).toBeNull();
  });
});

describe("arrastrar un tramo del trazado de 90° (G-109, G-110)", () => {
  it("el tramo vertical de la «Z» se mueve y queda como punto de paso, en un solo cambio guardado", async () => {
    const { last, onChange } = await mount(withRoute("orthogonal"));
    select();
    const seg = document.querySelector("[data-segment-handle='1'] [data-segment-hit]")!; // tramo vertical x = 270, y de 30 a 230
    down(seg, 270, 130);
    for (let i = 1; i <= 10; i++) move(270 + i * 6, 130);
    expect(onChange).not.toHaveBeenCalled();
    up(330, 130);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(last().edges[0]!.waypoints).toEqual([{ x: 330, y: 130 }]);
    const v = connectorPath(last(), last().edges[0]!)!.vertices!;
    expect(v.slice(1).every((p, i) => p.x === v[i]!.x || p.y === v[i]!.y)).toBe(true);
    expect(v.some((p) => p.x === 330)).toBe(true);
  });
  it("«Restablecer ruta» vacía los puntos de paso y solo aparece si hay alguno", async () => {
    const { last } = await mount(withRoute("orthogonal", { waypoints: [{ x: 330, y: 130 }] }));
    select();
    fireEvent.click(screen.getByRole("button", { name: "Restablecer ruta" }));
    expect(last().edges[0]!.waypoints).toEqual([]);
    expect(screen.queryByRole("button", { name: "Restablecer ruta" })).toBeNull();
  });
});

describe("asa de curvatura del trazado redondeado (G-111)", () => {
  it("el asa está en el primer punto de control y arrastrarla cambia la curvatura", async () => {
    const d = withRoute("curved");
    const { last, onChange } = await mount(d);
    select();
    const p = connectorPath(d, d.edges[0]!)!;
    const h = curveHandle(p.start, p.startDir, p.end, p.endDir);
    const el = document.querySelector("[data-curve-handle] [data-curve-hit]")!;
    expect(Number(el.getAttribute("cx"))).toBeCloseTo(h.x, 6);
    down(el, h.x, h.y);
    const len = Math.hypot(p.end.x - p.start.x, p.end.y - p.start.y);
    move(p.start.x + len * 0.8, p.start.y); up(p.start.x + len * 0.8, p.start.y);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(last().edges[0]!.curvature).toBeCloseTo(0.8, 2);
  });
  it("también se ajusta con un control deslizante accesible", async () => {
    const { last } = await mount(withRoute("curved"));
    select();
    fireEvent.change(screen.getByLabelText("Curvatura"), { target: { value: "0.9" } });
    expect(last().edges[0]!.curvature).toBe(0.9);
  });
});

describe("puntos de control del trazado libre (G-112, G-113, G-114)", () => {
  const free = () => withRoute("free", { points: [{ x: 200, y: 100 }] });
  it("arrastrar un punto de control lo mueve", async () => {
    const { last } = await mount(free());
    select();
    down(document.querySelector("[data-control-point='0'] [data-control-hit]")!, 200, 100);
    move(220, 90); up(220, 90);
    expect(last().edges[0]!.points).toEqual([{ x: 220, y: 90 }]);
  });
  it("doble clic sobre el trazado añade un punto en el tramo más cercano", async () => {
    const { last } = await mount(free());
    select();
    fireEvent.doubleClick(document.querySelector("[data-connector-hit]")!, { clientX: 300, clientY: 165 });
    expect(last().edges[0]!.points).toHaveLength(2);
    expect(last().edges[0]!.points![1]).toEqual({ x: 300, y: 165 });
  });
  it("Supr elimina el punto de control seleccionado", async () => {
    const { last } = await mount(free());
    select();
    const hit = document.querySelector("[data-control-point='0'] [data-control-hit]")!;
    down(hit, 200, 100); up(200, 100);
    fireEvent.keyDown(document.querySelector("[data-testid=diagram]")!, { key: "Delete" });
    expect(last().edges[0]!.points ?? []).toEqual([]);   // sin puntos no se deja una lista vacía (spec 004)
  });
  it("el interruptor «Suavizado» conserva los puntos", async () => {
    const { last } = await mount(free());
    select();
    fireEvent.click(screen.getByRole("checkbox", { name: "Suavizado" }));
    expect(last().edges[0]).toMatchObject({ smooth: true, points: [{ x: 200, y: 100 }] });
    fireEvent.click(screen.getByRole("checkbox", { name: "Suavizado" }));
    expect(last().edges[0]).toMatchObject({ smooth: false, points: [{ x: 200, y: 100 }] });
  });
  it("la lista de puntos del panel permite añadir, mover y eliminar sin ratón", async () => {
    const { last } = await mount(free());
    select();
    const list = screen.getByRole("group", { name: "Puntos de control" });
    fireEvent.change(within(list).getByLabelText("Punto 1: X"), { target: { value: "210" } });
    expect(last().edges[0]!.points).toEqual([{ x: 210, y: 100 }]);
    fireEvent.click(within(list).getByRole("button", { name: "Añadir punto" }));
    expect(last().edges[0]!.points).toHaveLength(2);
    fireEvent.click(within(list).getByRole("button", { name: "Eliminar punto 1" }));
    expect(last().edges[0]!.points).toHaveLength(1);
  });
});

describe("etiqueta legible (G-115)", () => {
  it("se dibuja después del trazo y con un halo del color del lienzo, en los cuatro trazados", async () => {
    for (const route of ["straight", "orthogonal", "curved", "free"] as const) {
      const d = withRoute(route, { label: "sí" });
      document.body.innerHTML = "";
      await mount(d);
      const g = document.querySelector("[data-connector]")!;
      const kids = [...g.children];
      const text = g.querySelector("text")!;
      expect(text.getAttribute("stroke")).toBe("var(--c-canvas)"); expect(text.getAttribute("paint-order")).toBe("stroke");
      expect(kids.indexOf(text)).toBeGreaterThan(kids.indexOf(g.querySelector("[data-connector-path]")!));
    }
  });
});
