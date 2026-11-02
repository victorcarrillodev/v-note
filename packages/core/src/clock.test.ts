// T-035 (prueba primero)
import { describe, it, expect } from "vitest";
import { FakeClock, systemClock } from "./clock";

describe("Clock", () => {
  it("el reloj simulado avanza solo cuando se le indica", () => {
    const c = new FakeClock(1_000);
    expect(c.now()).toBe(1_000);
    c.advance(500);
    expect(c.now()).toBe(1_500);
    c.set(10);
    expect(c.now()).toBe(10);
  });
  it("el reloj del sistema devuelve la hora actual", () => {
    const before = Date.now();
    expect(systemClock.now()).toBeGreaterThanOrEqual(before);
  });
});
