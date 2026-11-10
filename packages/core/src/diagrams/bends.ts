// Puntos de quiebre de los conectores (spec 004, RF-6 y RF-7; plan §8.1): proyectar un clic sobre el trazado, agregar y quitar puntos.
import { appError, err, ok, type Result } from "../result";
import type { DEdge, Diagram } from "./diagram";
import { dist, type Point } from "./geometry";
import { connectorPath, pointAtPath, samplePath, type ConnectorPath } from "./path";

/** Distancia mínima entre un punto de quiebre y los extremos del conector (CL-4). */
export const MIN_BEND_GAP = 12;

/** Puntos de quiebre editables de un conector: los de paso en 90° (`waypoints`) y los de control en curvo y libre (`points`). */
export function bendsOf(e: DEdge): Point[] {
  if (e.route === "orthogonal") return e.waypoints ?? [];
  if (e.route === "curved" || e.route === "free") return e.points ?? [];
  return [];
}

export type PathHit = { point: Point; /** distancia del clic al trazado */ distance: number; /** posición sobre el trazado, 0–1 de su longitud */ t: number };

/** Punto del trazado más cercano a `p`, su distancia y su posición (fracción de la longitud). */
export function nearestOnPath(path: ConnectorPath, p: Point): PathHit {
  const pts = [path.start, ...samplePath(path)];
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1]! + dist(pts[i - 1]!, pts[i]!));
  const total = cum[cum.length - 1]!;
  let best: PathHit = { point: pts[0]!, distance: dist(p, pts[0]!), t: 0 };
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i]!, b = pts[i + 1]!, dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy;
    const k = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2));
    const q = { x: a.x + k * dx, y: a.y + k * dy }, d = dist(p, q);
    if (d < best.distance - 1e-9) best = { point: q, distance: d, t: total === 0 ? 0 : (cum[i]! + k * Math.sqrt(l2)) / total };
  }
  return best;
}

const bad = (message: string, reason: string) => err(appError("INVALID", message, { reason }));
const finite = (p: Point) => Number.isFinite(p.x) && Number.isFinite(p.y);
const replace = (d: Diagram, e: DEdge): Diagram => ({ ...d, edges: d.edges.map((x) => (x.id === e.id ? e : x)) });

/**
 * Agrega un punto de quiebre sobre el trazado, en el lugar del clic proyectado, en la posición que le toca de la lista (según el recorrido).
 * Muy cerca de un extremo se separa `MIN_BEND_GAP` del anclaje. En trazado recto el conector pasa a libre (poligonal) con el punto.
 * `snap` acomoda el punto a la cuadrícula al final.
 */
export function addBendAt(d: Diagram, edgeId: string, point: Point, opts: { snap?: (p: Point) => Point; gap?: number } = {}): Result<Diagram> {
  const e = d.edges.find((x) => x.id === edgeId);
  if (!e) return err(appError("NOT_FOUND", "El conector no existe", { id: edgeId }));
  if (!finite(point)) return bad("El punto no es válido", "POINT");
  const path = connectorPath(d, e);
  if (!path) return err(appError("NOT_FOUND", "El conector apunta a una forma que ya no existe", { id: edgeId }));
  const gap = opts.gap ?? MIN_BEND_GAP;
  if (path.length < 2 * gap) return bad("El conector es demasiado corto para agregarle un punto", "SHORT");
  const hit = nearestOnPath(path, point);
  const t = Math.min(1 - gap / path.length, Math.max(gap / path.length, hit.t));
  let p = t === hit.t ? hit.point : pointAtPath(path, t);
  if (opts.snap) p = opts.snap(p);
  const existing = bendsOf(e);
  const index = existing.filter((b) => nearestOnPath(path, b).t < t).length;
  const put = (list: Point[]) => [...list.slice(0, index), { x: p.x, y: p.y }, ...list.slice(index)];
  if (e.route === "orthogonal") return ok(replace(d, { ...e, waypoints: put(existing) }));
  if (e.route === "straight") return ok(replace(d, { ...e, route: "free", points: [{ x: p.x, y: p.y }] }));
  return ok(replace(d, { ...e, points: put(existing) }));
}

/** Quita un punto de quiebre. Sin puntos, el conector queda directo según su trazado (no se deja una lista vacía). */
export function removeBend(d: Diagram, edgeId: string, index: number): Result<Diagram> {
  const e = d.edges.find((x) => x.id === edgeId);
  if (!e) return err(appError("NOT_FOUND", "El conector no existe", { id: edgeId }));
  if (e.route === "straight") return bad("El trazado recto no tiene puntos de quiebre", "ROUTE");
  const list = bendsOf(e);
  if (!Number.isInteger(index) || index < 0 || index >= list.length) return bad("El punto de quiebre no existe", "INDEX");
  const next = list.filter((_, i) => i !== index);
  const key = e.route === "orthogonal" ? "waypoints" : "points";
  const { [key]: _drop, ...rest } = e as DEdge & Record<string, unknown>;
  void _drop;
  return ok(replace(d, (next.length > 0 ? { ...rest, [key]: next } : rest) as DEdge));
}

/** Mueve un punto de quiebre (en 90° es un punto de paso; en curvo y libre, un punto de control). */
export function moveBend(d: Diagram, edgeId: string, index: number, point: Point): Result<Diagram> {
  const e = d.edges.find((x) => x.id === edgeId);
  if (!e) return err(appError("NOT_FOUND", "El conector no existe", { id: edgeId }));
  if (e.route === "straight") return bad("El trazado recto no tiene puntos de quiebre", "ROUTE");
  if (!finite(point)) return bad("El punto no es válido", "POINT");
  const list = bendsOf(e);
  if (!Number.isInteger(index) || index < 0 || index >= list.length) return bad("El punto de quiebre no existe", "INDEX");
  const next = list.map((q, i) => (i === index ? { x: point.x, y: point.y } : q));
  return ok(replace(d, e.route === "orthogonal" ? { ...e, waypoints: next } : { ...e, points: next }));
}
