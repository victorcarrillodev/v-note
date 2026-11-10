// R-081 a R-088 (prueba primero): curva suave y continua por los puntos (plan 004, DP-11, §8.3).
import { describe, it, expect } from "vitest";
import { curvedCmds, curvedThroughCmds } from "./curved";
import type { PathCmd } from "./types";
import type { Point } from "../geometry";
import { addNode, connect, emptyDiagram, type Diagram, type DEdge } from "../diagram";
import { connectorPath } from "../path";

const sub = (a: Point, b: Point): Point => ({ x: a.x - b.x, y: a.y - b.y });
const cross = (a: Point, b: Point) => a.x * b.y - a.y * b.x;
const dot = (a: Point, b: Point) => a.x * b.x + a.y * b.y;
const len = (a: Point) => Math.hypot(a.x, a.y);
const unit = (a: Point): Point => { const l = len(a); return { x: a.x / l, y: a.y / l }; };
const cubics = (cmds: PathCmd[]) => cmds.filter((c): c is Extract<PathCmd, { t: "C" }> => c.t === "C");
const start: Point = { x: 0, y: 0 }, end: Point = { x: 400, y: 200 };
const east: Point = { x: 1, y: 0 }, west: Point = { x: -1, y: 0 }, south: Point = { x: 0, y: 1 }, north: Point = { x: 0, y: -1 };

describe("sin puntos intermedios (R-081)", () => {
  it("una sola Bézier que sale de cada anclaje en su dirección, sin tramos rectos", () => {
    const cmds = curvedCmds(start, east, end, west);
    expect(cmds.map((c) => c.t)).toEqual(["M", "C"]);
    const c = cubics(cmds)[0]!;
    expect(cross(sub(c.c1, start), east)).toBeCloseTo(0, 6);
    expect(dot(sub(c.c1, start), east)).toBeGreaterThan(0);
    expect(cross(sub(c.c2, end), west)).toBeCloseTo(0, 6);
    // los controles no están sobre la cuerda: no es una recta
    const chord = sub(end, start);
    expect(Math.abs(cross(sub(c.c1, start), chord)) / len(chord)).toBeGreaterThan(1);
    expect(Math.abs(cross(sub(c.c2, start), chord)) / len(chord)).toBeGreaterThan(1);
  });
  it("no hay ningún comando de línea recta", () => { expect(curvedCmds(start, south, end, north).some((c) => c.t === "L")).toBe(false); });
});

describe("por los puntos (R-082)", () => {
  const pts: Point[] = [{ x: 100, y: 120 }, { x: 220, y: 40 }, { x: 330, y: 150 }];
  it("una Bézier por tramo y la curva pasa por cada punto, en orden", () => {
    const cmds = curvedThroughCmds(start, east, pts, end, west);
    expect(cmds[0]).toEqual({ t: "M", p: start });
    const cs = cubics(cmds);
    expect(cs).toHaveLength(4);
    expect(cs.map((c) => c.p)).toEqual([...pts, end]);
    expect(cmds.some((c) => c.t === "L")).toBe(false);
  });
  it("todo es finito", () => {
    for (const c of cubics(curvedThroughCmds(start, east, pts, end, west))) for (const q of [c.c1, c.c2, c.p]) { expect(Number.isFinite(q.x)).toBe(true); expect(Number.isFinite(q.y)).toBe(true); }
  });
});

describe("continuidad sin esquinas (R-083)", () => {
  const configs: [string, Point[]][] = [
    ["tres puntos en zigzag", [{ x: 80, y: 150 }, { x: 200, y: 20 }, { x: 320, y: 170 }]],
    ["un solo punto", [{ x: 200, y: 160 }]],
    ["puntos casi alineados", [{ x: 100, y: 50.4 }, { x: 200, y: 99.8 }, { x: 300, y: 150.3 }]],
    ["puntos muy desiguales", [{ x: 10, y: 190 }, { x: 390, y: 10 }]],
    ["hacia atrás", [{ x: 500, y: 100 }, { x: 200, y: 260 }]],
  ];
  for (const [name, pts] of configs) {
    it(name, () => {
      const cs = cubics(curvedThroughCmds(start, east, pts, end, west));
      for (let i = 0; i < cs.length - 1; i++) {
        const into = sub(cs[i]!.p, cs[i]!.c2), out = sub(cs[i + 1]!.c1, cs[i]!.p);
        expect(Math.abs(cross(unit(into), unit(out))), `punto ${i}`).toBeLessThan(1e-6);
        expect(dot(into, out), `mismo sentido en el punto ${i}`).toBeGreaterThan(0);
      }
    });
  }
});

describe("extremos con la tangente del anclaje (R-084)", () => {
  it("sale perpendicular al lado del anclaje y llega por el suyo", () => {
    const cs = cubics(curvedThroughCmds(start, south, [{ x: 200, y: 150 }], end, north));
    const first = cs[0]!, last = cs.at(-1)!;
    expect(cross(unit(sub(first.c1, start)), south)).toBeCloseTo(0, 6);
    expect(dot(sub(first.c1, start), south)).toBeGreaterThan(0);
    expect(cross(unit(sub(last.c2, end)), north)).toBeCloseTo(0, 6);
    expect(dot(sub(last.c2, end), north)).toBeGreaterThan(0);
  });
});

