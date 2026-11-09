import { appError, err, ok, type Result } from "../result";
import { newId } from "../ids";
import { stableJson } from "../backup/stableJson";
import { ANCHORS, SHAPES, anchorPosition, isAnchor, type Anchor, type Shape } from "./anchors";
import { completeEdgeStyle, completeNodeStyle, CAPS, DASHES, EDGE_WIDTHS, NODE_STROKE_WIDTHS, ROUTES, isColor, isFillColor, type EdgeStyle, type NodeStyle, type Route } from "./style";
import type { Point } from "./geometry";
import { migrateV1 } from "./migrate";
import { readView, writeView, type CanvasView } from "./view";
import { Snapshots } from "./history";

export { SHAPES, ANCHORS, type Shape, type Anchor };
/** Versión del formato del diagrama guardado en el bloque. Sin campo de versión = versión 1 (se migra al leer). */
export const DIAGRAM_VERSION = 2;

/** Extremo de un conector: unido a un anclaje de una forma, o libre en un punto del lienzo. */
export type Attached = { node: string; anchor: Anchor };
export type Endpoint = Attached | Point;
export const isAttached = (e: Endpoint): e is Attached => "node" in e;

export type DNode = { id: string; shape: Shape; x: number; y: number; w: number; h: number; text: string; style: NodeStyle };
export type DEdge = {
  id: string; from: Endpoint; to: Endpoint; route: Route; label: string; style: EdgeStyle;
  waypoints?: Point[]; curvature?: number; points?: Point[]; smooth?: boolean;
};
export type Diagram = { nodes: DNode[]; edges: DEdge[]; view?: CanvasView };

const SIZE: Record<Shape, { w: number; h: number }> = { terminator: { w: 140, h: 50 }, process: { w: 140, h: 60 }, decision: { w: 140, h: 80 }, io: { w: 140, h: 60 }, note: { w: 160, h: 80 } };
const MIN_W = 40, MIN_H = 24;
/** Tamaño mínimo de una forma (también para acomodarla a la cuadrícula). */
export const MIN_SHAPE = { w: MIN_W, h: MIN_H } as const;
const finite = (...n: number[]) => n.every((v) => Number.isFinite(v));

/** Trazado de un conector nuevo (los diagramas anteriores conservan el redondeado con que se dibujaban). */
export const DEFAULT_ROUTE: Route = "orthogonal";

export const emptyDiagram = (): Diagram => ({ nodes: [], edges: [] });

const mapNode = (d: Diagram, id: string, f: (n: DNode) => DNode): Diagram => (d.nodes.some((n) => n.id === id) ? { ...d, nodes: d.nodes.map((n) => (n.id === id ? f(n) : n)) } : d);

export function addNode(d: Diagram, input: { shape: Shape; x: number; y: number; id?: string; text?: string; color?: string; style?: Partial<NodeStyle> | undefined }): { diagram: Diagram; node: DNode } {
  const style = completeNodeStyle(input.shape, { ...input.style, ...(input.color !== undefined ? { fill: input.color } : {}) });
  const node: DNode = { id: input.id ?? newId(), shape: input.shape, x: finite(input.x) ? input.x : 0, y: finite(input.y) ? input.y : 0, ...SIZE[input.shape], text: input.text ?? "", style };
  return { diagram: { ...d, nodes: [...d.nodes, node] }, node };
}
export const moveNode = (d: Diagram, id: string, x: number, y: number): Diagram => (finite(x, y) ? mapNode(d, id, (n) => ({ ...n, x, y })) : d);
export const resizeNode = (d: Diagram, id: string, w: number, h: number): Diagram => (finite(w, h) ? mapNode(d, id, (n) => ({ ...n, w: Math.max(MIN_W, w), h: Math.max(MIN_H, h) })) : d);
export const setNodeText = (d: Diagram, id: string, text: string): Diagram => mapNode(d, id, (n) => ({ ...n, text }));
/** Fija el relleno de la forma (color de paleta, hexadecimal o «none»); un valor inválido se ignora. */
export const setNodeColor = (d: Diagram, id: string, color: string): Diagram => (isFillColor(color) ? mapNode(d, id, (n) => ({ ...n, style: { ...n.style, fill: color } })) : d);

