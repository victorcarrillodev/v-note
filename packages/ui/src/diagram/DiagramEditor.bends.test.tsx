// R-090 a R-099 (prueba primero): agregar y quitar puntos de quiebre en el lienzo (spec 004, RF-6, RF-7).
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fireEvent, screen, within, cleanup } from "@testing-library/react";
import { renderWithI18n } from "../../tests/renderWithI18n";
import { DiagramEditor } from "./DiagramEditor";
import { GRID_PREFS_KEY } from "../canvas/gridPrefs";
import { addNode, connect, connectorPath, emptyDiagram, parseDiagram, pointAtPath, serializeDiagram, type DEdge, type Diagram, type Route } from "@vnote/core";

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
const PTS = [{ x: 200, y: 20 }, { x: 300, y: 240 }, { x: 350, y: 120 }];
async function mount(d: Diagram) {
  const saved: string[] = [];
  const onChange = vi.fn((t: string) => { saved.push(t); });
  await renderWithI18n(<DiagramEditor value={serializeDiagram(d)} onChange={onChange} />);
  return { saved, onChange, last: (): Diagram => must(parseDiagram(saved[saved.length - 1]!)) };
}
const select = () => fireEvent.keyDown(document.querySelector("[data-connector]")!, { key: "Enter" });
const handle = (i: number) => document.querySelector(`[data-control-point='${i}'] [data-control-hit]`)!;
const down = (el: Element, x = 0, y = 0) => fireEvent.pointerDown(el, { clientX: x, clientY: y, button: 0, pointerId: 1, pointerType: "mouse" });
const up = (x = 0, y = 0) => fireEvent.pointerUp(window, { clientX: x, clientY: y, pointerId: 1, pointerType: "mouse" });
const noSnap = () => localStorage.setItem(GRID_PREFS_KEY, JSON.stringify({ show: true, snap: false }));

beforeEach(() => { localStorage.clear(); noSnap(); });
afterEach(() => { vi.restoreAllMocks(); cleanup(); });

describe("asas de los puntos en los tres trazados (R-090)", () => {
  it("curvo con puntos: una asa por punto", async () => {
    await mount(withRoute("curved", { points: PTS })); select();
    expect(document.querySelectorAll("[data-control-point]")).toHaveLength(3);
  });
  it("90°: una asa por punto de paso (las esquinas automáticas no tienen asa de punto)", async () => {
    await mount(withRoute("orthogonal", { waypoints: [{ x: 250, y: 100 }] })); select();
    expect(document.querySelectorAll("[data-control-point]")).toHaveLength(1);
  });
  it("90° sin puntos de paso: ninguna asa de punto", async () => {
    await mount(withRoute("orthogonal")); select();
    expect(document.querySelectorAll("[data-control-point]")).toHaveLength(0);
  });
  for (const route of ["curved", "free"] as const) {
    it(`doble clic sobre un punto lo elimina (${route})`, async () => {
      const { last, onChange } = await mount(withRoute(route, { points: PTS })); select();
      fireEvent.doubleClick(handle(1));
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(last().edges[0]!.points).toEqual([PTS[0], PTS[2]]);
    });
  }
  it("doble clic sobre un punto de paso en 90° lo elimina y la ruta se recalcula", async () => {
    const { last } = await mount(withRoute("orthogonal", { waypoints: [{ x: 250, y: 100 }, { x: 330, y: 220 }] })); select();
    fireEvent.doubleClick(handle(0));
    expect(last().edges[0]!.waypoints).toEqual([{ x: 330, y: 220 }]);
  });
  it("quitar el último punto deja el conector directo (CL-3)", async () => {
    const d = withRoute("curved", { points: [PTS[0]!] });
    const { last } = await mount(d); select();
    fireEvent.doubleClick(handle(0));
    expect("points" in last().edges[0]!).toBe(false);
  });
});