describe("casos patológicos sin picos ni bucles (R-085, CL-5)", () => {
  const turn = (cmds: PathCmd[]) => {
    // giro máximo entre dos muestras consecutivas de la curva
    const pts: Point[] = [];
    let cur: Point = start;
    for (const c of cmds) { if (c.t === "C") for (let i = 1; i <= 40; i++) { const t = i / 40, u = 1 - t; pts.push({ x: u * u * u * cur.x + 3 * u * u * t * c.c1.x + 3 * u * t * t * c.c2.x + t * t * t * c.p.x, y: u * u * u * cur.y + 3 * u * u * t * c.c1.y + 3 * u * t * t * c.c2.y + t * t * t * c.p.y }); } cur = c.p; }
    let worst = 0;
    for (let i = 2; i < pts.length; i++) { const a = sub(pts[i - 1]!, pts[i - 2]!), b = sub(pts[i]!, pts[i - 1]!); if (len(a) > 1e-9 && len(b) > 1e-9) worst = Math.max(worst, Math.acos(Math.max(-1, Math.min(1, dot(unit(a), unit(b)))))); }
    return worst;
  };
  const finite = (cmds: PathCmd[]) => cmds.every((c) => [c.p, ...(c.t === "C" ? [c.c1, c.c2] : [])].every((q) => Number.isFinite(q.x) && Number.isFinite(q.y)));
  it("puntos duplicados", () => {
    const cmds = curvedThroughCmds(start, east, [{ x: 150, y: 80 }, { x: 150, y: 80 }, { x: 150.0001, y: 80 }], end, west);
    expect(finite(cmds)).toBe(true);
    expect(turn(cmds)).toBeLessThan(Math.PI / 2);
  });
  it("puntos pegados a los extremos", () => {
    const cmds = curvedThroughCmds(start, east, [{ x: 1, y: 1 }, { x: 399, y: 199 }], end, west);
    expect(finite(cmds)).toBe(true);
    expect(turn(cmds)).toBeLessThan(Math.PI / 2);
  });
  it("puntos casi alineados con los extremos", () => {
    const cmds = curvedThroughCmds(start, east, [{ x: 100, y: 50 }, { x: 200, y: 100 }, { x: 300, y: 150 }], end, east);
    expect(finite(cmds)).toBe(true);
    expect(turn(cmds)).toBeLessThan(Math.PI / 2);
  });
  it("el punto coincide con un extremo", () => {
    const cmds = curvedThroughCmds(start, east, [{ x: 0, y: 0 }], end, west);
    expect(finite(cmds)).toBe(true);
  });
  it("un tramo mucho más largo que otro", () => {
    const cmds = curvedThroughCmds(start, east, [{ x: 3, y: 2 }, { x: 395, y: 3 }], end, west);
    expect(finite(cmds)).toBe(true);
    expect(turn(cmds)).toBeLessThan(Math.PI * 0.75);
  });
});

describe("en el conector del diagrama (R-086 a R-088)", () => {
  const base = (route: "curved" | "free", extra: Partial<DEdge> = {}): { d: Diagram; e: DEdge } => {
    let d = emptyDiagram();
    d = addNode(d, { shape: "process", x: 0, y: 0, id: "a", text: "A" }).diagram;
    d = addNode(d, { shape: "process", x: 400, y: 200, id: "b", text: "B" }).diagram;
    const r = connect(d, { node: "a", anchor: "e" }, { node: "b", anchor: "w" }, { route });
    if (!r.ok) throw new Error("connect");
    const e = { ...r.value.edge, ...extra };
    return { d: { ...r.value.diagram, edges: [e] }, e };
  };
  it("curvo con puntos: la curva pasa por ellos y no hay líneas rectas (R-082)", () => {
    const { d, e } = base("curved", { points: [{ x: 250, y: 20 }, { x: 330, y: 260 }] });
    const p = connectorPath(d, e)!;
    expect(p.cmds.some((c) => c.t === "L")).toBe(false);
    expect(cubics(p.cmds).map((c) => c.p)).toContainEqual({ x: 250, y: 20 });
    expect(cubics(p.cmds).map((c) => c.p)).toContainEqual({ x: 330, y: 260 });
  });
  it("las puntas siguen la tangente final de la curva (R-086)", () => {
    const { d, e } = base("curved", { points: [{ x: 250, y: 20 }] });
    const p = connectorPath(d, e)!;
    const last = cubics(p.cmds).at(-1)!;
    const arrow = unit(sub(last.p, last.c2));
    expect(dot(arrow, { x: -p.endDir.x, y: -p.endDir.y })).toBeCloseTo(1, 6);
    const first = cubics(p.cmds)[0]!;
    expect(dot(unit(sub(first.c1, p.start)), p.startDir)).toBeCloseTo(1, 6);
  });
  it("los conectores anteriores con `curvature` no cambian (R-087)", () => {
    const { d, e } = base("curved", { curvature: 0.7 });
    const p = connectorPath(d, e)!;
    expect(p.cmds).toEqual(curvedCmds(p.start, p.startDir, p.end, p.endDir, 0.7));
    const { d: d2, e: e2 } = base("curved");
    const p2 = connectorPath(d2, e2)!;
    expect(p2.cmds).toEqual(curvedCmds(p2.start, p2.startDir, p2.end, p2.endDir, undefined));
  });
  it("el trazado libre con segmentos rectos se conserva como trazado aparte (R-088)", () => {
    const pts = [{ x: 150, y: 60 }, { x: 300, y: 190 }];
    const { d, e } = base("free", { points: pts, smooth: false });
    expect(connectorPath(d, e)!.cmds.every((c) => c.t === "M" || c.t === "L")).toBe(true);
    const { d: d2, e: e2 } = base("free", { points: pts, smooth: true });
    expect(connectorPath(d2, e2)!.cmds.some((c) => c.t === "C")).toBe(true);
  });
});
