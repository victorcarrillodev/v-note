import { appError, err, ok, type Result } from "../result";
import { newId } from "../ids";
import { stableJson } from "../backup/stableJson";

export const SHAPES = ["terminator", "process", "decision", "io", "note"] as const;
export type Shape = (typeof SHAPES)[number];
export type DNode = { id: string; shape: Shape; x: number; y: number; w: number; h: number; text: string; color: string };
export type DEdge = { id: string; from: string; to: string; label: string };
export type Diagram = { nodes: DNode[]; edges: DEdge[] };

const SIZE: Record<Shape, { w: number; h: number }> = { terminator: { w: 140, h: 50 }, process: { w: 140, h: 60 }, decision: { w: 140, h: 80 }, io: { w: 140, h: 60 }, note: { w: 160, h: 80 } };
const DEFAULT_COLOR = "#dbeafe";
const MIN_W = 40, MIN_H = 24;
const COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const finite = (...n: number[]) => n.every((v) => Number.isFinite(v));

export const emptyDiagram = (): Diagram => ({ nodes: [], edges: [] });

const mapNode = (d: Diagram, id: string, f: (n: DNode) => DNode): Diagram => (d.nodes.some((n) => n.id === id) ? { ...d, nodes: d.nodes.map((n) => (n.id === id ? f(n) : n)) } : d);

export function addNode(d: Diagram, input: { shape: Shape; x: number; y: number; id?: string; text?: string; color?: string }): { diagram: Diagram; node: DNode } {
  const node: DNode = { id: input.id ?? newId(), shape: input.shape, x: finite(input.x) ? input.x : 0, y: finite(input.y) ? input.y : 0, ...SIZE[input.shape], text: input.text ?? "", color: input.color && COLOR.test(input.color) ? input.color : DEFAULT_COLOR };
  return { diagram: { ...d, nodes: [...d.nodes, node] }, node };
}
export const moveNode = (d: Diagram, id: string, x: number, y: number): Diagram => (finite(x, y) ? mapNode(d, id, (n) => ({ ...n, x, y })) : d);
export const resizeNode = (d: Diagram, id: string, w: number, h: number): Diagram => (finite(w, h) ? mapNode(d, id, (n) => ({ ...n, w: Math.max(MIN_W, w), h: Math.max(MIN_H, h) })) : d);
export const setNodeText = (d: Diagram, id: string, text: string): Diagram => mapNode(d, id, (n) => ({ ...n, text }));
export const setNodeColor = (d: Diagram, id: string, color: string): Diagram => (COLOR.test(color) ? mapNode(d, id, (n) => ({ ...n, color })) : d);

/** Elimina la forma y, de forma explícita, sus conectores: devuelve cuáles se quitaron para poder informarlo (RF-9). */
export function deleteNode(d: Diagram, id: string): { diagram: Diagram; removedEdges: DEdge[] } {
  const removedEdges = d.edges.filter((e) => e.from === id || e.to === id);
  return { diagram: { nodes: d.nodes.filter((n) => n.id !== id), edges: d.edges.filter((e) => e.from !== id && e.to !== id) }, removedEdges };
}

export function addEdge(d: Diagram, from: string, to: string): Result<{ diagram: Diagram; edge: DEdge }> {
  if (!d.nodes.some((n) => n.id === from) || !d.nodes.some((n) => n.id === to)) return err(appError("NOT_FOUND", "Las dos formas del conector deben existir", { from, to }));
  if (from === to) return err(appError("INVALID", "Un conector necesita dos formas distintas", { reason: "SELF" }));
  if (d.edges.some((e) => e.from === from && e.to === to)) return err(appError("CONFLICT", "Esas dos formas ya están conectadas en ese sentido", { reason: "DUPLICATE" }));
  const edge: DEdge = { id: newId(), from, to, label: "" };
  return ok({ diagram: { ...d, edges: [...d.edges, edge] }, edge });
}
export const setEdgeLabel = (d: Diagram, id: string, label: string): Diagram => ({ ...d, edges: d.edges.map((e) => (e.id === id ? { ...e, label } : e)) });
export const deleteEdge = (d: Diagram, id: string): Diagram => ({ ...d, edges: d.edges.filter((e) => e.id !== id) });