describe("el doble clic del punto gana al del lienzo (R-092)", () => {
  it("no se propaga al documento (no abre ni amplía nada)", async () => {
    await mount(withRoute("free", { points: PTS })); select();
    const seen = vi.fn(); document.addEventListener("dblclick", seen);
    fireEvent.doubleClick(handle(0));
    document.removeEventListener("dblclick", seen);
    expect(seen).not.toHaveBeenCalled();
  });
});

describe("doble clic sobre un tramo agrega un punto (R-091)", () => {
  const clickOn = (d: Diagram, t: number) => { const p = pointAtPath(connectorPath(d, d.edges[0]!)!, t); fireEvent.doubleClick(document.querySelector("[data-connector-hit]")!, { clientX: p.x, clientY: p.y }); return p; };
  for (const route of ["curved", "free"] as const) {
    it(`${route}: aparece un punto sobre el tramo`, async () => {
      const d = withRoute(route, route === "free" ? { points: [PTS[0]!] } : {});
      const { last } = await mount(d); select();
      const p = clickOn(d, 0.75);
      const pts = last().edges[0]!.points!;
      expect(pts.length).toBe(route === "free" ? 2 : 1);
      expect(pts.some((q) => Math.hypot(q.x - p.x, q.y - p.y) < 2)).toBe(true);
    });
  }
  it("90°: aparece un punto de paso", async () => {
    const d = withRoute("orthogonal");
    const { last } = await mount(d); select();
    clickOn(d, 0.5);
    expect(last().edges[0]!.waypoints).toHaveLength(1);
  });
  it("recto: pasa a libre con el punto", async () => {
    const d = withRoute("straight");
    const { last } = await mount(d); select();
    clickOn(d, 0.5);
    expect(last().edges[0]!.route).toBe("free");
    expect(last().edges[0]!.points).toHaveLength(1);
  });
  it("con el acomodo activo el punto queda en la cuadrícula (R-095)", async () => {
    localStorage.setItem(GRID_PREFS_KEY, JSON.stringify({ show: true, snap: true }));
    const d = withRoute("free", { points: [PTS[0]!] });
    const { last } = await mount(d); select();
    clickOn(d, 0.8);
    for (const q of last().edges[0]!.points!) { expect(Math.abs(q.x % 20)).toBe(0); expect(Math.abs(q.y % 20)).toBe(0); }
  });
  it("es un solo paso de historial y se deshace", async () => {
    const d = withRoute("curved");
    const { last, onChange } = await mount(d); select();
    clickOn(d, 0.5);
    expect(onChange).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Deshacer" }));
    expect("points" in last().edges[0]!).toBe(false);
  });
});

describe("menú del punto seleccionado (R-093, R-098)", () => {
  it("seleccionar un punto muestra «Opciones del punto» con «Eliminar punto», y reemplaza al menú del conector", async () => {
    const { last } = await mount(withRoute("free", { points: PTS })); select();
    down(handle(1)); up();
    const menu = await screen.findByRole("dialog", { name: "Opciones del punto" });
    expect(screen.queryByRole("dialog", { name: "Opciones del conector" })).toBeNull();
    fireEvent.click(within(menu).getByRole("button", { name: "Eliminar punto" }));
    expect(last().edges[0]!.points).toEqual([PTS[0], PTS[2]]);
    expect(screen.queryByRole("dialog", { name: "Opciones del punto" })).toBeNull();
  });
  it("90°: el menú del punto de paso ofrece «Restablecer ruta»", async () => {
    const { last } = await mount(withRoute("orthogonal", { waypoints: [{ x: 250, y: 100 }, { x: 330, y: 220 }] })); select();
    down(handle(0)); up();
    const menu = await screen.findByRole("dialog", { name: "Opciones del punto" });
    fireEvent.click(within(menu).getByRole("button", { name: "Restablecer ruta" }));
    expect(last().edges[0]!.waypoints ?? []).toEqual([]);
  });
  it("90°: el menú del conector explica que las esquinas automáticas no se eliminan", async () => {
    await mount(withRoute("orthogonal")); select();
    const menu = await screen.findByRole("dialog", { name: "Opciones del conector" });
    expect(within(menu).getByText(/esquinas automáticas/i)).toBeInTheDocument();
  });
  it("Supr con un punto seleccionado lo elimina", async () => {
    const { last } = await mount(withRoute("curved", { points: PTS })); select();
    down(handle(0)); up();
    fireEvent.keyDown(handle(0), { key: "Delete" });
    expect(last().edges[0]!.points).toEqual([PTS[1], PTS[2]]);
  });
});