/** Valida un cambio de estilo de forma: solo pasan los campos válidos (lo demás se ignora). */
function validNodePatch(p: Partial<NodeStyle>): Partial<NodeStyle> {
  const o: Partial<NodeStyle> = {};
  if (isFillColor(p.fill)) o.fill = p.fill;
  if (isColor(p.stroke)) o.stroke = p.stroke;
  if (isColor(p.textColor)) o.textColor = p.textColor;
  if (typeof p.fillOpacity === "number" && p.fillOpacity >= 0 && p.fillOpacity <= 1) o.fillOpacity = p.fillOpacity;
  if ((NODE_STROKE_WIDTHS as readonly unknown[]).includes(p.strokeWidth)) o.strokeWidth = p.strokeWidth as NodeStyle["strokeWidth"];
  if ((DASHES as readonly unknown[]).includes(p.strokeDash)) o.strokeDash = p.strokeDash as NodeStyle["strokeDash"];
  return o;
}
/** Cambia el estilo de una o varias formas a la vez (un solo diagrama nuevo: un solo paso de historial). */
export function setNodeStyle(d: Diagram, ids: string[], patch: Partial<NodeStyle>): Diagram {
  const p = validNodePatch(patch), set = new Set(ids);
  if (Object.keys(p).length === 0 || !d.nodes.some((n) => set.has(n.id))) return d;
  return { ...d, nodes: d.nodes.map((n) => (set.has(n.id) ? { ...n, style: { ...n.style, ...p } } : n)) };
}
function validEdgePatch(p: Partial<EdgeStyle>): Partial<EdgeStyle> {
  const o: Partial<EdgeStyle> = {};
  if (isColor(p.color)) o.color = p.color;
  if (isColor(p.textColor)) o.textColor = p.textColor;
  if ((EDGE_WIDTHS as readonly unknown[]).includes(p.width)) o.width = p.width as EdgeStyle["width"];
  if ((DASHES as readonly unknown[]).includes(p.dash)) o.dash = p.dash as EdgeStyle["dash"];
  if ((CAPS as readonly unknown[]).includes(p.startCap)) o.startCap = p.startCap as EdgeStyle["startCap"];
  if ((CAPS as readonly unknown[]).includes(p.endCap)) o.endCap = p.endCap as EdgeStyle["endCap"];
  return o;
}
export function setEdgeStyle(d: Diagram, ids: string[], patch: Partial<EdgeStyle>): Diagram {
  const p = validEdgePatch(patch), set = new Set(ids);
  if (Object.keys(p).length === 0 || !d.edges.some((e) => set.has(e.id))) return d;
  return { ...d, edges: d.edges.map((e) => (set.has(e.id) ? { ...e, style: { ...e.style, ...p } } : e)) };
}

const touches = (e: DEdge, id: string) => (isAttached(e.from) && e.from.node === id) || (isAttached(e.to) && e.to.node === id);

const endPoint = (d: Diagram, e: Endpoint): Point | null => {
  if (!isAttached(e)) return { x: e.x, y: e.y };
  const n = d.nodes.find((x) => x.id === e.node);
  return n ? anchorPosition(n, e.anchor) : null;
};

/**
 * Elimina la forma. Sus conectores NO se pierden: cada extremo que estaba unido a ella queda libre en la última posición de su anclaje
 * (spec 003, RF-4). Devuelve los conectores liberados para poder informarlo.
 */
export function deleteNode(d: Diagram, id: string): { diagram: Diagram; releasedEdges: DEdge[] } {
  const gone = d.nodes.find((n) => n.id === id);
  if (!gone) return { diagram: d, releasedEdges: [] };
  const free = (e: Endpoint): Endpoint => (isAttached(e) && e.node === id ? anchorPosition(gone, e.anchor) : e);
  const released: DEdge[] = [];
  const edges = d.edges.map((e) => {
    if (!touches(e, id)) return e;
    const next = { ...e, from: free(e.from), to: free(e.to) };
    released.push(next);
    return next;
  });
  return { diagram: { ...d, nodes: d.nodes.filter((n) => n.id !== id), edges }, releasedEdges: released };
}

const sameEnd = (a: Endpoint, b: Endpoint) => isAttached(a) && isAttached(b) && a.node === b.node && a.anchor === b.anchor;

