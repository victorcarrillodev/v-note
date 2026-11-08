// Camino de un conector (plan 003, §6). Interfaz y exportación SVG dibujan el MISMO resultado.
import { anchorDirection, anchorPosition } from "./anchors";
import type { DEdge, Diagram, Endpoint } from "./diagram";
import { isAttached } from "./diagram";
import { dist, lerp, type Box, type Point } from "./geometry";
import { curvedCmds } from "./routing/curved";
import { freeCmds } from "./routing/free";
import { orthogonalRoute } from "./routing/orthogonal";
import type { PathCmd } from "./routing/types";

export type { PathCmd };
export type ConnectorPath = {
  cmds: PathCmd[];
  start: Point; end: Point;
  /** Dirección en que el conector sale de cada extremo (hacia afuera de la forma o hacia el otro extremo si es libre). */
  startDir: Point; endDir: Point;
  length: number;
  midpoint: Point;
  /** Vértices del trazado de 90° (para arrastrar sus tramos); solo existe en ese trazado. */
  vertices?: Point[];
};

function resolve(d: Diagram, e: Endpoint): Point | null {
  if (!isAttached(e)) return { x: e.x, y: e.y };
  const n = d.nodes.find((x) => x.id === e.node);
  return n ? anchorPosition(n, e.anchor) : null;
}
const unit = (from: Point, to: Point): Point => {
  const l = dist(from, to);
  return l === 0 ? { x: 1, y: 0 } : { x: (to.x - from.x) / l, y: (to.y - from.y) / l };
};
const outward = (e: Endpoint, at: Point, other: Point): Point => (isAttached(e) ? anchorDirection(e.anchor, { x: other.x - at.x, y: other.y - at.y }) : unit(at, other));

const sampleCubic = (p0: Point, c1: Point, c2: Point, p1: Point, t: number): Point => {
  const u = 1 - t;
  return { x: u * u * u * p0.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * p1.x, y: u * u * u * p0.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * p1.y };
};
const polyline = (cmds: PathCmd[]): Point[] => {
  const pts: Point[] = [];
  let cur: Point = { x: 0, y: 0 };
  for (const c of cmds) {
    if (c.t === "C") for (let i = 1; i <= 24; i++) pts.push(sampleCubic(cur, c.c1, c.c2, c.p, i / 24));
    else if (c.t === "M") pts.push(c.p);
    else pts.push(c.p);
    cur = c.p;
  }
  return pts;
};
const measure = (cmds: PathCmd[]): { length: number; at: (t: number) => Point } => {
  const pts = polyline(cmds);
  let total = 0; const cum = [0];
  for (let i = 1; i < pts.length; i++) { total += dist(pts[i - 1]!, pts[i]!); cum.push(total); }
  return {
    length: total,
    at: (t) => {
      if (pts.length === 0) return { x: 0, y: 0 };
      if (t <= 0) return pts[0]!;
      if (t >= 1) return pts[pts.length - 1]!;
      const goal = total * t;
      let i = 1; while (i < cum.length - 1 && cum[i]! < goal) i++;
      const span = cum[i]! - cum[i - 1]!;
      const k = span === 0 ? 0 : (goal - cum[i - 1]!) / span;
      return { x: lerp(pts[i - 1]!.x, pts[i]!.x, k), y: lerp(pts[i - 1]!.y, pts[i]!.y, k) };
    },
  };
};
const linesOf = (pts: Point[]): PathCmd[] => [{ t: "M", p: pts[0]! }, ...pts.slice(1).map((p): PathCmd => ({ t: "L", p }))];

/** Cajas de las formas a las que está unido el conector (las que su ruta de 90° debe rodear). */
function attachedBoxes(d: Diagram, e: DEdge): Box[] {
  const ids = [...new Set([e.from, e.to].filter(isAttached).map((x) => x.node))];
  return ids.map((id) => d.nodes.find((n) => n.id === id)).filter((n): n is NonNullable<typeof n> => !!n).map((n) => ({ x: n.x, y: n.y, w: n.w, h: n.h }));
}

/** Camino del conector, o `null` si una de sus formas ya no existe. */
export function connectorPath(d: Diagram, e: DEdge): ConnectorPath | null {
  const a = resolve(d, e.from), b = resolve(d, e.to);
  if (!a || !b) return null;
  let cmds: PathCmd[], startDir = outward(e.from, a, b), endDir = outward(e.to, b, a), vertices: Point[] | undefined;
  switch (e.route) {
    case "curved": cmds = curvedCmds(a, startDir, b, endDir, e.curvature); break;
    case "orthogonal": {
      const pts = orthogonalRoute({
        start: a, startDir: isAttached(e.from) ? startDir : null, end: b, endDir: isAttached(e.to) ? endDir : null,
        obstacles: attachedBoxes(d, e), ...(e.waypoints ? { waypoints: e.waypoints } : {}),
      });
      vertices = pts; cmds = linesOf(pts);
      // Las puntas y las salidas siguen el primer y el último tramo de la ruta (un extremo libre no tiene anclaje que las fije).
      startDir = unit(pts[0]!, pts[1] ?? b); endDir = unit(pts[pts.length - 1]!, pts[pts.length - 2] ?? a);
      break;
    }
    case "free": {
      const pts = e.points ?? [];
      cmds = freeCmds(a, pts, b, e.smooth ?? false);
      startDir = isAttached(e.from) ? startDir : unit(a, pts[0] ?? b); endDir = isAttached(e.to) ? endDir : unit(b, pts[pts.length - 1] ?? a);
      break;
    }
    default: cmds = [{ t: "M", p: a }, { t: "L", p: b }];
  }
  const m = measure(cmds);
  return { cmds, start: a, end: b, startDir, endDir, length: m.length, midpoint: m.at(0.5), ...(vertices ? { vertices } : {}) };
}

/** Punto a una fracción `t` (0–1) de la longitud del camino. */
export function pointAtPath(p: ConnectorPath, t: number): Point { return measure(p.cmds).at(t); }

const n2 = (v: number) => String(Math.round(v * 100) / 100);
/** Atributo `d` de SVG. */
export const pathToSvg = (p: ConnectorPath): string =>
  p.cmds.map((c) => (c.t === "C" ? `C ${n2(c.c1.x)} ${n2(c.c1.y)} ${n2(c.c2.x)} ${n2(c.c2.y)} ${n2(c.p.x)} ${n2(c.p.y)}` : `${c.t} ${n2(c.p.x)} ${n2(c.p.y)}`)).join(" ");
