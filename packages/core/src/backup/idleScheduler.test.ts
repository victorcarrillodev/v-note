import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { FakeClock } from "../clock";
import { IdleBackupScheduler } from "./idleScheduler";

describe("IdleBackupScheduler", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it("espera al silencio tras escribir (debounce) y agrupa ediciones en una sola ejecución", async () => {
    const clock = new FakeClock(0);
    const runs: string[][] = [];
    const sched = new IdleBackupScheduler({
      clock,
      debounceMs: 12_000,
      maxWaitMs: 60_000,
      run: async (ids) => { runs.push([...ids]); return "success"; },
    });

    sched.notifyChange("w1");
    await vi.advanceTimersByTimeAsync(8_000);
    clock.advance(8_000);
    expect(runs).toEqual([]);

    // Otra edición reinicia el debounce
    sched.notifyChange("w1");
    await vi.advanceTimersByTimeAsync(8_000);
    clock.advance(8_000);
    expect(runs).toEqual([]);

    await vi.advanceTimersByTimeAsync(4_000);
    expect(runs).toEqual([["w1"]]);
  });

  it("coalesce ediciones que llegan mientras ya hay una sincronización en curso", async () => {
    const clock = new FakeClock(0);
    let resolveFirst!: () => void;
    const runs: string[][] = [];
    let call = 0;
    const sched = new IdleBackupScheduler({
      clock,
      debounceMs: 1_000,
      maxWaitMs: 10_000,
      run: (ids) => {
        call++;
        runs.push([...ids]);
        if (call === 1) return new Promise((res) => { resolveFirst = () => res("success"); });
        return Promise.resolve("success");
      },
    });

    sched.notifyChange("w1");
    await vi.advanceTimersByTimeAsync(1_000);
    expect(runs).toEqual([["w1"]]);

    // Llega una edición a w2 mientras la primera subida sigue activa
    sched.notifyChange("w2");
    expect(runs).toHaveLength(1);

    resolveFirst();
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(runs).toEqual([["w1"], ["w2"]]);
  });

  it("reintenta con backoff ante error recuperable sin perder el lote sucio", async () => {
    const clock = new FakeClock(0);
    let attempts = 0;
    const sched = new IdleBackupScheduler({
      clock,
      debounceMs: 1_000,
      run: async () => {
        attempts++;
        return attempts === 1 ? "retryable_error" : "success";
      },
    });

    sched.notifyChange("w1");
    await vi.advanceTimersByTimeAsync(1_000);
    expect(attempts).toBe(1);

    // Primer reintento a los 60 s
    await vi.advanceTimersByTimeAsync(60_000);
    expect(attempts).toBe(2);
  });
});
