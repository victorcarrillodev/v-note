// Acomodo a la cuadrícula (plan 004, §7.1): funciones puras, sin DOM ni React.
import type { Box, Point } from "./geometry";

/** Separación de la cuadrícula, en unidades del lienzo (la misma que dibuja el diagrama). */
export const GRID = 20;

/** Evita el cero negativo, que se vería distinto al comparar o serializar. */
const noNegZero = (v: number): number => (v === 0 ? 0 : v);

/** Acomoda un valor al múltiplo más cercano de la cuadrícula (las medias suben). Un valor no finito se devuelve igual. */
export function snap(value: number, grid: number = GRID): number {
  if (!Number.isFinite(value)) return value;
  return noNegZero(Math.round(value / grid) * grid);
}

export const snapPoint = (p: Point, grid: number = GRID): Point => ({ x: snap(p.x, grid), y: snap(p.y, grid) });

/**
 * Acomoda una caja: esquina superior izquierda y bordes derecho e inferior a la cuadrícula. El tamaño nunca baja del mínimo:
 * si el mínimo no es múltiplo de la cuadrícula, se sube al siguiente múltiplo (CL-16).
 */
export function snapBox(box: Box, min: { w: number; h: number }, grid: number = GRID): Box {
  const x = snap(box.x, grid), y = snap(box.y, grid);
  const minW = Math.ceil(min.w / grid) * grid, minH = Math.ceil(min.h / grid) * grid;
  const w = Math.max(minW, snap(box.x + box.w, grid) - x), h = Math.max(minH, snap(box.y + box.h, grid) - y);
  return { x, y, w, h };
}

/**
 * Desplazamiento (`off`) que deja la posición efectiva deseada exactamente en un punto de la cuadrícula.
 * `base` es la posición sin ese desplazamiento: la distribución automática más los desplazamientos de los ancestros.
 */
export function snapOffset(desired: Point, base: Point, grid: number = GRID): Point {
  const target = snapPoint(desired, grid);
  return { x: noNegZero(target.x - base.x), y: noNegZero(target.y - base.y) };
}