describe("arrastrar un punto (R-094)", () => {
  it("un arrastre = un paso, y se deshace", async () => {
    const { last, onChange } = await mount(withRoute("curved", { points: PTS })); select();
    down(handle(1), 300, 240);
    for (const [x, y] of [[310, 250], [320, 260], [330, 270]]) fireEvent.pointerMove(window, { clientX: x, clientY: y, pointerId: 1, pointerType: "mouse" });
    up(330, 270);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(last().edges[0]!.points![1]).toEqual({ x: 330, y: 270 });
    fireEvent.click(screen.getByRole("button", { name: "Deshacer" }));
    expect(last().edges[0]!.points![1]).toEqual(PTS[1]);
  });
  it("en 90° mueve el punto de paso", async () => {
    const { last } = await mount(withRoute("orthogonal", { waypoints: [{ x: 250, y: 100 }] })); select();
    down(handle(0), 250, 100);
    fireEvent.pointerMove(window, { clientX: 260, clientY: 110, pointerId: 1, pointerType: "mouse" });
    up(260, 110);
    expect(last().edges[0]!.waypoints).toEqual([{ x: 260, y: 110 }]);
  });
  it("con el acomodo activo el punto arrastrado queda en la cuadrícula", async () => {
    localStorage.setItem(GRID_PREFS_KEY, JSON.stringify({ show: true, snap: true }));
    const { last } = await mount(withRoute("free", { points: PTS })); select();
    down(handle(0), 200, 20);
    fireEvent.pointerMove(window, { clientX: 233, clientY: 47, pointerId: 1, pointerType: "mouse" });
    up(233, 47);
    const q = last().edges[0]!.points![0]!;
    expect(Math.abs(q.x % 20)).toBe(0); expect(Math.abs(q.y % 20)).toBe(0);
  });
});

describe("tamaño del área sensible (R-096)", () => {
  const radius = () => Number(handle(0).getAttribute("r"));
  it("32 px con puntero fino", async () => {
    await mount(withRoute("free", { points: PTS })); select();
    expect(radius() * 2).toBe(32);
  });
  it("44 px con puntero grueso", async () => {
    vi.stubGlobal("matchMedia", (q: string) => ({ matches: q.includes("pointer: coarse"), media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false }));
    await mount(withRoute("free", { points: PTS })); select();
    expect(radius() * 2).toBe(44);
    vi.unstubAllGlobals();
  });
});

describe("muchos puntos (R-097)", () => {
  it("50 puntos se dibujan y se editan", async () => {
    const pts = Array.from({ length: 50 }, (_, i) => ({ x: 20 + i * 6, y: i % 2 === 0 ? 20 : 220 }));
    const { last } = await mount(withRoute("curved", { points: pts })); select();
    expect(document.querySelectorAll("[data-control-point]")).toHaveLength(50);
    fireEvent.doubleClick(handle(49));
    expect(last().edges[0]!.points).toHaveLength(49);
  });
});

describe("lista de puntos del menú para el trazado curvo (R-090)", () => {
  it("el curvo también lista sus puntos con X, Y y eliminar", async () => {
    const { last } = await mount(withRoute("curved", { points: PTS })); select();
    const menu = await screen.findByRole("dialog", { name: "Opciones del conector" });
    fireEvent.change(within(menu).getByLabelText("Punto 1: X"), { target: { value: "210" } });
    expect(last().edges[0]!.points![0]!.x).toBe(210);
    fireEvent.click(within(menu).getByRole("button", { name: "Eliminar punto 2" }));
    expect(last().edges[0]!.points).toHaveLength(2);
  });
});
