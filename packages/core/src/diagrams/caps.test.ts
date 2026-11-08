// G-136, G-137, G-138 (prueba primero): puntas de los conectores, calculadas por el núcleo para que el lienzo y la exportación coincidan.
import { describe, it, expect } from "vitest";
import { capShape, capInset, styledPath } from "./caps";
import { addNode, connect, emptyDiagram } from "./diagram";
import { connectorPath } from "./path";
import { defaultEdgeStyle } from "./style";

const must = <T,>(r: { ok: boolean; value?: T; error?: { message: string } }): T => { if (!r.ok) throw new Error(r.error?.message); return r.value as T; };
const W = { x: -1, y: 0 }, E = { x: 1, y: 0 };

describe("geometría de cada punta", () => {
  it("ninguna no dibuja nada y no acorta la línea", () => {
    expect(capShape("none", { x: 0, y: 0 }, E, 2)).toBeNull(); expect(capInset("none", 2)).toBe(0);
  });
  it("la flecha es un triángulo con la punta en el extremo y la base detrás, según la dirección (tamaño según el grosor)", () => {
    const s = capShape("arrow", { x: 100, y: 50 }, W, 2)!;
    expect(s.kind).toBe("polygon");
    const pts = (s as { points: { x: number; y: number }[] }).points;
    expect(pts[0]).toEqual({ x: 100, y: 50 });
    expect(pts[1]).toEqual({ x: 88, y: 44 }); expect(pts[2]).toEqual({ x: 88, y: 56 });
    expect(capInset("arrow", 2)).toBe(12);
  });
  it("crece con el grosor: fino 10, medio 12, grueso 16", () => {
    expect([1, 2, 4].map((w) => capInset("arrow", w))).toEqual([10, 12, 16]);
  });
  it("el círculo toca el extremo con su borde y se centra un radio hacia atrás", () => {
    const s = capShape("circle", { x: 100, y: 50 }, W, 2)! as { kind: "circle"; center: { x: number; y: number }; r: number };
    expect(s.kind).toBe("circle"); expect(s.r).toBe(5);
    expect(s.center).toEqual({ x: 95, y: 50 });
    expect(capInset("circle", 2)).toBe(10);
  });
  it("el rombo tiene cuatro vértices, el primero en el extremo y el tercero a todo su largo", () => {
    const pts = (capShape("diamond", { x: 100, y: 50 }, W, 2)! as { points: { x: number; y: number }[] }).points;
    expect(pts).toHaveLength(4); expect(pts[0]).toEqual({ x: 100, y: 50 });
    expect(pts[2]!.x).toBeCloseTo(100 - capInset("diamond", 2), 9); expect(pts[2]!.y).toBe(50);
    expect(pts[1]!.y).toBeCloseTo(100 - pts[3]!.y, 9); // simétrico respecto a la línea
  });
  it("la orientación sigue la dirección del conector: vertical hacia arriba", () => {
    const pts = (capShape("arrow", { x: 10, y: 10 }, { x: 0, y: -1 }, 2)! as { points: { x: number; y: number }[] }).points;
    expect(pts[1]!.y).toBe(-2); expect(pts[2]!.y).toBe(-2);
    expect(new Set([pts[1]!.x, pts[2]!.x])).toEqual(new Set([4, 16]));
  });
});

describe("la línea se acorta bajo la punta y la punta hereda el trazo (G-137, G-138)", () => {
  const two = () => {
    let d = emptyDiagram();
    d = addNode(d, { shape: "process", x: 0, y: 0, id: "a" }).diagram; d = addNode(d, { shape: "process", x: 400, y: 200, id: "b" }).diagram;
    const r = must(connect(d, { node: "a", anchor: "e" }, { node: "b", anchor: "w" }, { route: "straight" }));
    return { d: r.diagram, p: connectorPath(r.diagram, r.edge)! };
  };
  it("con flecha al final la línea termina donde empieza la base de la flecha", () => {
    const { p } = two();
    const s = styledPath(p, { ...defaultEdgeStyle(), endCap: "arrow", startCap: "none" });
    expect((s.cmds[1] as { p: { x: number; y: number } }).p).toEqual({ x: 400 - 12, y: 230 });
    expect((s.cmds[0] as { p: { x: number; y: number } }).p).toEqual(p.start); // sin punta al inicio no se acorta
    expect(s.end).not.toBeNull(); expect(s.start).toBeNull();
  });
  it("origen y destino son independientes: una punta distinta en cada extremo", () => {
    const { p } = two();
    const s = styledPath(p, { ...defaultEdgeStyle(), startCap: "circle", endCap: "diamond" });
    expect(s.start!.kind).toBe("circle"); expect(s.end!.kind).toBe("polygon");
    expect((s.cmds[0] as { p: { x: number } }).p.x).toBe(140 + 10);       // círculo: 2 × 5
    expect((s.cmds[1] as { p: { x: number } }).p.x).toBe(400 - capInset("diamond", 2));
  });
  it("en una curva también se desplazan los puntos de control, así la línea no se deforma", () => {
    let d = emptyDiagram();
    d = addNode(d, { shape: "process", x: 0, y: 0, id: "a" }).diagram; d = addNode(d, { shape: "process", x: 400, y: 200, id: "b" }).diagram;
    const r = must(connect(d, { node: "a", anchor: "e" }, { node: "b", anchor: "w" }, { route: "curved" }));
    const p = connectorPath(r.diagram, r.edge)!, s = styledPath(p, { ...defaultEdgeStyle(), endCap: "arrow" });
    const c0 = p.cmds[1] as { c2: { x: number }; p: { x: number } }, c1 = s.cmds[1] as { c2: { x: number }; p: { x: number } };
    expect(c1.p.x - c0.p.x).toBe(-12); expect(c1.c2.x - c0.c2.x).toBe(-12);
  });
  it("un conector muy corto no se acorta más de lo que mide", () => {
    const r = must(connect(emptyDiagram(), { x: 0, y: 0 }, { x: 8, y: 0 }, { route: "straight" }));
    const s = styledPath(connectorPath(r.diagram, r.edge)!, { ...defaultEdgeStyle(), startCap: "arrow", endCap: "arrow" });
    const a = (s.cmds[0] as { p: { x: number } }).p.x, b = (s.cmds[1] as { p: { x: number } }).p.x;
    expect(b).toBeGreaterThanOrEqual(a);
  });
});