const endProblem = (d: Diagram, e: Endpoint) => {
  if (isAttached(e)) return d.nodes.some((n) => n.id === e.node) && isAnchor(e.anchor) ? null : appError("NOT_FOUND", "La forma o el anclaje del conector no existe", { node: e.node });
  return Number.isFinite(e.x) && Number.isFinite(e.y) ? null : appError("INVALID", "El punto del conector no es válido", { reason: "POINT" });
};

/**
 * Crea un conector entre dos extremos: cada uno puede ser un anclaje de una forma o un punto libre del lienzo (spec 003, RF-2 y RF-4).
 * Se rechaza una forma inexistente, el mismo anclaje de la misma forma en los dos extremos y un duplicado exacto.
 */
export function connect(d: Diagram, from: Endpoint, to: Endpoint, opts?: { route?: Route | undefined; style?: EdgeStyle | undefined }): Result<{ diagram: Diagram; edge: DEdge }> {
  const problem = endProblem(d, from) ?? endProblem(d, to);
  if (problem) return err(problem);
  if (sameEnd(from, to)) return err(appError("INVALID", "Los dos extremos del conector no pueden estar en el mismo punto", { reason: "SAME_ANCHOR" }));
  if (isAttached(from) && isAttached(to) && d.edges.some((e) => sameEnd(e.from, from) && sameEnd(e.to, to))) return err(appError("CONFLICT", "Esas dos formas ya están conectadas en ese sentido", { reason: "DUPLICATE" }));
  const edge: DEdge = { id: newId(), from, to, route: opts?.route ?? DEFAULT_ROUTE, label: "", style: completeEdgeStyle(opts?.style) };
  return ok({ diagram: { ...d, edges: [...d.edges, edge] }, edge });
}

/** Crea un conector de las formas indicadas con los puntos de siempre (este → oeste); una forma no se conecta consigo misma sin anclajes explícitos. */
export function addEdge(d: Diagram, from: string, to: string, ends?: { fromAnchor?: Anchor; toAnchor?: Anchor; route?: Route }): Result<{ diagram: Diagram; edge: DEdge }> {
  if (!d.nodes.some((n) => n.id === from) || !d.nodes.some((n) => n.id === to)) return err(appError("NOT_FOUND", "Las dos formas del conector deben existir", { from, to }));
  const explicit = ends?.fromAnchor !== undefined || ends?.toAnchor !== undefined;
  if (from === to && !explicit) return err(appError("INVALID", "Un conector necesita dos formas distintas", { reason: "SELF" }));
  return connect(d, { node: from, anchor: ends?.fromAnchor ?? "e" }, { node: to, anchor: ends?.toAnchor ?? "w" }, { route: ends?.route ?? "curved" });
}

type End = "from" | "to";
const withEdge = (d: Diagram, id: string, f: (e: DEdge) => Result<DEdge>): Result<Diagram> => {
  const e = d.edges.find((x) => x.id === id);
  if (!e) return err(appError("NOT_FOUND", "El conector no existe", { id }));
  const r = f(e);
  return r.ok ? ok({ ...d, edges: d.edges.map((x) => (x.id === id ? r.value : x)) }) : r;
};

/** Mueve un extremo a otro anclaje (de la misma forma o de otra) o a un punto libre; el otro extremo no cambia. */
export function reconnectEnd(d: Diagram, edgeId: string, end: End, target: Endpoint): Result<Diagram> {
  return withEdge(d, edgeId, (e) => {
    const problem = endProblem(d, target);
    if (problem) return err(problem);
    if (sameEnd(target, end === "from" ? e.to : e.from)) return err(appError("INVALID", "Los dos extremos del conector no pueden estar en el mismo punto", { reason: "SAME_ANCHOR" }));
    return ok({ ...e, [end]: target });
  });
}
/** Despega un extremo: queda libre en la posición actual de su anclaje. */
export function detachEnd(d: Diagram, edgeId: string, end: End): Result<Diagram> {
  return withEdge(d, edgeId, (e) => {
    const at = endPoint(d, e[end]);
    return at ? ok({ ...e, [end]: at }) : err(appError("NOT_FOUND", "La forma del extremo no existe", { id: edgeId }));
  });
}
/** Mueve el punto de un extremo que ya es libre. */
export function moveFreeEnd(d: Diagram, edgeId: string, end: End, point: Point): Result<Diagram> {
  return withEdge(d, edgeId, (e) => {
    if (isAttached(e[end])) return err(appError("INVALID", "El extremo está unido a una forma", { reason: "ATTACHED" }));
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return err(appError("INVALID", "El punto del conector no es válido", { reason: "POINT" }));
    return ok({ ...e, [end]: { x: point.x, y: point.y } });
  });
}
// --- Trazado ---------------------------------------------------------------------------------------------------------------------
const ADJUSTMENTS = ["waypoints", "curvature", "points", "smooth"] as const;
const hasAdjustments = (e: DEdge) => (e.waypoints?.length ?? 0) > 0 || e.curvature !== undefined || (e.points?.length ?? 0) > 0;

