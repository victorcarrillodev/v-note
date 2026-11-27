/// <reference lib="webworker" />
import { runJs } from "./jsEngine";
import { createPythonEngine, lockdownGlobals } from "./pythonEngine";
import type { RunMessage, RunRequest } from "./types";

/** Carpeta con los archivos de Pyodide, empaquetados con la aplicación (sin red). */
const PYODIDE_URL = new URL(`${(import.meta as unknown as { env: { BASE_URL: string } }).env.BASE_URL}pyodide/`, self.location.origin).href;

const python = createPythonEngine(async () => {
  const { loadPyodide } = await import("pyodide");
  const py = await loadPyodide({ indexURL: PYODIDE_URL });
  // Con el intérprete ya cargado, el código de la persona no debe poder usar red ni almacenamiento (Python alcanza el ámbito con `import js`).
  lockdownGlobals(self as unknown as Record<string, unknown>);
  return py as never;
});

const post = (m: RunMessage) => (self as unknown as DedicatedWorkerGlobalScope).postMessage(m);

self.onmessage = async (e: MessageEvent<RunRequest>) => {
  const { id, lang, code, opts } = e.data;
  try {
    if (lang === "javascript") {
      post({ id, phase: "running" });
      post({ id, result: await runJs(code, opts) });
      return;
    }
    post({ id, phase: "loading" });
    await python.ready();
    post({ id, phase: "running" });
    post({ id, result: await python.run(code, opts) });
  } catch (err) {
    post({ id, result: { ok: false, stdout: "", stderr: "", ms: 0, error: err instanceof Error ? err.message : String(err) } });
  }
};
