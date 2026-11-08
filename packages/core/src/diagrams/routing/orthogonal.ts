// Trazado de ángulos de 90° (plan 003, §6.2): A* sobre una rejilla comprimida con coste = longitud + 20 por giro.
// Solo tramos horizontales y verticales; no cruza las formas unidas; determinista.
import { inflate, segmentCrossesBoxInterior, type Box, type Point } from "../geometry";

const STUB = 16, MARGIN = 12, BEND = 20, PIN_CLEARANCE = 0;
const DIRS: Point[] = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }]; // E, O, S, N
const OPPOSITE = [1, 0, 3, 2];
const dirIndex = (d: Point): number => (d.x > 0 ? 0 : d.x < 0 ? 1 : d.y > 0 ? 2 : 3);
const same = (a: Point, b: Point) => Math.abs(a.x - b.x) < 1e-9 && Math.abs(a.y - b.y) < 1e-9;
const finite = (p: Point) => Number.isFinite(p.x) && Number.isFinite(p.y);
const strictlyInside = (b: Box, p: Point) => p.x > b.x + PIN_CLEARANCE && p.x < b.x + b.w - PIN_CLEARANCE && p.y > b.y + PIN_CLEARANCE && p.y < b.y + b.h - PIN_CLEARANCE;

/** Largo del tramo corto al salir de un anclaje: 16 si hay espacio, o la mitad del hueco si otra forma está tan cerca que no cabe. */
export function clearStub(from: Point, dir: Point, obstacles: Box[]): number {
  let len = STUB;
  for (const b of obstacles) {
    // Distancia hasta que el rayo entra en la caja (método de losas); si el punto ya está en el borde o dentro, esa caja no cuenta.
    let tMin = -Infinity, tMax = Infinity;
    for (const [o, d, lo, hi] of [[from.x, dir.x, b.x, b.x + b.w], [from.y, dir.y, b.y, b.y + b.h]] as [number, number, number, number][]) {
      if (Math.abs(d) < 1e-12) { if (o < lo || o > hi) { tMin = Infinity; tMax = -Infinity; } continue; }
      const t1 = (lo - o) / d, t2 = (hi - o) / d;
      tMin = Math.max(tMin, Math.min(t1, t2)); tMax = Math.min(tMax, Math.max(t1, t2));
    }
    if (tMin <= tMax && tMin > 1e-9) len = Math.min(len, tMin / 2);
  }
  return len;
}

/** Quita los puntos de paso no finitos o que quedarían dentro de una de las formas unidas; el resto se conserva en orden. */
export const validWaypoints = (waypoints: Point[], obstacles: Box[]): Point[] => waypoints.filter((p) => finite(p) && !obstacles.some((b) => strictlyInside(b, p)));

type Node = { i: number; j: number; d: number; g: number; f: number; n: number };