/**
 * Cambia el trazado conservando anclajes, texto y estilo. Los ajustes propios del trazado anterior (puntos de paso, curvatura, puntos de
 * control) se descartan: `discarded` dice si había alguno, para avisarlo (CL-9).
 */
export function setRoute(d: Diagram, edgeId: string, route: Route): Result<{ diagram: Diagram; discarded: boolean }> {
  if (!(ROUTES as readonly unknown[]).includes(route)) return err(appError("INVALID", "Trazado desconocido", { route }));
  const e = d.edges.find((x) => x.id === edgeId);
  if (!e) return err(appError("NOT_FOUND", "El conector no existe", { id: edgeId }));
  if (e.route === route) return ok({ diagram: d, discarded: false });
  const next = { ...e, route } as DEdge & Record<string, unknown>;
  for (const k of ADJUSTMENTS) delete next[k];
  return ok({ diagram: { ...d, edges: d.edges.map((x) => (x.id === edgeId ? next : x)) }, discarded: hasAdjustments(e) });
}

const onlyRoute = (e: DEdge, route: Route, what: string) => (e.route === route ? null : appError("INVALID", `${what} solo aplica al trazado «${route}»`, { reason: "ROUTE", route: e.route }));
const okPoint = (p: Point) => Number.isFinite(p.x) && Number.isFinite(p.y);

/** Puntos de paso del trazado de 90°: la ruta debe pasar por ellos. */
export function setWaypoints(d: Diagram, edgeId: string, waypoints: Point[]): Result<Diagram> {
  return withEdge(d, edgeId, (e) => onlyRoute(e, "orthogonal", "Los puntos de paso") ? err(onlyRoute(e, "orthogonal", "Los puntos de paso")!) : waypoints.every(okPoint) ? ok({ ...e, waypoints: waypoints.map((p) => ({ x: p.x, y: p.y })) }) : err(appError("INVALID", "Un punto de paso no es válido", { reason: "POINT" })));
}
/** Restablece la ruta de 90° al cálculo automático (sin puntos de paso). */
export const resetRoute = (d: Diagram, edgeId: string): Result<Diagram> => setWaypoints(d, edgeId, []);

/** Curvatura del trazado redondeado, limitada a 0,2–1. */
export function setCurvature(d: Diagram, edgeId: string, curvature: number): Result<Diagram> {
  return withEdge(d, edgeId, (e) => {
    const bad = onlyRoute(e, "curved", "La curvatura");
    if (bad) return err(bad);
    if (!Number.isFinite(curvature)) return err(appError("INVALID", "La curvatura no es válida", { reason: "CURVATURE" }));
    return ok({ ...e, curvature: Math.min(1, Math.max(0.2, curvature)) });
  });
}

const freeOnly = (e: DEdge, f: (points: Point[]) => Result<Point[]>): Result<DEdge> => {
  const bad = onlyRoute(e, "free", "Los puntos de control");
  if (bad) return err(bad);
  const r = f(e.points ?? []);
  return r.ok ? ok({ ...e, points: r.value }) : r;
};
const badIndex = () => err(appError("INVALID", "El punto de control no existe", { reason: "INDEX" }));
/** Inserta un punto de control del trazado libre en la posición `index` (0 = antes del primero). */
export const addControlPoint = (d: Diagram, edgeId: string, index: number, point: Point): Result<Diagram> =>
  withEdge(d, edgeId, (e) => freeOnly(e, (pts) => (!okPoint(point) ? err(appError("INVALID", "El punto no es válido", { reason: "POINT" })) : index < 0 || index > pts.length ? badIndex() : ok([...pts.slice(0, index), { x: point.x, y: point.y }, ...pts.slice(index)]))));
