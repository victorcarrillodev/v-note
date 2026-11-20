import { createLayout, type Positions } from "./forceLayout";
import type { GraphData } from "./graph";
import type { Port } from "../formulas/engineWorker";

export type LayoutResult = { status: "done"; positions: [string, { x: number; y: number }][] } | { status: "cancelled" } | { status: "error"; message: string };
type Req = { type: "layout"; id: number; graph: GraphData; chunk?: number } | { type: "cancel"; id: number };
const tick = () => new Promise<void>((r) => setTimeout(r, 0));

/** Lado del worker: calcula la disposición por tandas y cede el control entre ellas, de modo que una cancelación llega a media simulación. */
export function serveGraphLayout(port: Port): void {
  const cancelled = new Set<number>();
  port.addEventListener("message", (e) => {
    const m = e.data as Req;
    if (m.type === "cancel") { cancelled.add(m.id); return; }
    void (async () => {
      try {
        const layout = createLayout(m.graph);
        while (layout.done < layout.total) {
          if (cancelled.has(m.id)) { port.postMessage({ id: m.id, result: { status: "cancelled" } satisfies LayoutResult }); cancelled.delete(m.id); return; }
          layout.step(m.chunk ?? 40);
          await tick();
        }
        port.postMessage({ id: m.id, result: { status: "done", positions: [...layout.positions()] } satisfies LayoutResult });
      } catch (err) {
        port.postMessage({ id: m.id, result: { status: "error", message: err instanceof Error ? err.message : String(err) } satisfies LayoutResult });
      } finally { cancelled.delete(m.id); }
    })();
  });
  port.start?.();
}

/** Lado de la interfaz: pide la disposición y puede cancelarla. */
export class GraphLayoutClient {
  private seq = 0;
  private waiting = new Map<number, (r: LayoutResult) => void>();
  constructor(private port: Port) {
    port.addEventListener("message", (e) => {
      const m = e.data as { id: number; result: LayoutResult };
      this.waiting.get(m.id)?.(m.result);
      this.waiting.delete(m.id);
    });
    port.start?.();
  }
  layout(graph: GraphData, opts: { signal?: AbortSignal; chunk?: number } = {}): Promise<{ status: "done"; positions: Positions } | { status: "cancelled" } | { status: "error"; message: string }> {
    const id = ++this.seq;
    return new Promise((resolve) => {
      this.waiting.set(id, (r) => resolve(r.status === "done" ? { status: "done", positions: new Map(r.positions) } : r));
      opts.signal?.addEventListener("abort", () => this.port.postMessage({ type: "cancel", id } satisfies Req), { once: true });
      if (opts.signal?.aborted) { this.waiting.delete(id); resolve({ status: "cancelled" }); return; }
      this.port.postMessage({ type: "layout", id, graph, ...(opts.chunk ? { chunk: opts.chunk } : {}) } satisfies Req);
    });
  }
}
