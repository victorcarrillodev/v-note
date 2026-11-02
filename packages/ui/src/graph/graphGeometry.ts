import type { GraphData } from "@vnote/core";

export type Transform = { x: number; y: number; k: number };
export type Pt = { x: number; y: number };
export const MIN_ZOOM = 0.05, MAX_ZOOM = 8;

export const nodeRadius = (degree: number): number => 4 + Math.min(10, Math.sqrt(degree) * 2);
export const toScreen = (t: Transform, p: Pt): Pt => ({ x: p.x * t.k + t.x, y: p.y * t.k + t.y });
export const toWorld = (t: Transform, p: Pt): Pt => ({ x: (p.x - t.x) / t.k, y: (p.y - t.y) / t.k });

/** Acerca o aleja manteniendo fijo el punto de pantalla `at` (el que está bajo el cursor). */
export function zoomAt(t: Transform, at: Pt, factor: number): Transform {
  const k = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, t.k * factor));
  const w = toWorld(t, at);
  return { k, x: at.x - w.x * k, y: at.y - w.y * k };
}
export const panBy = (t: Transform, dx: number, dy: number): Transform => ({ ...t, x: t.x + dx, y: t.y + dy });

/** Transformación que deja todos los nodos dentro de la vista, con margen. */
export function fitTransform(pos: Map<string, Pt>, view: { w: number; h: number }, margin = 40): Transform {
  if (pos.size === 0) return { x: view.w / 2, y: view.h / 2, k: 1 };
  const xs = [...pos.values()].map((p) => p.x), ys = [...pos.values()].map((p) => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const w = Math.max(1, maxX - minX), h = Math.max(1, maxY - minY);
  const k = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.min((view.w - margin * 2) / w, (view.h - margin * 2) / h, 2)));
  return { k, x: view.w / 2 - ((minX + maxX) / 2) * k, y: view.h / 2 - ((minY + maxY) / 2) * k };
}

/** Nodo bajo el puntero (el más cercano dentro de su radio), o null. */
export function hitNode(graph: GraphData, pos: Map<string, Pt>, t: Transform, at: Pt): string | null {
  let best: string | null = null, bestD = Infinity;
  for (const n of graph.nodes) {
    const p = pos.get(n.id);
    if (!p) continue;
    const s = toScreen(t, p);
    const d = Math.hypot(s.x - at.x, s.y - at.y);
    const r = Math.max(6, nodeRadius(n.degree) * Math.min(t.k, 2)) + 2;
    if (d <= r && d < bestD) { best = n.id; bestD = d; }
  }
  return best;
}

/** Nodos conectados con `id` (él incluido) e índices de las aristas que lo tocan, para resaltarlos. */
export function connections(graph: GraphData, id: string): { nodes: Set<string>; edges: number[] } {
  const nodes = new Set([id]);
  const edges: number[] = [];
  graph.edges.forEach((e, i) => { if (e.from === id || e.to === id) { edges.push(i); nodes.add(e.from); nodes.add(e.to); } });
  return { nodes, edges };
}
