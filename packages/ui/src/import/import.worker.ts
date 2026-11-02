import { planImport, type ImportKind, type SourceFile } from "@vnote/core";

// El análisis de la importación (leer Markdown, CSV, calcular hashes) corre fuera del hilo de la interfaz y se puede cancelar (D-31, RNF-12).
type Req = { type: "plan"; files: SourceFile[]; kind: ImportKind; name: string } | { type: "cancel" };
const ctx = self as unknown as { onmessage: ((e: MessageEvent<Req>) => void) | null; postMessage(m: unknown): void };
let abort: AbortController | null = null;
ctx.onmessage = async (e) => {
  const m = e.data;
  if (m.type === "cancel") { abort?.abort(); return; }
  abort = new AbortController();
  try {
    const plan = await planImport(m.files, { kind: m.kind, name: m.name, signal: abort.signal, onProgress: (done, total) => ctx.postMessage({ type: "progress", done, total }) });
    ctx.postMessage(plan ? { type: "done", plan } : { type: "cancelled" });
  } catch (err) {
    ctx.postMessage({ type: "error", message: err instanceof Error ? err.message : String(err) });
  }
};
