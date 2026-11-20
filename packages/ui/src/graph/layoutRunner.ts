import { GraphLayoutClient, createLayout, type GraphData, type Positions } from "@vnote/core";

/** Plazo para que el worker conteste; pasado, se calcula sin él. */
const WORKER_DEADLINE_MS = 1500;
const yieldNow = () => new Promise<void>((r) => setTimeout(r, 0));

/** Alternativa sin worker (pruebas y entornos sin soporte): mismo cálculo por tandas en el hilo principal. */
async function inMainThread(graph: GraphData, signal: AbortSignal): Promise<Positions | null> {
  const layout = createLayout(graph);
  while (layout.done < layout.total) {
    if (signal.aborted) return null;
    layout.step(40); // tandas grandes: ceder el control entre tandas cuesta más que calcular
    await yieldNow();
  }
  return signal.aborted ? null : layout.positions();
}

/** Calcula la disposición del grafo en un worker cuando existe; devuelve null si se cancela. */
export async function computeLayout(graph: GraphData, signal: AbortSignal): Promise<Positions | null> {
  if (graph.nodes.length === 0) return new Map();
  if (typeof Worker === "undefined") return inMainThread(graph, signal);
  let worker: Worker | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    worker = new Worker(new URL("./layout.worker.ts", import.meta.url), { type: "module" });
    const client = new GraphLayoutClient(worker as never);
    // Si el worker no carga (error de módulo, CSP…) nunca contesta: se vigila su error y un plazo, y se calcula en el hilo principal.
    const failed = new Promise<"failed">((resolve) => {
      worker!.addEventListener("error", () => resolve("failed"), { once: true });
      worker!.addEventListener("messageerror", () => resolve("failed"), { once: true });
      timer = setTimeout(() => resolve("failed"), WORKER_DEADLINE_MS);
    });
    const r = await Promise.race([client.layout(graph, { signal, chunk: 40 }), failed]);
    if (r === "failed" || r.status === "error") { worker.terminate(); worker = null; return inMainThread(graph, signal); }
    return r.status === "done" ? r.positions : null;
  } catch {
    return inMainThread(graph, signal);
  } finally {
    clearTimeout(timer);
    worker?.terminate();
  }
}
