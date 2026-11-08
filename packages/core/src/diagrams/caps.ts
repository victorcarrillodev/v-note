// Puntas de los conectores (plan 003, DP-7): geometría calculada por el núcleo, de modo que el lienzo y la exportación SVG coincidan.
import type { Point } from "./geometry";
import type { ConnectorPath, PathCmd } from "./path";
import { EDGE_WIDTH_PX, type Cap, type EdgeStyle } from "./style";

export type CapShape = { kind: "polygon"; points: Point[] } | { kind: "circle"; center: Point; r: number };

const arrowLen = (w: number) => 8 + 2 * w;        // fino 10, medio 12, grueso 16
const diamondLen = (w: number) => 10 + 2 * w;
const circleR = (w: number) => 3 + w;

/** Cuánto antes del extremo termina la línea para que no asome bajo la punta. */
export function capInset(cap: Cap, widthPx: number): number {
  return cap === "arrow" ? arrowLen(widthPx) : cap === "diamond" ? diamondLen(widthPx) : cap === "circle" ? 2 * circleR(widthPx) : 0;
}

/** Forma de la punta: `tip` es el extremo del conector (sobre la forma) y `dir` la dirección en que el conector sale de él, hacia afuera de la forma. */
export function capShape(cap: Cap, tip: Point, dir: Point, widthPx: number): CapShape | null {
  if (cap === "none") return null;
  const perp = { x: -dir.y, y: dir.x };
  if (cap === "circle") { const r = circleR(widthPx); return { kind: "circle", center: { x: tip.x + dir.x * r, y: tip.y + dir.y * r }, r }; }
  const len = cap === "arrow" ? arrowLen(widthPx) : diamondLen(widthPx);
  const base = { x: tip.x + dir.x * len, y: tip.y + dir.y * len };
  if (cap === "arrow") { const h = len / 2; return { kind: "polygon", points: [{ x: tip.x, y: tip.y }, { x: base.x + perp.x * h, y: base.y + perp.y * h }, { x: base.x - perp.x * h, y: base.y - perp.y * h }] }; }
  const mid = { x: tip.x + dir.x * len / 2, y: tip.y + dir.y * len / 2 }, h = len * 0.35;
  return { kind: "polygon", points: [{ x: tip.x, y: tip.y }, { x: mid.x + perp.x * h, y: mid.y + perp.y * h }, base, { x: mid.x - perp.x * h, y: mid.y - perp.y * h }] };
}

const shift = (p: Point, dir: Point, by: number): Point => ({ x: p.x + dir.x * by, y: p.y + dir.y * by });

/** Camino del conector con la línea acortada bajo cada punta, más la forma de cada punta. */
export function styledPath(path: ConnectorPath, style: EdgeStyle): { cmds: PathCmd[]; start: CapShape | null; end: CapShape | null } {
  const w = EDGE_WIDTH_PX[style.width];
  let si = capInset(style.startCap, w), ei = capInset(style.endCap, w);
  const total = si + ei, room = path.length * 0.8;
  if (total > room && total > 0) { const f = room / total; si *= f; ei *= f; } // un conector muy corto no se acorta más de lo que mide
  const cmds = path.cmds.map((c) => ({ ...c })) as PathCmd[];
  const first = cmds[0], last = cmds[cmds.length - 1];
  if (first && first.t === "M" && si > 0) {
    first.p = shift(first.p, path.startDir, si);
    const next = cmds[1];
    if (next && next.t === "C") next.c1 = shift(next.c1, path.startDir, si);
  }
  if (last && last.t !== "M" && ei > 0) {
    last.p = shift(last.p, path.endDir, ei);
    if (last.t === "C") last.c2 = shift(last.c2, path.endDir, ei);
  }
  return { cmds, start: capShape(style.startCap, path.start, path.startDir, w), end: capShape(style.endCap, path.end, path.endDir, w) };
}
