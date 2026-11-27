import { createOutput } from "./outputLimit";
import type { RunOptions, RunResult } from "./types";

const DEFAULTS = { maxOutputChars: 20_000 };

/** Lo mínimo de Pyodide que usa el motor (así se prueba con el intérprete real y se carga a demanda en el Worker). */
export type PyodideLike = {
  globals: { get(name: string): unknown };
  runPython(code: string, opts?: { globals?: unknown }): unknown;
  setStdout(opts: { write: (bytes: Uint8Array) => number }): void;
  setStderr(opts: { write: (bytes: Uint8Array) => number }): void;
  setStdin(opts: { stdin: () => string | null | undefined }): void;
};

type PyProxy = { toString(): string; destroy?: () => void };
const isProxy = (v: unknown): v is PyProxy => typeof v === "object" && v !== null && typeof (v as PyProxy).toString === "function";
/** Descarta lo que se escriba (entre ejecuciones). */
const discard = { write: (bytes: Uint8Array) => bytes.length };

/** Última línea no vacía de un rastro de Python: el tipo y el mensaje del error. */
function lastLine(message: string): string {
  const lines = message.split("\n").map((l) => l.trimEnd()).filter((l) => l.trim() !== "");
  return lines[lines.length - 1] ?? message;
}

/** Fuerza a vaciar lo que Python tenga a medias en stdout/stderr (una línea sin salto se guarda hasta entonces). */
function flush(py: PyodideLike): void {
  try { py.runPython("import sys\nsys.stdout.flush()\nsys.stderr.flush()"); } catch { /* el callback puede lanzar al truncar */ }
}

/**
 * Motor de Python (Pyodide): un intérprete cargado una sola vez, y un espacio de nombres nuevo en cada ejecución.
 * No corta por tiempo por sí mismo: eso lo hace quien lo aloja terminando el Worker (un bucle de Python no se puede interrumpir desde dentro sin memoria compartida).
 */
export function createPythonEngine(load: () => Promise<PyodideLike>) {
  let loading: Promise<PyodideLike> | null = null;
  // Una carga fallida (red, archivo) no se recuerda: la siguiente ejecución vuelve a intentarlo.
  const ready = (): Promise<PyodideLike> => (loading ??= load().catch((e) => { loading = null; throw e; }));

  return {
    /** Carga el intérprete (la primera vez tarda unos segundos). */
    ready,
    async run(code: string, opts: RunOptions = {}): Promise<RunResult> {
      const { maxOutputChars } = { ...DEFAULTS, ...opts };
      const started = Date.now();
      const output = createOutput(maxOutputChars);
      const done = (r: Omit<RunResult, "stdout" | "stderr" | "ms">): RunResult => ({ ...r, stdout: output.stdout(), stderr: output.stderr(), ms: Date.now() - started });

      let py: PyodideLike;
      try { py = await ready(); } catch (e) { return done({ ok: false, errorKey: "pythonLoad", error: e instanceof Error ? e.message : String(e) }); }
      // Lo que quedó a medias de la ejecución anterior se descarta antes de empezar.
      py.setStdout(discard); py.setStderr(discard);
      flush(py);
      // Escritura directa de bytes: a diferencia del modo por líneas, no retiene la última línea si no termina en salto.
      const sink = (to: "out" | "err") => {
        const decoder = new TextDecoder();
        return { write: (bytes: Uint8Array) => { if (!output.write(to, decoder.decode(bytes, { stream: true }))) throw new Error("Salida demasiado larga"); return bytes.length; } };
      };
      py.setStdout(sink("out"));
      py.setStderr(sink("err"));
      py.setStdin({ stdin: () => null }); // input() recibe fin de archivo en vez de quedarse esperando
      const dictType = py.globals.get("dict") as (() => PyProxy) & PyProxy;
      const ns = dictType();
      dictType.destroy?.();
      try {
        const result = py.runPython(code, { globals: ns });
        let value: string | undefined;
        if (result !== undefined && result !== null) {
          if (typeof result === "string") { const repr = py.globals.get("repr") as ((v: unknown) => string) & PyProxy; value = repr(result); repr.destroy?.(); }
          else if (typeof result === "boolean") value = result ? "True" : "False";
          else if (isProxy(result)) { try { value = result.toString(); } finally { result.destroy?.(); } }
          else value = String(result);
        }
        flush(py); // una línea final sin salto de línea también se muestra
        if (output.truncated()) return done({ ok: false, truncated: true }); // el tope pudo pasarse justo en este vaciado
        return done({ ok: true, ...(value === undefined ? {} : { value }) });
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        if (output.truncated()) return done({ ok: false, truncated: true });
        return done({ ok: false, error: lastLine(message) });
      } finally {
        py.setStdout(discard); py.setStderr(discard);
        flush(py);
        ns.destroy?.();
      }
    },
  };
}

