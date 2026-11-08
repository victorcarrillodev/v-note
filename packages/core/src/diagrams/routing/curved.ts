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
