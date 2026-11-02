import { GraphLayoutClient, createLayout, type GraphData, type Positions } from "@vnote/core";

const yieldNow = () => new Promise<void>((r) => setTimeout(r, 0));

/** Alternativa sin worker (pruebas y entornos sin soporte): mismo cálculo por tandas en el hilo principal. */
async function inMainThread(graph: GraphData, signal: AbortSignal): Promise<Positions | null> {
  const layout = createLayout(graph);
  while (layout.done < layout.total) {
    if (signal.aborted) return null;
    layout.step(10);
    await yieldNow();
  }
  return signal.aborted ? null : layout.positions();
}

/** Calcula la disposición del grafo en un worker cuando existe; devuelve null si se cancela. */
export async function computeLayout(graph: GraphData, signal: AbortSignal): Promise<Positions | null> {
  if (graph.nodes.length === 0) return new Map();
  if (typeof Worker === "undefined") return inMainThread(graph, signal);
  let worker: Worker | null = null;
  try {
    worker = new Worker(new URL("./layout.worker.ts", import.meta.url), { type: "module" });
    const client = new GraphLayoutClient(worker as never);
    const r = await client.layout(graph, { signal });
    if (r.status === "error") return inMainThread(graph, signal);
    return r.status === "done" ? r.positions : null;
  } catch {
    return inMainThread(graph, signal);
  } finally {
    worker?.terminate();
  }
}