/** Nombres del ámbito global del Worker que dan acceso a la red, al almacenamiento o a otros hilos. */
export const LOCKED_GLOBALS = [
  "fetch", "XMLHttpRequest", "WebSocket", "WebSocketStream", "EventSource", "WebTransport", "RTCPeerConnection",
  "indexedDB", "caches", "importScripts", "BroadcastChannel", "Worker", "SharedWorker",
  // Lo de `navigator` NO va en esta lista: se restringe por lista de permitidos (ver NAVIGATOR_ALLOWED).
  "navigator.storage", "navigator.locks", "navigator.serviceWorker", "navigator.sendBeacon",
] as const;

/**
 * Lo único de `navigator` que el código ejecutado puede ver. Todo lo demás se cierra, también lo que aparezca en versiones futuras:
 * `storage`, `storageBuckets` (OPFS por otra puerta), `serviceWorker`, `locks`, `gpu`, `usb`, `credentials`, `clipboard`…
 */
export const NAVIGATOR_ALLOWED = ["userAgent", "language", "languages", "onLine", "hardwareConcurrency", "platform"] as const;

const hasOwn = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k);

/** Deja `name` indefinida e inmodificable en TODA la cadena de prototipos de `target`: `fetch` y `indexedDB` viven en `WorkerGlobalScope.prototype`, no en el objeto. */
function removeEverywhere(target: object, name: string): void {
  const kill = (o: object) => { try { Object.defineProperty(o, name, { value: undefined, writable: false, configurable: false }); } catch { /* ya bloqueado o no configurable */ } };
  kill(target); // aunque no exista, así tampoco se puede crear después
  let proto: object | null = Object.getPrototypeOf(target);
  while (proto && proto !== Object.prototype) {
    if (hasOwn(proto, name)) kill(proto);
    proto = Object.getPrototypeOf(proto);
  }
}

/** Todos los nombres de propiedad de un objeto y de sus prototipos (menos los de `Object.prototype`). */
function allNames(target: object): Set<string> {
  const names = new Set<string>();
  for (let o: object | null = target; o && o !== Object.prototype; o = Object.getPrototypeOf(o)) for (const n of Object.getOwnPropertyNames(o)) names.add(n);
  return names;
}

/**
 * Quita del ámbito global lo que el código de la persona podría usar para salir (Python alcanza el ámbito con `import js`).
 * Se llama DESPUÉS de cargar el intérprete, que necesita la red para traer sus propios archivos.
 * - Los nombres de LOCKED_GLOBALS quedan indefinidos en el objeto y en todos sus prototipos, sin posibilidad de restaurarse.
 * - `navigator` se restringe por lista de permitidos: cualquier otra propiedad, conocida o futura, se cierra.
 * `postMessage` (el canal con la aplicación) no se toca.
 */
export function lockdownGlobals(scope: Record<string, unknown>): void {
  for (const name of LOCKED_GLOBALS) {
    if (!name.includes(".")) { removeEverywhere(scope, name); continue; }
    const [owner, member] = name.split(".") as [string, string];
    const target = scope[owner];
    if (target && (typeof target === "object" || typeof target === "function")) removeEverywhere(target as object, member);
  }
  const nav = scope.navigator;
  if (nav && (typeof nav === "object" || typeof nav === "function")) {
    const allowed = new Set<string>(NAVIGATOR_ALLOWED);
    for (const name of allNames(nav as object)) if (name !== "constructor" && !allowed.has(name)) removeEverywhere(nav as object, name);
  }
}
