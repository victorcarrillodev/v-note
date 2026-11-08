// Copiar y pegar formas y estilos dentro de la aplicación (plan 003, §8). Todo es memoria interna: nada va al portapapeles del sistema ni al disco.
import { newId } from "../ids";
import { anchorPosition } from "./anchors";
import { isAttached, type DEdge, type DNode, type Diagram, type Endpoint } from "./diagram";
import type { Point } from "./geometry";
import type { EdgeStyle, NodeStyle } from "./style";

export type Clip = { kind: "diagram-clip"; version: 1; nodes: DNode[]; edges: DEdge[] };
export const PASTE_STEP = 24;
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
export const isClip = (v: unknown): v is Clip => !!v && typeof v === "object" && (v as Clip).kind === "diagram-clip" && Array.isArray((v as Clip).nodes) && Array.isArray((v as Clip).edges);

/**
 * Copia las formas elegidas con los conectores que las tocan. Un conector con un solo extremo en la selección se copia con el otro
 * extremo libre, en la posición que tenía su anclaje al copiar.
 */
export function copySelection(d: Diagram, nodeIds: string[]): Clip | null {
  const set = new Set(nodeIds);
  const nodes = d.nodes.filter((n) => set.has(n.id));
  if (nodes.length === 0) return null;
  const inSel = (e: Endpoint) => isAttached(e) && set.has(e.node);
  const toFree = (e: Endpoint): Endpoint => {
    if (!isAttached(e) || set.has(e.node)) return e;
    const n = d.nodes.find((x) => x.id === e.node);
    return n ? anchorPosition(n, e.anchor) : { x: 0, y: 0 };
  };
  const edges = d.edges.filter((e) => inSel(e.from) || inSel(e.to)).map((e) => ({ ...e, from: toFree(e.from), to: toFree(e.to) }));
  return clone({ kind: "diagram-clip" as const, version: 1 as const, nodes, edges });
}

/** Pega el contenido con identificadores nuevos, desplazado 24 por cada pegado anterior más uno (`times` = pegados previos del mismo contenido). */
export function pasteClip(d: Diagram, clip: Clip, times: number): { diagram: Diagram; nodeIds: string[]; edgeIds: string[] } {
  const off = PASTE_STEP * (Math.max(0, times) + 1);
  const shift = (p: Point): Point => ({ x: p.x + off, y: p.y + off });
  const ids = new Map(clip.nodes.map((n) => [n.id, newId()]));
  const nodes = clone(clip.nodes).map((n) => ({ ...n, id: ids.get(n.id)!, x: n.x + off, y: n.y + off }));
  const end = (e: Endpoint): Endpoint => (isAttached(e) ? { node: ids.get(e.node) ?? e.node, anchor: e.anchor } : shift(e));
  const edges: DEdge[] = clone(clip.edges).map((e) => ({
    ...e, id: newId(), from: end(e.from), to: end(e.to),
    ...(e.waypoints ? { waypoints: e.waypoints.map(shift) } : {}), ...(e.points ? { points: e.points.map(shift) } : {}),
  }));
  return { diagram: { nodes: [...d.nodes, ...nodes], edges: [...d.edges, ...edges] }, nodeIds: nodes.map((n) => n.id), edgeIds: edges.map((e) => e.id) };
}

export type StyleClip = { kind: "node"; style: NodeStyle } | { kind: "edge"; style: EdgeStyle };
/** Copia el estilo de una forma o de un conector (no su texto, tamaño, posición ni uniones). */
export function copyStyle(d: Diagram, id: string): StyleClip | null {
  const n = d.nodes.find((x) => x.id === id);
  if (n) return { kind: "node", style: clone(n.style) };
  const e = d.edges.find((x) => x.id === id);
  return e ? { kind: "edge", style: clone(e.style) } : null;
}
/** Aplica un estilo copiado solo a los elementos de su mismo tipo. */
export function pasteStyle(d: Diagram, clip: StyleClip, ids: string[]): Diagram {
  const set = new Set(ids);
  if (clip.kind === "node") return { ...d, nodes: d.nodes.map((n) => (set.has(n.id) ? { ...n, style: clone(clip.style) } : n)) };
  return { ...d, edges: d.edges.map((e) => (set.has(e.id) ? { ...e, style: clone(clip.style) } : e)) };
}
