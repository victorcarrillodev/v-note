// Geometría pura de los diagramas (plan 003, §5 y §6): puntos, cajas y segmentos. Sin DOM ni React.
export type Point = { x: number; y: number };
export type Box = { x: number; y: number; w: number; h: number };

const EPS = 1e-9;

export const dist = (a: Point, b: Point): number => Math.hypot(b.x - a.x, b.y - a.y);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const pointOnSegment = (a: Point, b: Point, t: number): Point => ({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) });
/** Longitud de una poligonal. */
export const segmentLength = (pts: Point[]): number => pts.slice(1).reduce((sum, p, i) => sum + dist(pts[i]!, p), 0);

export const inflate = (b: Box, by: number): Box => ({ x: b.x - by, y: b.y - by, w: b.w + 2 * by, h: b.h + 2 * by });
export const boxContains = (b: Box, p: Point): boolean => p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h;
const boxCorners = (b: Box): Point[] => [{ x: b.x, y: b.y }, { x: b.x + b.w, y: b.y }, { x: b.x + b.w, y: b.y + b.h }, { x: b.x, y: b.y + b.h }];

/** Intersección de dos segmentos (a→b y c→d); `null` si son paralelos o no se cortan. */
function segmentsIntersect(a: Point, b: Point, c: Point, d: Point): { point: Point; t: number } | null {
  const r = { x: b.x - a.x, y: b.y - a.y }, s = { x: d.x - c.x, y: d.y - c.y };
  const denom = r.x * s.y - r.y * s.x;
  if (Math.abs(denom) < EPS) return null;
  const t = ((c.x - a.x) * s.y - (c.y - a.y) * s.x) / denom;
  const u = ((c.x - a.x) * r.y - (c.y - a.y) * r.x) / denom;
  if (t < -EPS || t > 1 + EPS || u < -EPS || u > 1 + EPS) return null;
  return { point: { x: a.x + t * r.x, y: a.y + t * r.y }, t };
}

const dedupe = (hits: { point: Point; t: number }[]): Point[] => {
  hits.sort((p, q) => p.t - q.t);
  const out: { point: Point; t: number }[] = [];
  for (const h of hits) if (!out.some((o) => Math.abs(o.point.x - h.point.x) < 1e-7 && Math.abs(o.point.y - h.point.y) < 1e-7)) out.push(h);
  return out.map((h) => h.point);
};

/** Puntos donde el segmento a→b corta el contorno de un polígono cerrado, ordenados desde `a`. */
export function segmentPolygonIntersections(a: Point, b: Point, poly: Point[]): Point[] {
  const hits: { point: Point; t: number }[] = [];
  for (let i = 0; i < poly.length; i++) {
    const h = segmentsIntersect(a, b, poly[i]!, poly[(i + 1) % poly.length]!);
    if (h) hits.push(h);
  }
  return dedupe(hits);
}
export const segmentBoxIntersections = (a: Point, b: Point, box: Box): Point[] => segmentPolygonIntersections(a, b, boxCorners(box));

/** ¿El segmento entra en el interior (abierto) de la caja? Rozar o correr por el borde no cuenta. */
export function segmentCrossesBoxInterior(a: Point, b: Point, box: Box): boolean {
  // Recorte de Liang–Barsky contra la caja encogida una pizca: si queda un tramo de longitud > 0, hay interior.
  const x0 = box.x + EPS, x1 = box.x + box.w - EPS, y0 = box.y + EPS, y1 = box.y + box.h - EPS;
  if (x1 <= x0 || y1 <= y0) return false;
  const dx = b.x - a.x, dy = b.y - a.y;
  let t0 = 0, t1 = 1;
  for (const [p, q] of [[-dx, a.x - x0], [dx, x1 - a.x], [-dy, a.y - y0], [dy, y1 - a.y]] as [number, number][]) {
    if (Math.abs(p) < EPS) { if (q < 0) return false; continue; }
    const r = q / p;
    if (p < 0) { if (r > t1) return false; if (r > t0) t0 = r; } else { if (r < t0) return false; if (r < t1) t1 = r; }
  }
  return t1 - t0 > 1e-9 || (t0 === t1 && false);
}