/** A* entre dos puntos de la rejilla. `fromDir`: dirección con que se llega al punto de partida (o -1); `toDir`: dirección con que debe llegar al final (o -1). */
function search(from: Point, fromDir: number, to: Point, toDir: number, obstacles: Box[]): { points: Point[]; lastDir: number } | null {
  if (same(from, to)) return { points: [from], lastDir: fromDir };
  const xs = new Set<number>([from.x, to.x, (from.x + to.x) / 2]), ys = new Set<number>([from.y, to.y, (from.y + to.y) / 2]);
  for (const b of obstacles) { xs.add(b.x); xs.add(b.x + b.w); ys.add(b.y); ys.add(b.y + b.h); }
  const X = [...xs].sort((p, q) => p - q), Y = [...ys].sort((p, q) => p - q);
  const si = X.indexOf(from.x), sj = Y.indexOf(from.y), ti = X.indexOf(to.x), tj = Y.indexOf(to.y);
  const best = new Map<string, number>(), prev = new Map<string, string>();
  const key = (i: number, j: number, d: number) => `${i},${j},${d}`;
  const open: Node[] = [{ i: si, j: sj, d: fromDir, g: 0, f: 0, n: 0 }];
  best.set(key(si, sj, fromDir), 0);
  let counter = 0;
  const h = (i: number, j: number) => Math.abs(X[i]! - to.x) + Math.abs(Y[j]! - to.y);
  while (open.length > 0) {
    // Menor f; desempate por menor h y luego por orden de inserción: así el resultado es siempre el mismo.
    let bi = 0;
    for (let k = 1; k < open.length; k++) { const a = open[k]!, b = open[bi]!; if (a.f < b.f - 1e-9 || (Math.abs(a.f - b.f) <= 1e-9 && (a.n < b.n))) bi = k; }
    const cur = open.splice(bi, 1)[0]!;
    const ck = key(cur.i, cur.j, cur.d);
    if ((best.get(ck) ?? Infinity) < cur.g - 1e-9) continue;
    if (cur.i === ti && cur.j === tj) {
      // Llegar con otra dirección ya se penalizó al entrar (un giro más en el punto final): la primera vez que se saca el destino es la mejor ruta.
      const pts: Point[] = []; let k: string | undefined = ck;
      while (k !== undefined) { const [i, j] = k.split(",").map(Number) as [number, number, number]; pts.push({ x: X[i]!, y: Y[j]! }); k = prev.get(k); }
      return { points: pts.reverse(), lastDir: cur.d };
    }
    for (let d = 0; d < 4; d++) {
      const ni = cur.i + (d === 0 ? 1 : d === 1 ? -1 : 0), nj = cur.j + (d === 2 ? 1 : d === 3 ? -1 : 0);
      if (ni < 0 || nj < 0 || ni >= X.length || nj >= Y.length) continue;
      if (cur.d >= 0 && d === OPPOSITE[cur.d]) continue; // no se da media vuelta
      const a = { x: X[cur.i]!, y: Y[cur.j]! }, b = { x: X[ni]!, y: Y[nj]! };
      if (obstacles.some((o) => segmentCrossesBoxInterior(a, b, o))) continue;
      // Desempate estético (menos de 1 en total): entre rutas igual de cortas y con los mismos giros, gana la que cruza por el centro.
      const centered = d >= 2 ? Math.abs(a.x - (from.x + to.x) / 2) : Math.abs(a.y - (from.y + to.y) / 2);
      const g = cur.g + Math.abs(b.x - a.x) + Math.abs(b.y - a.y) + centered * 1e-4 + (cur.d >= 0 && cur.d !== d ? BEND : 0)
        + (ni === ti && nj === tj && toDir >= 0 && d !== toDir ? BEND : 0);
      const nk = key(ni, nj, d);
      if (g >= (best.get(nk) ?? Infinity) - 1e-9) continue;
      best.set(nk, g); prev.set(nk, ck);
      open.push({ i: ni, j: nj, d, g, f: g + h(ni, nj), n: ++counter });
    }
  }
  return null;
}

/** Quita puntos repetidos y los que quedan en medio de dos tramos alineados. */
function simplify(pts: Point[]): Point[] {
  const out: Point[] = [];
  for (const p of pts) {
    if (out.length > 0 && same(out[out.length - 1]!, p)) continue;
    out.push(p);
    while (out.length >= 3) {
      const a = out[out.length - 3]!, b = out[out.length - 2]!, c = out[out.length - 1]!;
      // Solo se quita el punto del medio si los tres siguen la misma dirección (si hay media vuelta, el tramo de ida y vuelta se conserva).
      const straight = (a.x === b.x && b.x === c.x && (b.y - a.y) * (c.y - b.y) > 0) || (a.y === b.y && b.y === c.y && (b.x - a.x) * (c.x - b.x) > 0);
      if (straight) out.splice(out.length - 2, 1); else break;
    }
  }
  return out;
}

