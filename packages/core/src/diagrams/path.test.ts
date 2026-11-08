// G-058 (prueba primero): camino de un conector. En el Hito 1 hay recto y redondeado (el redondeado se adelanta del Hito 2 para que
// los diagramas antiguos conserven su aspecto); 90° y libre llegan en el Hito 2.
import { describe, it, expect } from "vitest";
import { connect, addNode, emptyDiagram, type Diagram } from "./diagram";
import { anchorPosition } from "./anchors";
import { connectorPath, pathToSvg, pointAtPath } from "./path";

const must = <T,>(r: { ok: boolean; value?: T; error?: { message: string } }): T => { if (!r.ok) throw new Error(r.error?.message); return r.value as T; };
const two = (): Diagram => {
  let d = emptyDiagram();
  d = addNode(d, { shape: "process", x: 0, y: 0, id: "a" }).diagram;
  d = addNode(d, { shape: "process", x: 400, y: 200, id: "b" }).diagram;
  return d;
};

describe("trazado recto", () => {
  it("va del anclaje de origen al de destino", () => {
    const r = must(connect(two(), { node: "a", anchor: "e" }, { node: "b", anchor: "w" }, { route: "straight" }));
    const p = connectorPath(r.diagram, r.edge)!;
    const a = anchorPosition(r.diagram.nodes[0]!, "e"), b = anchorPosition(r.diagram.nodes[1]!, "w");
    expect(p.cmds).toEqual([{ t: "M", p: a }, { t: "L", p: b }]);
    expect(p.start).toEqual(a); expect(p.end).toEqual(b);
    expect(p.length).toBeCloseTo(Math.hypot(b.x - a.x, b.y - a.y), 6);
    expect(p.midpoint).toEqual({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
    expect(pathToSvg(p)).toBe(`M ${a.x} ${a.y} L ${b.x} ${b.y}`);
  });
  it("con extremos libres usa sus puntos", () => {
    const r = must(connect(emptyDiagram(), { x: 1, y: 2 }, { x: 31, y: 42 }, { route: "straight" }));
    expect(connectorPath(r.diagram, r.edge)!.cmds).toEqual([{ t: "M", p: { x: 1, y: 2 } }, { t: "L", p: { x: 31, y: 42 } }]);
  });
  it("si una forma del extremo no existe no hay camino", () => {
    const r = must(connect(two(), { node: "a", anchor: "e" }, { node: "b", anchor: "w" }));
    expect(connectorPath({ ...r.diagram, nodes: [r.diagram.nodes[0]!] }, r.edge)).toBeNull();
  });
});

describe("trazado redondeado", () => {
  it("sale hacia afuera de cada anclaje: la tangente inicial apunta como la dirección del anclaje y la final llega por la del otro", () => {
    const r = must(connect(two(), { node: "a", anchor: "e" }, { node: "b", anchor: "w" }, { route: "curved" }));
    const p = connectorPath(r.diagram, r.edge)!;
    const [m, c] = p.cmds as [{ t: "M"; p: { x: number; y: number } }, { t: "C"; c1: { x: number; y: number }; c2: { x: number; y: number }; p: { x: number; y: number } }];
    expect(m.t).toBe("M"); expect(c.t).toBe("C");
    expect(c.c1.y).toBe(m.p.y); expect(c.c1.x).toBeGreaterThan(m.p.x);   // sale a la derecha
    expect(c.c2.y).toBe(c.p.y); expect(c.c2.x).toBeLessThan(c.p.x);       // llega por la izquierda
    expect(p.startDir).toEqual({ x: 1, y: 0 }); expect(p.endDir).toEqual({ x: -1, y: 0 });
  });
  it("la distancia de los puntos de control está limitada entre 24 y 160", () => {
    let d = emptyDiagram();
    d = addNode(d, { shape: "process", x: 0, y: 0, id: "a" }).diagram; d = addNode(d, { shape: "process", x: 10_000, y: 0, id: "b" }).diagram;
    const r = must(connect(d, { node: "a", anchor: "e" }, { node: "b", anchor: "w" }, { route: "curved" }));
    const c = connectorPath(r.diagram, r.edge)!.cmds[1] as { c1: { x: number }; p: { x: number } };
    expect(c.c1.x - anchorPosition(r.diagram.nodes[0]!, "e").x).toBe(160);
    const near = must(connect(emptyDiagram(), { x: 0, y: 0 }, { x: 10, y: 0 }, { route: "curved" }));
    expect((connectorPath(near.diagram, near.edge)!.cmds[1] as { c1: { x: number } }).c1.x).toBe(24);
  });
  it("con un extremo libre el control apunta hacia el otro extremo", () => {
    const r = must(connect(two(), { node: "a", anchor: "e" }, { x: 600, y: 0 }, { route: "curved" }));
    const p = connectorPath(r.diagram, r.edge)!;
    expect(p.endDir.x).toBeLessThan(0);
  });
});

describe("trazado de 90° y libre en el camino del conector (G-085, G-087)", () => {
  it("el de 90° expone sus vértices, todos los tramos son horizontales o verticales y la punta llega por el anclaje", () => {
    const r = must(connect(two(), { node: "a", anchor: "e" }, { node: "b", anchor: "w" }, { route: "orthogonal" }));
    const p = connectorPath(r.diagram, r.edge)!;
    expect(p.vertices!.slice(1).every((q, i) => q.x === p.vertices![i]!.x || q.y === p.vertices![i]!.y)).toBe(true);
    expect(p.cmds.every((c) => c.t === "M" || c.t === "L")).toBe(true);
    expect(p.startDir).toEqual({ x: 1, y: 0 }); expect(p.endDir).toEqual({ x: -1, y: 0 });
  });
  it("los puntos de paso desvían la ruta", () => {
    const r = must(connect(two(), { node: "a", anchor: "e" }, { node: "b", anchor: "w" }, { route: "orthogonal" }));
    const e = { ...r.edge, waypoints: [{ x: 200, y: 130 }] };
    expect(connectorPath(r.diagram, e)!.vertices!.some((q) => q.x === 200)).toBe(true);
  });
  it("el libre pasa por sus puntos de control, recto o suavizado", () => {
    const r = must(connect(two(), { node: "a", anchor: "e" }, { node: "b", anchor: "w" }, { route: "free" }));
    const e = { ...r.edge, points: [{ x: 250, y: 50 }, { x: 300, y: 250 }] };
    expect(connectorPath(r.diagram, e)!.cmds.map((c) => c.p)).toEqual([anchorPosition(r.diagram.nodes[0]!, "e"), { x: 250, y: 50 }, { x: 300, y: 250 }, anchorPosition(r.diagram.nodes[1]!, "w")]);
    const smooth = connectorPath(r.diagram, { ...e, smooth: true })!;
    expect(smooth.cmds.slice(1).every((c) => c.t === "C")).toBe(true);
  });
  it("el redondeado respeta la curvatura elegida", () => {
    const r = must(connect(two(), { node: "a", anchor: "e" }, { node: "b", anchor: "w" }, { route: "curved" }));
    const k = (cur: number) => (connectorPath(r.diagram, { ...r.edge, curvature: cur })!.cmds[1] as { c1: { x: number } }).c1.x;
    expect(k(1)).toBeGreaterThan(k(0.3));
  });
  it("la etiqueta queda en el punto medio por longitud de arco de un camino de cada trazado (G-088)", () => {
    for (const route of ["straight", "orthogonal", "curved", "free"] as const) {
      const r = must(connect(two(), { node: "a", anchor: "e" }, { node: "b", anchor: "w" }, { route }));
      const p = connectorPath(r.diagram, r.edge)!;
      expect(p.midpoint).toEqual(pointAtPath(p, 0.5));
      expect(p.midpoint.x).toBeGreaterThanOrEqual(p.start.x - 1); expect(p.midpoint.x).toBeLessThanOrEqual(p.end.x + 1);
    }
  });
});

describe("punto sobre el camino", () => {
  it("el punto medio por longitud de arco de un recto es el centro del segmento", () => {
    const r = must(connect(emptyDiagram(), { x: 0, y: 0 }, { x: 100, y: 0 }, { route: "straight" }));
    const p = connectorPath(r.diagram, r.edge)!;
    expect(pointAtPath(p, 0.5)).toEqual({ x: 50, y: 0 });
    expect(pointAtPath(p, 0)).toEqual({ x: 0, y: 0 }); expect(pointAtPath(p, 1)).toEqual({ x: 100, y: 0 });
  });
  it("en un camino curvo el punto a mitad queda entre los extremos", () => {
    const r = must(connect(two(), { node: "a", anchor: "e" }, { node: "b", anchor: "w" }, { route: "curved" }));
    const p = connectorPath(r.diagram, r.edge)!, m = pointAtPath(p, 0.5);
    expect(m.x).toBeGreaterThan(p.start.x); expect(m.x).toBeLessThan(p.end.x);
    expect(m.y).toBeGreaterThan(p.start.y); expect(m.y).toBeLessThan(p.end.y);
  });
});
