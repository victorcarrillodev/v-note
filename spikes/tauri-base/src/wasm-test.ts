// T-013/T-014: SQLite WASM (opfs-sahpool) dentro de un Worker. Expone window.__wasm.exec(sql, bind) -> Promise.
const worker = new Worker(new URL("./wasm-worker.ts", import.meta.url), { type: "module" });
let n = 0;
const pending = new Map<number, { resolve: (v: any) => void; reject: (e: Error) => void }>();
worker.onmessage = (e) => {
  const p = pending.get(e.data.id);
  if (!p) return;
  pending.delete(e.data.id);
  e.data.error ? p.reject(new Error(e.data.error)) : p.resolve(e.data);
};
(window as any).__wasm = {
  exec: (sql: string, bind: unknown[] = []) =>
    new Promise<{ rows: any[]; version: string }>((resolve, reject) => {
      const id = ++n;
      pending.set(id, { resolve, reject });
      worker.postMessage({ id, sql, bind });
    }),
};
document.getElementById("out")!.textContent = "worker creado";