const unionBox = (bs: Box[]): Box => {
  const x0 = Math.min(...bs.map((b) => b.x)), y0 = Math.min(...bs.map((b) => b.y)), x1 = Math.max(...bs.map((b) => b.x + b.w)), y1 = Math.max(...bs.map((b) => b.y + b.h));
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
};

/** Último recurso: rodea ambas formas por un anillo exterior (la «U»). Siempre es ortogonal y termina en los puntos pedidos. */
function ringRoute(start: Point, startDir: number, end: Point, endDir: number, obstacles: Box[]): Point[] {
  const ring = inflate(unionBox(obstacles.length > 0 ? obstacles : [{ x: start.x, y: start.y, w: end.x - start.x, h: end.y - start.y }]), 24);
  const L = ring.x, R = ring.x + ring.w, T = ring.y, B = ring.y + ring.h;
  const toRing = (p: Point, d: number): Point => {
    if (d === 0) return { x: R, y: p.y }; if (d === 1) return { x: L, y: p.y }; if (d === 2) return { x: p.x, y: B }; if (d === 3) return { x: p.x, y: T };
    const gaps = [R - p.x, p.x - L, B - p.y, p.y - T]; return toRing(p, gaps.indexOf(Math.min(...gaps)));
  };
  const clamp = (p: Point): Point => ({ x: Math.min(R, Math.max(L, p.x)), y: Math.min(B, Math.max(T, p.y)) });
  const sa = clamp(toRing(start, startDir)), sb = clamp(toRing(end, endDir));
  // Posición sobre el perímetro del anillo, en sentido horario desde la esquina superior izquierda.
  const per = (p: Point): number => (p.y === T ? p.x - L : p.x === R ? ring.w + (p.y - T) : p.y === B ? ring.w + ring.h + (R - p.x) : 2 * ring.w + ring.h + (B - p.y));
  const corners: [number, Point][] = [[0, { x: L, y: T }], [ring.w, { x: R, y: T }], [ring.w + ring.h, { x: R, y: B }], [2 * ring.w + ring.h, { x: L, y: B }]];
  const total = 2 * (ring.w + ring.h), a = per(sa), b = per(sb);
  const cw = (b - a + total) % total, ccw = (a - b + total) % total;
  const walk: Point[] = [];
  if (cw <= ccw) for (let k = 0; k < 8; k++) { const [pos, c] = corners[k % 4]!; const at = pos + Math.floor(k / 4) * total; if (at > a + 1e-9 && at < a + cw - 1e-9) walk.push(c); }
  else for (let k = 8; k >= 0; k--) { const [pos, c] = corners[k % 4]!; const at = pos + Math.floor(k / 4) * total; if (at < a - 1e-9 && at > a - ccw + 1e-9) walk.push(c); }
  return simplify([start, sa, ...walk, sb, end]);
}

export type OrthogonalInput = {
  start: Point; startDir: Point | null; end: Point; endDir: Point | null;
  /** Cajas de las formas unidas (las dos, o una, o ninguna si ambos extremos son libres). */
  obstacles: Box[]; waypoints?: Point[];
};

// Memoria de rutas: mover una forma solo cambia las rutas de sus conectores; el resto se reutiliza (RNF-1). Acotada para no crecer sin fin.
export const ROUTE_CACHE_MAX = 2000;
const cache = new Map<string, Point[]>();
export const routeCacheSize = (): number => cache.size;
export const clearRouteCache = (): void => cache.clear();
const keyOf = (o: OrthogonalInput): string => {
  const p = (q: Point | null) => (q ? `${q.x},${q.y}` : "-");
  return [p(o.start), p(o.startDir), p(o.end), p(o.endDir), o.obstacles.map((b) => `${b.x},${b.y},${b.w},${b.h}`).join(";"), (o.waypoints ?? []).map(p).join(";")].join("|");
};

