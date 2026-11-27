import { getQuickJS, type QuickJSContext, type QuickJSHandle } from "quickjs-emscripten";
import { createOutput } from "./outputLimit";
import type { RunOptions, RunResult } from "./types";

const DEFAULTS = { timeoutMs: 5_000, maxOutputChars: 20_000, memoryBytes: 64 * 1024 * 1024 };

/** Texto de un valor tal como lo mostraría `console.log`: las cadenas tal cual y lo demás como JSON. */
function show(vm: QuickJSContext, handle: QuickJSHandle): string {
  const v = vm.dump(handle);
  if (typeof v === "string") return v;
  if (v === undefined) return "undefined";
  try { return JSON.stringify(v) ?? String(v); } catch { return String(v); }
}

/** «Nombre: mensaje» de un error volcado desde el intérprete. */
function describe(dumped: unknown): string {
  if (typeof dumped === "string") return dumped;
  const e = dumped as { name?: string; message?: string } | null;
  return `${e?.name ?? "Error"}: ${e?.message ?? ""}`.trim();
}

type Outcome = Omit<RunResult, "stdout" | "stderr" | "ms">;

/**
 * Ejecuta JavaScript en un intérprete aislado (QuickJS en WebAssembly): sin DOM, red, almacenamiento ni acceso al sistema.
 * Solo existe `console`. Corta por tiempo y memoria, limita la salida y cada ejecución parte de un intérprete nuevo.
 */
export async function runJs(code: string, opts: RunOptions = {}): Promise<RunResult> {
  const { timeoutMs, maxOutputChars, memoryBytes } = { ...DEFAULTS, ...opts };
  const started = Date.now();
  const QuickJS = await getQuickJS();
  const runtime = QuickJS.newRuntime();
  const output = createOutput(maxOutputChars);
  const deadline = Date.now() + timeoutMs;
  const finish = (r: Outcome): RunResult => ({ ...r, stdout: output.stdout(), stderr: output.stderr(), ms: Date.now() - started });

  let vm: QuickJSContext | null = null;
  try {
    runtime.setMemoryLimit(memoryBytes);
    runtime.setMaxStackSize(512 * 1024);
    // Se interrumpe al agotar el tiempo o al pasarse del tope de salida (un bucle que imprime sin parar no debe correr hasta el final).
    runtime.setInterruptHandler(() => output.truncated() || Date.now() > deadline);
    vm = runtime.newContext();
    const context = vm;

    const consoleObj = context.newObject();
    const method = (name: string, to: "out" | "err") => {
      const fn = context.newFunction(name, (...args) => { output.write(to, `${args.map((a) => show(context, a)).join(" ")}\n`); });
      context.setProp(consoleObj, name, fn);
      fn.dispose();
    };
    for (const name of ["log", "info", "debug"]) method(name, "out");
    for (const name of ["warn", "error"]) method(name, "err");
    context.setProp(context.global, "console", consoleObj);
    consoleObj.dispose();

    const res = context.evalCode(code, "ejecucion.js");
    let outcome: Outcome;
    if (res.error) {
      const message = describe(context.dump(res.error));
      res.error.dispose();
      const interrupted = /interrupt/i.test(message);
      const timedOut = interrupted && !output.truncated() && Date.now() >= deadline;
      // Los avisos propios (salida larga, tiempo) llevan solo su bandera: la interfaz los traduce. El resto es el mensaje del intérprete.
      outcome = output.truncated() && interrupted ? { ok: false, truncated: true }
        : timedOut ? { ok: false, timedOut: true, limitMs: timeoutMs }
        : { ok: false, error: message };
    } else {
      const v = context.dump(res.value);
      res.value.dispose();
      outcome = { ok: true, ...(v === undefined ? {} : { value: JSON.stringify(v) ?? String(v) }) };
    }
    // Las promesas ya encoladas se resuelven antes de terminar (no hay temporizadores ni red que esperar).
    if (outcome.ok) {
      const jobs = runtime.executePendingJobs();
      if (jobs.error) { outcome = { ok: false, error: describe(context.dump(jobs.error)) }; jobs.error.dispose(); }
    }
    return finish(outcome);
  } catch (e) {
    return finish({ ok: false, error: e instanceof Error ? e.message : String(e) });
  } finally {
    vm?.dispose();
    runtime.dispose();
  }
}
