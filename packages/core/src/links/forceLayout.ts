import { forceCenter, forceLink, forceManyBody, forceSimulation, forceCollide, type SimulationLinkDatum, type SimulationNodeDatum } from "d3-force";
import type { GraphData } from "./graph";

type N = SimulationNodeDatum & { id: string };
export type Positions = Map<string, { x: number; y: number }>;
export type LayoutOptions = { ticks?: number; onStep?: (tick: number, total: number) => void; signal?: AbortSignal };

/** Simulación paso a paso (para poder ceder el control entre pasos y cancelar). */
export function createLayout(graph: GraphData, ticks?: number) {
  const nodes: N[] = graph.nodes.map((n) => ({ id: n.id }));
  const links: SimulationLinkDatum<N>[] = graph.edges.map((e) => ({ source: e.from, target: e.to }));
  const sim = forceSimulation<N>(nodes)
    .force("link", forceLink<N, SimulationLinkDatum<N>>(links).id((n) => n.id).distance(40).strength(0.4))
    .force("charge", forceManyBody<N>().strength(-40).theta(0.9).distanceMax(400))
    .force("collide", forceCollide<N>(6))
    .force("center", forceCenter(0, 0))
    .stop();
  const total = ticks ?? Math.min(300, Math.max(60, Math.ceil(30000 / Math.max(1, nodes.length))));
  let done = 0;
  return {
    total,
    get done() { return done; },
    step(n = 1) { for (let i = 0; i < n && done < total; i++) { sim.tick(); done++; } },
    positions(): Positions { return new Map(nodes.map((n) => [n.id, { x: n.x ?? 0, y: n.y ?? 0 }])); },
  };
}

/**
 * Disposición de fuerzas del grafo (D-11). Es determinista (d3-force no usa azar) y no toca el DOM, para poder correr en un worker.
 * Devuelve las posiciones por id; si se cancela, devuelve un mapa vacío.
 */
export function forceLayout(graph: GraphData, opts: LayoutOptions = {}): Positions {
  if (graph.nodes.length === 0) return new Map();
  const layout = createLayout(graph, opts.ticks);
  while (layout.done < layout.total) {
    if (opts.signal?.aborted) return new Map();
    layout.step(1);
    opts.onStep?.(layout.done, layout.total);
    if (opts.signal?.aborted) return new Map();
  }
  return layout.positions();
}
