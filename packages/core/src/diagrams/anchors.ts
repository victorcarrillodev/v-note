// Anclajes de las formas (plan 003, §5): ocho puntos con nombre sobre el contorno real de cada forma.
import type { Point } from "./geometry";
import { dist } from "./geometry";

export const SHAPES = ["terminator", "process", "decision", "io", "note"] as const;
export type Shape = (typeof SHAPES)[number];

export const ANCHORS = ["n", "ne", "e", "se", "s", "sw", "w", "nw"] as const;
export type Anchor = (typeof ANCHORS)[number];
export const isAnchor = (v: unknown): v is Anchor => typeof v === "string" && (ANCHORS as readonly string[]).includes(v);

export type ShapeBox = { shape: Shape; x: number; y: number; w: number; h: number };

const TAN15 = Math.tan((15 * Math.PI) / 180);
/** Desplazamiento horizontal del paralelogramo de entrada/salida (inclinación de 15°). */
const slant = (b: ShapeBox) => b.h * TAN15;

/** Radio de las esquinas redondeadas del terminador: la mitad del lado menor (como `border-radius` extremo en CSS). */
const capRadius = (b: ShapeBox) => Math.min(b.h / 2, b.w / 2);

export function anchorPosition(b: ShapeBox, a: Anchor): Point {
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2, r = b.x + b.w, bt = b.y + b.h;
  switch (b.shape) {
    case "decision": {
      const q = { x: b.w / 4, y: b.h / 4 };
      return { n: { x: cx, y: b.y }, e: { x: r, y: cy }, s: { x: cx, y: bt }, w: { x: b.x, y: cy },
        ne: { x: cx + q.x, y: cy - q.y }, se: { x: cx + q.x, y: cy + q.y }, sw: { x: cx - q.x, y: cy + q.y }, nw: { x: cx - q.x, y: cy - q.y } }[a];
    }
    case "io": {
      const s = slant(b);
      return { nw: { x: b.x + s, y: b.y }, ne: { x: r, y: b.y }, se: { x: r - s, y: bt }, sw: { x: b.x, y: bt },
        n: { x: cx + s / 2, y: b.y }, s: { x: cx - s / 2, y: bt }, e: { x: r - s / 2, y: cy }, w: { x: b.x + s / 2, y: cy } }[a];
    }
    case "terminator": {
      const rad = capRadius(b), k = rad * Math.SQRT1_2;
      return { n: { x: cx, y: b.y }, e: { x: r, y: cy }, s: { x: cx, y: bt }, w: { x: b.x, y: cy },
        ne: { x: r - rad + k, y: b.y + rad - k }, se: { x: r - rad + k, y: bt - rad + k }, sw: { x: b.x + rad - k, y: bt - rad + k }, nw: { x: b.x + rad - k, y: b.y + rad - k } }[a];
    }
    default:
      return { n: { x: cx, y: b.y }, ne: { x: r, y: b.y }, e: { x: r, y: cy }, se: { x: r, y: bt }, s: { x: cx, y: bt }, sw: { x: b.x, y: bt }, w: { x: b.x, y: cy }, nw: { x: b.x, y: b.y } }[a];
  }
}

/** Contorno de la forma como polígono (el terminador, de esquinas redondeadas, se aproxima con 17 puntos por esquina). Sirve para pruebas y para recortar trazos. */
export function anchorOutline(b: ShapeBox): Point[] {
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2, r = b.x + b.w, bt = b.y + b.h;
  switch (b.shape) {
    case "decision": return [{ x: cx, y: b.y }, { x: r, y: cy }, { x: cx, y: bt }, { x: b.x, y: cy }];
    case "io": { const s = slant(b); return [{ x: b.x + s, y: b.y }, { x: r, y: b.y }, { x: r - s, y: bt }, { x: b.x, y: bt }]; }
    case "terminator": {
      const rad = capRadius(b), pts: Point[] = [];
      // Cuatro esquinas redondeadas recorridas en sentido horario: arriba-derecha, abajo-derecha, abajo-izquierda, arriba-izquierda.
      const corners: [number, number, number][] = [[r - rad, b.y + rad, -Math.PI / 2], [r - rad, bt - rad, 0], [b.x + rad, bt - rad, Math.PI / 2], [b.x + rad, b.y + rad, Math.PI]];
      for (const [ox, oy, start] of corners) for (let i = 0; i <= 16; i++) { const t = start + (Math.PI / 2) * (i / 16); pts.push({ x: ox + rad * Math.cos(t), y: oy + rad * Math.sin(t) }); }
      return pts;
    }
    default: return [{ x: b.x, y: b.y }, { x: r, y: b.y }, { x: r, y: bt }, { x: b.x, y: bt }];
  }
}

/**
 * Dirección en que sale un conector de un anclaje (hacia afuera de la forma).
 * Las esquinas usan el eje dominante según dónde está el otro extremo (horizontal si empatan o si no hay referencia).
 * `toward` es la posición RELATIVA al anclaje.
 */
export function anchorDirection(a: Anchor, toward?: Point): Point {
  switch (a) {
    case "n": return { x: 0, y: -1 };
    case "e": return { x: 1, y: 0 };
    case "s": return { x: 0, y: 1 };
    case "w": return { x: -1, y: 0 };
    default: {
      const sx = a.includes("e") ? 1 : -1, sy = a.includes("s") ? 1 : -1;
      if (toward && Math.abs(toward.y) > Math.abs(toward.x)) return { x: 0, y: sy };
      return { x: sx, y: 0 };
    }
  }
}

/**
 * Anclaje más cercano a un punto dentro de un radio (en unidades del lienzo). Con empate gana la forma que se dibuja encima
 * (la última de la lista). `excludeNode` descarta una forma entera.
 */
export function nearestAnchor<T extends ShapeBox & { id: string }>(shapes: T[], p: Point, radius: number, excludeNode?: string): { node: string; anchor: Anchor; distance: number } | null {
  let best: { node: string; anchor: Anchor; distance: number } | null = null;
  for (const s of shapes) {
    if (s.id === excludeNode) continue;
    for (const a of ANCHORS) {
      const d = dist(p, anchorPosition(s, a));
      if (d <= radius && (best === null || d <= best.distance + 1e-9)) best = { node: s.id, anchor: a, distance: d };
    }
  }
  return best;
}

/** Radio del imán en unidades del lienzo: 16 px de pantalla (24 px con puntero grueso) divididos entre el zoom. */
export function magnetRadius(zoom: number, coarsePointer = false): number {
  const z = Number.isFinite(zoom) && zoom > 0 ? zoom : 1;
  return (coarsePointer ? 24 : 16) / z;
}
