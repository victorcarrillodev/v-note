import { commitImport, planImport, type AssetStore, type Clock, type ImportKind, type ImportPlan, type ImportReport, type SourceFile, type SqlStore } from "@vnote/core";

export type ImportProgress = { phase: "analyze" | "save"; done: number; total: number };
export type ImportOutcome =
  | { status: "done"; containerId: string; report: ImportReport }
  | { status: "cancelled" }
  | { status: "error"; message: string };
type PlanResult = { plan: ImportPlan } | { cancelled: true } | { error: string };

/** Analiza en un worker cuando existe (alternativa en el hilo principal). Cancelar termina el worker al instante. */
function analyze(files: SourceFile[], kind: ImportKind, name: string, signal: AbortSignal, onProgress: (done: number, total: number) => void): Promise<PlanResult> {
  if (typeof Worker === "undefined") {
    return planImport(files, { kind, name, signal, onProgress }).then((plan) => (plan ? { plan } : { cancelled: true as const }), (e) => ({ error: e instanceof Error ? e.message : String(e) }));
  }
  return new Promise<PlanResult>((resolve) => {
    const worker = new Worker(new URL("./import.worker.ts", import.meta.url), { type: "module" });
    const finish = (r: PlanResult) => { signal.removeEventListener("abort", onAbort); worker.terminate(); resolve(r); };
    const onAbort = () => { worker.postMessage({ type: "cancel" }); setTimeout(() => finish({ cancelled: true }), 50); };
    signal.addEventListener("abort", onAbort, { once: true });
    worker.onmessage = (e: MessageEvent<{ type: string; done?: number; total?: number; plan?: ImportPlan; message?: string }>) => {
      const m = e.data;
      if (m.type === "progress") onProgress(m.done ?? 0, m.total ?? 0);
      else if (m.type === "done") finish({ plan: m.plan! });
      else if (m.type === "cancelled") finish({ cancelled: true });
      else finish({ error: m.message ?? "Error al analizar los archivos" });
    };
    worker.onerror = (e) => finish({ error: e.message || "Error al analizar los archivos" });
    if (signal.aborted) { onAbort(); return; }
    worker.postMessage({ type: "plan", files, kind, name });
  });
}

/** Importa archivos al espacio: analiza (cancelable), escribe todo en una transacción (cancelable) y devuelve el informe. */
export async function runImport(a: {
  store: SqlStore; assets: AssetStore; clock: Clock; files: SourceFile[]; kind: ImportKind; name: string; parentId?: string | null;
  signal: AbortSignal; onProgress: (p: ImportProgress) => void;
}): Promise<ImportOutcome> {
  const planned = await analyze(a.files, a.kind, a.name, a.signal, (done, total) => a.onProgress({ phase: "analyze", done, total }));
  if ("cancelled" in planned) return { status: "cancelled" };
  if ("error" in planned) return { status: "error", message: planned.error };
  const r = await commitImport(planned.plan, {
    store: a.store, assets: a.assets, clock: a.clock, parentId: a.parentId ?? null, signal: a.signal,
    onProgress: (done, total) => a.onProgress({ phase: "save", done, total }),
  });
  if (r.ok) return { status: "done", containerId: r.value.containerId, report: planned.plan.report };
  return r.error.code === "CANCELLED" ? { status: "cancelled" } : { status: "error", message: r.error.message };
}