const center = (n: DNode) => ({ x: n.x + n.w / 2, y: n.y + n.h / 2 });
/** Extremos de un conector: los centros actuales de sus formas (por eso «siguen» a las formas al moverlas). */
export function edgeEndpoints(d: Diagram, edgeId: string): { from: { x: number; y: number }; to: { x: number; y: number } } | null {
  const e = d.edges.find((x) => x.id === edgeId);
  const a = d.nodes.find((n) => n.id === e?.from), b = d.nodes.find((n) => n.id === e?.to);
  return e && a && b ? { from: center(a), to: center(b) } : null;
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

export const serializeDiagram = (d: Diagram): string => stableJson({ nodes: d.nodes, edges: d.edges });

const bad = (message: string) => err(appError("INVALID", message, { reason: "DIAGRAM" }));
/** Lee el diagrama guardado en el bloque; texto vacío = diagrama vacío. Si está dañado devuelve error (nunca lanza). */
export function parseDiagram(text: string): Result<Diagram> {
  if (text.trim() === "") return ok(emptyDiagram());
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { return bad("El diagrama está dañado"); }
  if (!raw || typeof raw !== "object" || !Array.isArray((raw as Diagram).nodes) || !Array.isArray((raw as Diagram).edges)) return bad("El diagrama no tiene el formato esperado");
  const { nodes, edges } = raw as { nodes: unknown[]; edges: unknown[] };
  const ids = new Set<string>();
  for (const n of nodes as Partial<DNode>[]) {
    if (!n || typeof n.id !== "string" || !SHAPES.includes(n.shape as Shape) || !finite(n.x as number, n.y as number, n.w as number, n.h as number) || typeof n.text !== "string" || typeof n.color !== "string") return bad("Una forma del diagrama es inválida");
    if (ids.has(n.id)) return bad("Hay formas con el mismo id");
    ids.add(n.id);
  }
  for (const e of edges as Partial<DEdge>[]) {
    if (!e || typeof e.id !== "string" || typeof e.label !== "string" || typeof e.from !== "string" || typeof e.to !== "string") return bad("Un conector del diagrama es inválido");
    if (!ids.has(e.from) || !ids.has(e.to)) return bad("Un conector apunta a una forma que no existe");
  }
  return ok({ nodes: nodes as DNode[], edges: edges as DEdge[] });
}

/** Texto de formas y conectores, para que se encuentren al buscar (RF-5). */
export const diagramText = (d: Diagram): string => [...d.nodes.map((n) => n.text), ...d.edges.map((e) => e.label)].filter((t) => t.trim() !== "").join("\n");

/** Historial de deshacer/rehacer del diagrama, acotado. Un cambio idéntico al actual no añade paso. */
export class DiagramHistory {
  private past: Diagram[] = [];
  private future: Diagram[] = [];
  constructor(private now: Diagram, private limit = 100) {}
  get current(): Diagram { return this.now; }
  get canUndo() { return this.past.length > 0; }
  get canRedo() { return this.future.length > 0; }
  push(next: Diagram): void {
    if (serializeDiagram(next) === serializeDiagram(this.now)) return;
    this.past.push(this.now);
    if (this.past.length > this.limit) this.past.shift();
    this.now = next;
    this.future = [];
  }
  undo(): Diagram | null {
    const prev = this.past.pop();
    if (!prev) return null;
    this.future.push(this.now);
    this.now = prev;
    return prev;
  }
  redo(): Diagram | null {
    const next = this.future.pop();
    if (!next) return null;
    this.past.push(this.now);
    this.now = next;
    return next;
  }
}
