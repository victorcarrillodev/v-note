import type { RunMessage, RunOptions, RunPhase, RunRequest, RunResult, RunnableLanguage } from "./types";

/** Lo mínimo de un `Worker` que usa el anfitrión (así se prueba sin navegador). */
export interface WorkerLike {
  postMessage(message: unknown): void;
  terminate(): void;
  onmessage: ((e: { data: unknown }) => void) | null;
  onerror: ((e: unknown) => void) | null;
}

export type RunCallOptions = RunOptions & {
  onPhase?: (phase: RunPhase) => void;
  /** Al abortarla se cancela SOLO esta ejecución (si está en cola, ni llega a empezar). */
  signal?: AbortSignal;
};

const DEFAULT_TIMEOUT_MS = 10_000;
/** El intérprete de Python tarda en cargar la primera vez: eso no cuenta contra el límite, pero tampoco se espera para siempre. */
const LOAD_LIMIT_MS = 120_000;
const empty = { stdout: "", stderr: "", ms: 0 };
const cancelled = (): RunResult => ({ ...empty, ok: false, cancelled: true });

type Job = {
  id: number; lang: RunnableLanguage; code: string; opts: RunCallOptions;
  resolve: (r: RunResult) => void;
  settled: boolean;
  /** Termina la ejecución en curso (solo si ya tiene Worker). */
  abort?: () => void;
};

/**
 * Anfitrión de ejecución de código: lo corre en un Worker aparte. Un bucle infinito no se puede interrumpir desde dentro,
 * así que al vencer el tiempo (o al detenerlo) el Worker se termina y la siguiente ejecución usa uno nuevo.
 * Las ejecuciones se atienden de una en una, en orden.
 */
export class CodeRunner {
  private worker: WorkerLike | null = null;
  private seq = 0;
  private queue: Job[] = [];
  private running: Job | null = null;

  constructor(private makeWorker: () => WorkerLike) {}

  run(lang: RunnableLanguage, code: string, opts: RunCallOptions = {}): Promise<RunResult> {
    if (opts.signal?.aborted) return Promise.resolve(cancelled());
    return new Promise<RunResult>((resolve) => {
      const job: Job = { id: ++this.seq, lang, code, opts, resolve, settled: false };
      opts.signal?.addEventListener("abort", () => this.abort(job), { once: true });
      this.queue.push(job);
      this.pump();
    });
  }

  /** Libera el Worker (p. ej. al cerrar la página). Lo que esté en curso o en cola se cancela. */
  dispose(): void {
    for (const job of [...this.queue]) this.abort(job);
    if (this.running) this.abort(this.running);
    this.dropWorker();
  }

  private dropWorker(): void {
    this.worker?.terminate();
    this.worker = null;
  }

  /** Cancela una ejecución: en cola se descarta; en curso se termina su Worker. */
  private abort(job: Job): void {
    if (job.settled) return;
    if (job === this.running) { job.abort?.(); return; }
    job.settled = true;
    this.queue = this.queue.filter((j) => j !== job);
    job.resolve(cancelled());
  }

  private pump(): void {
    if (this.running) return;
    const job = this.queue.shift();
    if (!job) return;
    this.running = job;
    this.exec(job);
  }

  private exec(job: Job): void {
    const { onPhase, signal: _signal, ...runOpts } = job.opts;
    const timeoutMs = runOpts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    let worker: WorkerLike;
    try {
      worker = this.worker ??= this.makeWorker();
    } catch (e) {
      this.settle(job, { ...empty, ok: false, errorKey: "start", error: e instanceof Error ? e.message : String(e) }, false, null);
      return;
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    const finish = (r: RunResult, kill: boolean) => { clearTimeout(timer); this.settle(job, r, kill, worker); };
    const arm = (ms: number, build: () => RunResult) => { clearTimeout(timer); timer = setTimeout(() => finish(build(), true), ms); };

    job.abort = () => finish(cancelled(), true);
    worker.onmessage = (e) => {
      const m = e.data as RunMessage;
      if (!m || m.id !== job.id) return; // respuesta de una ejecución anterior
      if ("phase" in m) {
        onPhase?.(m.phase);
        // El límite corre desde que empieza a ejecutar; la carga tiene su propio tope.
        if (m.phase === "running") arm(timeoutMs + 500, () => ({ ...empty, ok: false, timedOut: true, limitMs: timeoutMs }));
        return;
      }
      finish(m.result, false);
    };
    worker.onerror = () => finish({ ...empty, ok: false, errorKey: "crashed" }, true);
    arm(LOAD_LIMIT_MS, () => ({ ...empty, ok: false, errorKey: "silent" }));
    const request: RunRequest = { id: job.id, lang: job.lang, code: job.code, opts: runOpts };
    worker.postMessage(request);
  }

  /** Cierra una ejecución una sola vez, suelta el Worker si hay que reiniciarlo y pasa a la siguiente. */
  private settle(job: Job, result: RunResult, kill: boolean, worker: WorkerLike | null): void {
    if (job.settled) return;
    job.settled = true;
    if (worker) { worker.onmessage = null; worker.onerror = null; }
    if (kill && worker) { if (this.worker === worker) this.worker = null; worker.terminate(); }
    this.running = null;
    job.resolve(result);
    this.pump();
  }
}
