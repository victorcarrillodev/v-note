// Trazado libre (plan 003, §6.4): poligonal o Catmull-Rom por los puntos de control.
import type { Point } from "../geometry";
import type { PathCmd } from "./types";

export function freeCmds(a: Point, points: Point[], b: Point, smooth: boolean): PathCmd[] {
  const P = [a, ...points, b];
  if (!smooth || points.length === 0) return [{ t: "M", p: a }, ...P.slice(1).map((p): PathCmd => ({ t: "L", p }))];
  const cmds: PathCmd[] = [{ t: "M", p: a }];
  for (let i = 0; i < P.length - 1; i++) {
    const p0 = P[Math.max(0, i - 1)]!, p1 = P[i]!, p2 = P[i + 1]!, p3 = P[Math.min(P.length - 1, i + 2)]!;
    // Catmull-Rom uniforme (tensión 0,5) → Bézier cúbica: c1 = p1 + (p2 − p0)/6, c2 = p2 − (p3 − p1)/6
    cmds.push({ t: "C", c1: { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 }, c2: { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 }, p: p2 });
  }
  return cmds;
}

/** Índice donde insertar un punto de control nuevo para que quede en el tramo del trazado más cercano a `p`. */
export function insertIndexFor(a: Point, points: Point[], b: Point, p: Point): number {
  const P = [a, ...points, b];
  let best = 0, bestD = Infinity;
  for (let i = 0; i < P.length - 1; i++) {
    const s = P[i]!, e = P[i + 1]!, dx = e.x - s.x, dy = e.y - s.y, l2 = dx * dx + dy * dy;
    const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - s.x) * dx + (p.y - s.y) * dy) / l2));
    const d = Math.hypot(p.x - (s.x + t * dx), p.y - (s.y + t * dy));
    if (d < bestD - 1e-9) { bestD = d; best = i; }
  }
  return best;
}
