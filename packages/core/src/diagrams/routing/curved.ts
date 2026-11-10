// Trazado redondeado (plan 003, §6.3): Bézier cúbica que sale hacia afuera de cada anclaje, sin picos.
import { dist, type Point } from "../geometry";
import type { PathCmd } from "./types";

export const CURVATURE_MIN = 0.2, CURVATURE_MAX = 1, DEFAULT_CURVATURE = 0.5;
const MIN_CTRL = 24, MAX_CTRL_DEFAULT = 160;

/** Separación de los puntos de control: con la curvatura por defecto, entre 24 y 160; con una elegida solo hay mínimo (la persona manda). */
function controlLength(a: Point, b: Point, curvature?: number): number {
  const base = dist(a, b) * (curvature ?? DEFAULT_CURVATURE);
  return curvature === undefined ? Math.min(MAX_CTRL_DEFAULT, Math.max(MIN_CTRL, base)) : Math.max(MIN_CTRL, base);
}

export function curvedCmds(a: Point, startDir: Point, b: Point, endDir: Point, curvature?: number): PathCmd[] {
  const k = controlLength(a, b, curvature);
  return [{ t: "M", p: a }, { t: "C", c1: { x: a.x + startDir.x * k, y: a.y + startDir.y * k }, c2: { x: b.x + endDir.x * k, y: b.y + endDir.y * k }, p: b }];
}

/** Posición del asa de curvatura: el primer punto de control (sobre la dirección de salida del origen). */
export function curveHandle(a: Point, startDir: Point, b: Point, _endDir: Point, curvature?: number): Point {
  const k = controlLength(a, b, curvature);
  return { x: a.x + startDir.x * k, y: a.y + startDir.y * k };
}

/** Curvatura (0,2–1, redondeada a 0,01) que corresponde a arrastrar el asa hasta `target`: la distancia sobre la dirección de salida entre la distancia a b. */
export function curvatureForPoint(a: Point, startDir: Point, b: Point, _endDir: Point, target: Point): number {
  const along = (target.x - a.x) * startDir.x + (target.y - a.y) * startDir.y;
  const raw = along / Math.max(dist(a, b), 1e-9);
  return Math.round(Math.min(CURVATURE_MAX, Math.max(CURVATURE_MIN, raw)) * 100) / 100;
}

// --- Curva continua por puntos (spec 004, RF-8; plan DP-11) ---------------------------------------------------------------------------

/** Separación mínima entre puntos consecutivos y con los extremos para dibujar: más cerca darían picos o bucles (CL-5). Solo afecta al dibujo. */
const MIN_POINT_GAP = 6;
const gapOk = (a: Point, b: Point) => dist(a, b) >= MIN_POINT_GAP;

/** Descarta (solo para dibujar) los puntos demasiado cerca del anterior o del extremo final. */
function regularize(a: Point, points: Point[], b: Point): Point[] {
  const kept: Point[] = [];
  let prev = a;
  for (const p of points) if (gapOk(prev, p) && gapOk(p, b)) { kept.push(p); prev = p; }
  return kept;
}

/** Controles Bézier de un tramo P1→P2 de una spline de Catmull-Rom centrípeta (α = 0,5), con P0 y P3 como vecinos. */
function centripetal(p0: Point, p1: Point, p2: Point, p3: Point): { c1: Point; c2: Point } {
  const d1 = Math.sqrt(dist(p0, p1)), d2 = Math.sqrt(dist(p1, p2)), d3 = Math.sqrt(dist(p2, p3));
  const d1s = d1 * d1, d2s = d2 * d2, d3s = d3 * d3;
  const k1 = 3 * d1 * (d1 + d2), k2 = 3 * d3 * (d3 + d2);
  const c1 = k1 === 0 ? { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 }
    : { x: (d1s * p2.x - d2s * p0.x + (2 * d1s + 3 * d1 * d2 + d2s) * p1.x) / k1, y: (d1s * p2.y - d2s * p0.y + (2 * d1s + 3 * d1 * d2 + d2s) * p1.y) / k1 };
  const c2 = k2 === 0 ? { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 }
    : { x: (d3s * p1.x - d2s * p3.x + (2 * d3s + 3 * d3 * d2 + d2s) * p2.x) / k2, y: (d3s * p1.y - d2s * p3.y + (2 * d3s + 3 * d3 * d2 + d2s) * p2.y) / k2 };
  return { c1, c2 };
}

/**
 * Curva suave y continua (sin tramos rectos ni esquinas) que pasa por `points` en orden. Los extremos salen y llegan con la dirección
 * `startDir` / `endDir` (la del anclaje, o hacia el punto vecino si el extremo es libre). Sin puntos útiles equivale a `curvedCmds`.
 */
export function curvedThroughCmds(a: Point, startDir: Point, points: Point[], b: Point, endDir: Point, curvature?: number): PathCmd[] {
  const mid = regularize(a, points, b);
  if (mid.length === 0) return curvedCmds(a, startDir, b, endDir, curvature);
  const P = [a, ...mid, b];
  const mirror = (p: Point, q: Point): Point => ({ x: 2 * p.x - q.x, y: 2 * p.y - q.y });
  const cmds: PathCmd[] = [{ t: "M", p: a }];
  for (let i = 0; i < P.length - 1; i++) {
    const p0 = i === 0 ? mirror(P[0]!, P[1]!) : P[i - 1]!, p1 = P[i]!, p2 = P[i + 1]!, p3 = i + 2 < P.length ? P[i + 2]! : mirror(P[P.length - 1]!, P[P.length - 2]!);
    let { c1, c2 } = centripetal(p0, p1, p2, p3);
    // La tangente de cada extremo la fija el anclaje (RF-8, tercera viñeta): el tramo sale/llega en su dirección.
    if (i === 0) { const k = dist(p1, p2) / 3; c1 = { x: a.x + startDir.x * k, y: a.y + startDir.y * k }; }
    if (i === P.length - 2) { const k = dist(p1, p2) / 3; c2 = { x: b.x + endDir.x * k, y: b.y + endDir.y * k }; }
    cmds.push({ t: "C", c1, c2, p: p2 });
  }
  return cmds;
}