export const moveControlPoint = (d: Diagram, edgeId: string, index: number, point: Point): Result<Diagram> =>
  withEdge(d, edgeId, (e) => freeOnly(e, (pts) => (!okPoint(point) ? err(appError("INVALID", "El punto no es válido", { reason: "POINT" })) : index < 0 || index >= pts.length ? badIndex() : ok(pts.map((p, i) => (i === index ? { x: point.x, y: point.y } : p))))));
export const removeControlPoint = (d: Diagram, edgeId: string, index: number): Result<Diagram> =>
  withEdge(d, edgeId, (e) => freeOnly(e, (pts) => (index < 0 || index >= pts.length ? badIndex() : ok(pts.filter((_, i) => i !== index)))));
/** Alterna entre segmentos rectos y curva suavizada en el trazado libre, sin perder los puntos. */
export function setSmooth(d: Diagram, edgeId: string, smooth: boolean): Result<Diagram> {
  return withEdge(d, edgeId, (e) => { const bad = onlyRoute(e, "free", "El suavizado"); return bad ? err(bad) : ok({ ...e, smooth }); });
}

/** Desplaza el conector entero: solo se mueven los extremos libres (los unidos siguen a su forma). */
export function moveFreeEdge(d: Diagram, edgeId: string, dx: number, dy: number): Result<Diagram> {
  return withEdge(d, edgeId, (e) => {
    if (!Number.isFinite(dx) || !Number.isFinite(dy)) return err(appError("INVALID", "El desplazamiento no es válido", { reason: "POINT" }));
    const shift = (p: Endpoint): Endpoint => (isAttached(p) ? p : { x: p.x + dx, y: p.y + dy });
    return ok({ ...e, from: shift(e.from), to: shift(e.to) });
  });
}

export const setEdgeLabel = (d: Diagram, id: string, label: string): Diagram => ({ ...d, edges: d.edges.map((e) => (e.id === id ? { ...e, label } : e)) });
export const deleteEdge = (d: Diagram, id: string): Diagram => ({ ...d, edges: d.edges.filter((e) => e.id !== id) });

/** Extremos de un conector: la posición actual de su anclaje (por eso «siguen» a las formas al moverlas) o su punto libre. */
export function edgeEndpoints(d: Diagram, edgeId: string): { from: Point; to: Point } | null {
  const e = d.edges.find((x) => x.id === edgeId);
  if (!e) return null;
  const a = endPoint(d, e.from), b = endPoint(d, e.to);
  return a && b ? { from: a, to: b } : null;
}

export type Viewport = { zoom: number; x: number; y: number };
export function diagramBounds(d: Diagram): { x: number; y: number; w: number; h: number } | null {
  if (d.nodes.length === 0) return null;
  const x0 = Math.min(...d.nodes.map((n) => n.x)), y0 = Math.min(...d.nodes.map((n) => n.y));
  const x1 = Math.max(...d.nodes.map((n) => n.x + n.w)), y1 = Math.max(...d.nodes.map((n) => n.y + n.h));
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}
/** Vista que muestra todo el diagrama centrado; no amplía por encima de 1 (CL-8). Un diagrama vacío vuelve a la vista inicial. */
export function fitToView(d: Diagram, vp: { w: number; h: number }, padding = 40): Viewport {
  const b = diagramBounds(d);
  if (!b) return { zoom: 1, x: 0, y: 0 };
  const zoom = Math.min(1, Math.max(0.01, Math.min((vp.w - 2 * padding) / b.w, (vp.h - 2 * padding) / b.h)));
  return { zoom, x: (vp.w - b.w * zoom) / 2 - b.x * zoom, y: (vp.h - b.h * zoom) / 2 - b.y * zoom };
}
export const centerOn = (p: { x: number; y: number }, vp: { w: number; h: number }, zoom: number): Viewport => ({ zoom, x: vp.w / 2 - p.x * zoom, y: vp.h / 2 - p.y * zoom });
/** Centra la vista en uno de los extremos de un conector, aunque estén muy lejos entre sí (CL-9). */
export function centerOnEdgeEnd(d: Diagram, edgeId: string, end: "from" | "to", vp: { w: number; h: number }, zoom: number): Viewport | null {
  const ep = edgeEndpoints(d, edgeId);
  return ep ? centerOn(ep[end], vp, zoom) : null;
}

