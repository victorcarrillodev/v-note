// study-features-2 T-8 (prueba primero): el anfitrión del Worker corta por tiempo, cancela y se recupera.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { CodeRunner, type WorkerLike } from "./codeRunner";
import type { RunResult } from "./types";

const ok = (over: Partial<RunResult> = {}): RunResult => ({ ok: true, stdout: "", stderr: "", ms: 1, ...over });

/** Worker falso: guarda lo que recibe y deja a la prueba decidir cuándo y qué responde. */
class FakeWorker implements WorkerLike {
  static all: FakeWorker[] = [];
  onmessage: ((e: { data: unknown }) => void) | null = null;
  onerror: ((e: unknown) => void) | null = null;
  received: { id: number; lang: string; code: string }[] = [];
  terminated = false;
  constructor() { FakeWorker.all.push(this); }
  postMessage(m: unknown) { this.received.push(m as never); }
  terminate() { this.terminated = true; }
  say(data: unknown) { this.onmessage?.({ data }); }
}

beforeEach(() => { FakeWorker.all = []; vi.useFakeTimers(); });
afterEach(() => vi.useRealTimers());

describe("CodeRunner", () => {
  it("envía el lenguaje y el código al Worker y devuelve su resultado", async () => {
    const runner = new CodeRunner(() => new FakeWorker());
    const p = runner.run("javascript", "1+1");
    const w = FakeWorker.all[0]!;
    expect(w.received).toEqual([expect.objectContaining({ lang: "javascript", code: "1+1" })]);
    w.say({ id: w.received[0]!.id, phase: "running" });
    w.say({ id: w.received[0]!.id, result: ok({ value: "2" }) });
    expect(await p).toMatchObject({ ok: true, value: "2" });
  });

  it("avisa cuando el intérprete está cargando y cuando empieza a ejecutar", async () => {
    const phases: string[] = [];
    const runner = new CodeRunner(() => new FakeWorker());
    const p = runner.run("python", "1", { onPhase: (ph) => phases.push(ph) });
    const w = FakeWorker.all[0]!;
    const id = w.received[0]!.id;
    w.say({ id, phase: "loading" }); w.say({ id, phase: "running" }); w.say({ id, result: ok() });
    await p;
    expect(phases).toEqual(["loading", "running"]);
  });

  it("si no responde en el tiempo máximo, termina el Worker (corta el bucle) y responde «tiempo agotado»", async () => {
    const runner = new CodeRunner(() => new FakeWorker());
    const p = runner.run("python", "while True: pass", { timeoutMs: 2000 });
    const w = FakeWorker.all[0]!;
    w.say({ id: w.received[0]!.id, phase: "running" });
    await vi.advanceTimersByTimeAsync(2500);
    const r = await p;
    expect(r).toMatchObject({ ok: false, timedOut: true });
    expect(w.terminated).toBe(true);
    // la siguiente ejecución usa un Worker nuevo
    const next = runner.run("javascript", "1");
    expect(FakeWorker.all).toHaveLength(2);
    const w2 = FakeWorker.all[1]!;
    w2.say({ id: w2.received[0]!.id, result: ok() });
    await next;
  });

  it("el tiempo de carga del intérprete no cuenta contra el límite de ejecución", async () => {
    const runner = new CodeRunner(() => new FakeWorker());
    const p = runner.run("python", "1", { timeoutMs: 2000 });
    const w = FakeWorker.all[0]!;
    const id = w.received[0]!.id;
    w.say({ id, phase: "loading" });
    await vi.advanceTimersByTimeAsync(10_000); // tarda en cargar, pero no se ha empezado a ejecutar
    expect(w.terminated).toBe(false);
    w.say({ id, phase: "running" });
    await vi.advanceTimersByTimeAsync(500);
    w.say({ id, result: ok({ value: "1" }) });
    expect(await p).toMatchObject({ ok: true });
  });

  it("abortar su señal termina el Worker y responde «detenido»", async () => {
    const runner = new CodeRunner(() => new FakeWorker());
    const stop = new AbortController();
    const p = runner.run("javascript", "while(true){}", { signal: stop.signal });
    const w = FakeWorker.all[0]!;
    w.say({ id: w.received[0]!.id, phase: "running" });
    stop.abort();
    expect(await p).toMatchObject({ ok: false, cancelled: true });
    expect(w.terminated).toBe(true);
  });

  it("abortar una ejecución en cola NO toca la que está corriendo y la cancelada no llega a empezar", async () => {
    const runner = new CodeRunner(() => new FakeWorker());
    const a = runner.run("javascript", "a");
    const stopB = new AbortController();
    const b = runner.run("javascript", "b", { signal: stopB.signal });
    const c = runner.run("javascript", "c");
    const w = FakeWorker.all[0]!;
    stopB.abort();
    expect(await b).toMatchObject({ ok: false, cancelled: true });
    expect(w.terminated).toBe(false); // «a» sigue corriendo en el mismo Worker
    w.say({ id: w.received[0]!.id, result: ok({ value: "A" }) });
    expect((await a).value).toBe("A");
    await vi.advanceTimersByTimeAsync(0);
    expect(w.received.map((m) => m.code)).toEqual(["a", "c"]); // «b» nunca se envió
    w.say({ id: w.received[1]!.id, result: ok({ value: "C" }) });
    expect((await c).value).toBe("C");
  });

  it("una señal ya abortada responde «detenido» sin crear un Worker", async () => {
    const runner = new CodeRunner(() => new FakeWorker());
    const stop = new AbortController(); stop.abort();
    expect(await runner.run("python", "1", { signal: stop.signal })).toMatchObject({ cancelled: true });
    expect(FakeWorker.all).toHaveLength(0);
  });

  it("abortar mientras el intérprete carga también termina el Worker", async () => {
    const runner = new CodeRunner(() => new FakeWorker());
    const stop = new AbortController();
    const p = runner.run("python", "1", { signal: stop.signal });
    const w = FakeWorker.all[0]!;
    w.say({ id: w.received[0]!.id, phase: "loading" });
    stop.abort();
    expect(await p).toMatchObject({ cancelled: true });
    expect(w.terminated).toBe(true);
  });

  it("si crear el Worker lanza (CSP, entorno sin soporte) responde un error en vez de rechazar", async () => {
    const runner = new CodeRunner(() => { throw new Error("SecurityError"); });
    const r = await runner.run("javascript", "1");
    expect(r).toMatchObject({ ok: false, errorKey: "start" });
    expect(r.error).toContain("SecurityError");
  });

  it("tras un fallo del Worker, la siguiente ejecución usa uno nuevo", async () => {
    const runner = new CodeRunner(() => new FakeWorker());
    const p = runner.run("javascript", "1");
    FakeWorker.all[0]!.onerror?.(new Error("roto"));
    await p;
    const next = runner.run("javascript", "2");
    expect(FakeWorker.all).toHaveLength(2);
    FakeWorker.all[1]!.say({ id: FakeWorker.all[1]!.received[0]!.id, result: ok() });
    await next;
  });

  it("el resultado de «tiempo agotado» trae el límite para mostrarlo traducido", async () => {
    const runner = new CodeRunner(() => new FakeWorker());
    const p = runner.run("python", "while True: pass", { timeoutMs: 3000 });
    const w = FakeWorker.all[0]!;
    w.say({ id: w.received[0]!.id, phase: "running" });
    await vi.advanceTimersByTimeAsync(4000);
    expect(await p).toMatchObject({ timedOut: true, limitMs: 3000 });
  });

  it("un fallo del propio Worker se informa sin dejar la promesa colgada", async () => {
    const runner = new CodeRunner(() => new FakeWorker());
    const p = runner.run("javascript", "1");
    FakeWorker.all[0]!.onerror?.(new Error("wasm roto"));
    const r = await p;
    expect(r.ok).toBe(false);
    expect(r.errorKey).toBe("crashed");
  });

  it("dos ejecuciones seguidas se atienden de una en una y en orden", async () => {
    const runner = new CodeRunner(() => new FakeWorker());
    const a = runner.run("javascript", "a");
    const b = runner.run("javascript", "b");
    const w = FakeWorker.all[0]!;
    expect(w.received.map((m) => m.code)).toEqual(["a"]);
    w.say({ id: w.received[0]!.id, result: ok({ value: "A" }) });
    await a;
    await vi.advanceTimersByTimeAsync(0);
    expect(w.received.map((m) => m.code)).toEqual(["a", "b"]);
    w.say({ id: w.received[1]!.id, result: ok({ value: "B" }) });
    expect((await b).value).toBe("B");
  });

  it("ignora respuestas de una ejecución anterior (id distinto)", async () => {
    const runner = new CodeRunner(() => new FakeWorker());
    const p = runner.run("javascript", "x");
    const w = FakeWorker.all[0]!;
    w.say({ id: 9999, result: ok({ value: "ajena" }) });
    w.say({ id: w.received[0]!.id, result: ok({ value: "mía" }) });
    expect((await p).value).toBe("mía");
  });
});