/** Ruta de 90°: lista de puntos con tramos solo horizontales y verticales, del inicio al final. */
export function orthogonalRoute(o: OrthogonalInput): Point[] {
  const key = keyOf(o);
  const hit = cache.get(key);
  if (hit) return hit.map((q) => ({ ...q }));
  const route = computeRoute(o);
  if (cache.size >= ROUTE_CACHE_MAX) cache.delete(cache.keys().next().value as string); // sale la más antigua
  cache.set(key, route.map((q) => ({ ...q })));
  return route;
}

function computeRoute(o: OrthogonalInput): Point[] {
  const sd = o.startDir ? dirIndex(o.startDir) : -1, ed = o.endDir ? dirIndex(o.endDir) : -1;
  const stubA = sd >= 0 ? clearStub(o.start, DIRS[sd]!, o.obstacles) : 0, stubB = ed >= 0 ? clearStub(o.end, DIRS[ed]!, o.obstacles) : 0;
  const sa = sd >= 0 ? { x: o.start.x + DIRS[sd]!.x * stubA, y: o.start.y + DIRS[sd]!.y * stubA } : o.start;
  const sb = ed >= 0 ? { x: o.end.x + DIRS[ed]!.x * stubB, y: o.end.y + DIRS[ed]!.y * stubB } : o.end;
  const pins = validWaypoints(o.waypoints ?? [], o.obstacles);
  const chain = [sa, ...pins, sb];
  for (const margin of [MARGIN, 0]) {
    const obst = o.obstacles.map((b) => inflate(b, margin));
    const pts: Point[] = [o.start, sa];
    let dir = sd, ok = true;
    for (let k = 0; k < chain.length - 1 && ok; k++) {
      const lastHop = k === chain.length - 2;
      const hop = search(chain[k]!, dir, chain[k + 1]!, lastHop && ed >= 0 ? OPPOSITE[ed]! : -1, obst);
      if (!hop) { ok = false; break; }
      pts.push(...hop.points.slice(1)); dir = hop.lastDir;
    }
    if (ok) return simplify([...pts, o.end]);
  }
  return ringRoute(o.start, sd, o.end, ed, o.obstacles);
}

/**
 * Convierte el arrastre de un tramo en puntos de paso. `segment` es el índice del tramo (de route[segment] a route[segment+1]).
 * Un tramo horizontal solo se mueve en y y uno vertical solo en x. Si ya pasa por un punto de paso, se mueve ese; si no, se añade uno nuevo
 * en el orden en que la ruta lo recorre.
 */
export function routeWithPin(route: Point[], segment: number, pointer: Point, waypoints: Point[]): Point[] {
  const a = route[segment], b = route[segment + 1];
  if (!a || !b) return waypoints;
  const horizontal = a.y === b.y;
  const onSegment = (p: Point) => (horizontal ? p.y === a.y && p.x >= Math.min(a.x, b.x) && p.x <= Math.max(a.x, b.x) : p.x === a.x && p.y >= Math.min(a.y, b.y) && p.y <= Math.max(a.y, b.y));
  const at = waypoints.findIndex(onSegment);
  if (at >= 0) return waypoints.map((p, i) => (i === at ? (horizontal ? { x: p.x, y: pointer.y } : { x: pointer.x, y: p.y }) : p));
  const pin = horizontal ? { x: (a.x + b.x) / 2, y: pointer.y } : { x: pointer.x, y: (a.y + b.y) / 2 };
  // Índice de tramo por el que pasa cada punto de paso actual: el nuevo va después de los que están en tramos anteriores.
  const segOf = (p: Point) => { for (let i = 0; i < route.length - 1; i++) { const s = route[i]!, e = route[i + 1]!; if (s.y === e.y ? p.y === s.y && p.x >= Math.min(s.x, e.x) && p.x <= Math.max(s.x, e.x) : p.x === s.x && p.y >= Math.min(s.y, e.y) && p.y <= Math.max(s.y, e.y)) return i; } return Infinity; };
  const insertAt = waypoints.filter((p) => segOf(p) < segment).length;
  return [...waypoints.slice(0, insertAt), pin, ...waypoints.slice(insertAt)];
}