export const serializeDiagram = (d: Diagram): string => { const view = writeView(d.view); return stableJson({ version: DIAGRAM_VERSION, nodes: d.nodes, edges: d.edges, ...(view ? { view } : {}) }); };

const bad = (message: string) => err(appError("INVALID", message, { reason: "DIAGRAM" }));
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const isPoint = (v: unknown): v is Point => isObj(v) && typeof v.x === "number" && typeof v.y === "number" && finite(v.x, v.y);

/** Valida los campos presentes de un estilo (lo que falta se completa luego con el del sistema). Devuelve el motivo del error o null. */
function styleProblem(raw: unknown, kind: "node" | "edge"): string | null {
  if (raw === undefined) return null;
  if (!isObj(raw)) return "Un estilo del diagrama es inválido";
  const check = (k: string, ok_: (v: unknown) => boolean) => (raw[k] === undefined || ok_(raw[k]) ? null : `El estilo «${k}» del diagrama es inválido`);
  const problems = kind === "node"
    ? [check("fill", isFillColor), check("stroke", isColor), check("textColor", isColor), check("strokeDash", (v) => (DASHES as readonly unknown[]).includes(v)),
       check("strokeWidth", (v) => (NODE_STROKE_WIDTHS as readonly unknown[]).includes(v)), check("fillOpacity", (v) => typeof v === "number" && v >= 0 && v <= 1)]
    : [check("color", isColor), check("textColor", isColor), check("dash", (v) => (DASHES as readonly unknown[]).includes(v)), check("width", (v) => (EDGE_WIDTHS as readonly unknown[]).includes(v)),
       check("startCap", (v) => (CAPS as readonly unknown[]).includes(v)), check("endCap", (v) => (CAPS as readonly unknown[]).includes(v))];
  return problems.find((p) => p !== null) ?? null;
}

function readV2(raw: Record<string, unknown>): Result<Diagram> {
  if (!Array.isArray(raw.nodes) || !Array.isArray(raw.edges)) return bad("El diagrama no tiene el formato esperado");
  const nodes: DNode[] = [], ids = new Set<string>();
  for (const n of raw.nodes as unknown[]) {
    if (!isObj(n) || typeof n.id !== "string" || !(SHAPES as readonly unknown[]).includes(n.shape) || typeof n.text !== "string"
      || typeof n.x !== "number" || typeof n.y !== "number" || typeof n.w !== "number" || typeof n.h !== "number" || !finite(n.x, n.y, n.w, n.h)) return bad("Una forma del diagrama es inválida");
    const sp = styleProblem(n.style, "node");
    if (sp) return bad(sp);
    if (ids.has(n.id)) return bad("Hay formas con el mismo id");
    ids.add(n.id);
    nodes.push({ id: n.id, shape: n.shape as Shape, x: n.x, y: n.y, w: n.w, h: n.h, text: n.text, style: completeNodeStyle(n.shape as Shape, n.style as Partial<NodeStyle> | undefined) });
  }
  const edges: DEdge[] = [], edgeIds = new Set<string>();
  const endpoint = (v: unknown): Endpoint | null => {
    if (!isObj(v)) return null;
    if (typeof v.node === "string") return ids.has(v.node) && isAnchor(v.anchor) ? { node: v.node, anchor: v.anchor } : null;
    return isPoint(v) ? { x: v.x, y: v.y } : null;
  };
  for (const e of raw.edges as unknown[]) {
    if (!isObj(e) || typeof e.id !== "string") return bad("Un conector del diagrama es inválido");
    const from = endpoint(e.from), to = endpoint(e.to);
    if (!from || !to) return bad("Un conector apunta a una forma o a un punto que no existe");
    const route = e.route === undefined ? "straight" : e.route;
    if (!(ROUTES as readonly unknown[]).includes(route)) return bad("Un conector tiene un trazado desconocido");
    if (e.label !== undefined && typeof e.label !== "string") return bad("Un conector del diagrama es inválido");
    const sp = styleProblem(e.style, "edge");
    if (sp) return bad(sp);
    for (const k of ["waypoints", "points"] as const) if (e[k] !== undefined && (!Array.isArray(e[k]) || !(e[k] as unknown[]).every(isPoint))) return bad("Un punto de control del conector es inválido");
    if (e.curvature !== undefined && (typeof e.curvature !== "number" || !Number.isFinite(e.curvature))) return bad("La curvatura de un conector es inválida");
    if (e.smooth !== undefined && typeof e.smooth !== "boolean") return bad("Un conector del diagrama es inválido");
    if (edgeIds.has(e.id)) return bad("Hay conectores con el mismo id");
    edgeIds.add(e.id);
    edges.push({
      id: e.id, from, to, route: route as Route, label: (e.label as string | undefined) ?? "", style: completeEdgeStyle(e.style as Partial<EdgeStyle> | undefined),
      ...(e.waypoints !== undefined ? { waypoints: e.waypoints as Point[] } : {}), ...(e.curvature !== undefined ? { curvature: e.curvature as number } : {}),
      ...(e.points !== undefined ? { points: e.points as Point[] } : {}), ...(e.smooth !== undefined ? { smooth: e.smooth as boolean } : {}),
    });
  }
  const view = readView(raw.view);
  return ok({ nodes, edges, ...(view ? { view } : {}) });
}

