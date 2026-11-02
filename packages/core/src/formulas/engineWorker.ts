import { FormulaEngine, type EngineInput } from "./engine";

/** Entrada del motor sin funciones, para poder enviarla por un puerto de mensajes (el reloj viaja como milisegundos). */
export type SerializableEngineInput = Omit<EngineInput, "now"> & { nowMs: number };
export type ComputeResult =
  | { status: "done"; values: Record<string, Record<string, Record<string, unknown>>> }
  | { status: "cancelled" }
  | { status: "error"; message: string };

/** Subconjunto de MessagePort / Worker que se usa. */
export interface Port {
  postMessage(msg: unknown): void;
  addEventListener(type: "message", fn: (e: { data: unknown }) => void): void;
  start?(): void;
}
type Req = { type: "compute"; id: number; input: SerializableEngineInput; chunk?: number } | { type: "cancel"; id: number };

/** Atiende el cálculo en el lado del worker: cada petición se calcula cediendo el control, de modo que una cancelación se atiende a medio cálculo. */
export function serveEngine(port: Port): void {
  const running = new Map<number, AbortController>();
  port.addEventListener("message", (e) => {
    const m = e.data as Req;
    if (m.type === "cancel") { running.get(m.id)?.abort(); return; }
    const ac = new AbortController();
    running.set(m.id, ac);
    void (async () => {
      try {
        const engine = new FormulaEngine({ props: m.input.props, rows: m.input.rows, links: m.input.links, now: () => m.input.nowMs });
        await engine.computeAll({ signal: ac.signal, chunk: m.chunk ?? 2000 });
        port.postMessage({ id: m.id, result: { status: "done", values: engine.snapshot() } satisfies ComputeResult });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        port.postMessage({ id: m.id, result: (ac.signal.aborted ? { status: "cancelled" } : { status: "error", message }) satisfies ComputeResult });
      } finally { running.delete(m.id); }
    })();
  });
  port.start?.();
}

/** Lado de la interfaz: pide un cálculo y puede cancelarlo; nunca recibe valores de un cálculo cancelado. */
export class EngineClient {
  private seq = 0;
  private waiting = new Map<number, (r: ComputeResult) => void>();
  constructor(private port: Port) {
    port.addEventListener("message", (e) => {
      const m = e.data as { id: number; result: ComputeResult };
      this.waiting.get(m.id)?.(m.result);
      this.waiting.delete(m.id);
    });
    port.start?.();
  }
  compute(input: SerializableEngineInput, opts: { signal?: AbortSignal; chunk?: number } = {}): Promise<ComputeResult> {
    const id = ++this.seq;
    return new Promise((resolve) => {
      this.waiting.set(id, resolve);
      opts.signal?.addEventListener("abort", () => this.port.postMessage({ type: "cancel", id } satisfies Req), { once: true });
      if (opts.signal?.aborted) { this.waiting.delete(id); resolve({ status: "cancelled" }); return; }
      this.port.postMessage({ type: "compute", id, input, ...(opts.chunk ? { chunk: opts.chunk } : {}) } satisfies Req);
    });
  }
}