function readV1(raw: Record<string, unknown>): Result<Diagram> {
  if (!Array.isArray(raw.nodes) || !Array.isArray(raw.edges)) return bad("El diagrama no tiene el formato esperado");
  const ids = new Set<string>();
  for (const n of raw.nodes as Record<string, unknown>[]) {
    if (!n || typeof n.id !== "string" || !(SHAPES as readonly unknown[]).includes(n.shape) || !finite(n.x as number, n.y as number, n.w as number, n.h as number) || typeof n.text !== "string" || typeof n.color !== "string") return bad("Una forma del diagrama es inválida");
    if (ids.has(n.id)) return bad("Hay formas con el mismo id");
    ids.add(n.id);
  }
  for (const e of raw.edges as Record<string, unknown>[]) {
    if (!e || typeof e.id !== "string" || typeof e.label !== "string" || typeof e.from !== "string" || typeof e.to !== "string") return bad("Un conector del diagrama es inválido");
    if (!ids.has(e.from) || !ids.has(e.to)) return bad("Un conector apunta a una forma que no existe");
  }
  return ok(migrateV1(raw));
}

/**
 * Lee el diagrama guardado en el bloque; texto vacío = diagrama vacío. Un diagrama sin versión (v1) se migra en memoria:
 * el texto guardado no se toca hasta que la persona edite. Si está dañado devuelve error (nunca lanza).
 */
export function parseDiagram(text: string): Result<Diagram> {
  if (text.trim() === "") return ok(emptyDiagram());
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { return bad("El diagrama está dañado"); }
  if (!isObj(raw)) return bad("El diagrama no tiene el formato esperado");
  const version = raw.version;
  if (version === undefined || (typeof version === "number" && version < DIAGRAM_VERSION)) return readV1(raw);
  if (typeof version !== "number") return bad("El diagrama no tiene el formato esperado");
  if (version > DIAGRAM_VERSION) return err(appError("UNSUPPORTED_VERSION", "El diagrama es de una versión más nueva de la aplicación", { found: version, supported: DIAGRAM_VERSION }));
  return readV2(raw);
}

/** Texto de formas y conectores, para que se encuentren al buscar (RF-5). */
export const diagramText = (d: Diagram): string => [...d.nodes.map((n) => n.text), ...d.edges.map((e) => e.label)].filter((t) => t.trim() !== "").join("\n");

/** Historial de deshacer/rehacer del diagrama, acotado. Un cambio idéntico al actual no añade paso. */
export class DiagramHistory extends Snapshots<Diagram> {
  constructor(now: Diagram, limit = 100) { super(now, serializeDiagram, limit); }
}
