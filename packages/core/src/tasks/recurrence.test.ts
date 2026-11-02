// T-293…T-296 (prueba primero): modelo de recordatorio flotante y recurrencia diaria, semanal, mensual y anual.
import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { validateRecurrence, occurrence, nextAfter, nextOnCompletion, isValidLocal, advanceSchedule, type Recurrence, type Schedule } from "./recurrence";

const daily: Recurrence = { freq: "daily", interval: 1 };
const weekly: Recurrence = { freq: "weekly", interval: 1 };
const monthly: Recurrence = { freq: "monthly", interval: 1 };
const yearly: Recurrence = { freq: "yearly", interval: 1 };

describe("modelo (T-293)", () => {
  it("valida frecuencia e intervalo", () => {
    for (const r of [daily, weekly, monthly, yearly, { freq: "daily", interval: 3 }]) expect(validateRecurrence(r).ok, JSON.stringify(r)).toBe(true);
    for (const r of [{ freq: "hourly", interval: 1 }, { freq: "daily", interval: 0 }, { freq: "daily", interval: -2 }, { freq: "daily", interval: 1.5 }, null, "diario", { freq: "daily", interval: 400 }]) {
      expect(validateRecurrence(r as never).ok, JSON.stringify(r)).toBe(false);
    }
  });
  it("el intervalo por defecto es 1", () => {
    const r = validateRecurrence({ freq: "weekly" } as never);
    expect(r.ok && r.value.interval).toBe(1);
  });
  it("fecha y hora locales (flotantes): AAAA-MM-DD o AAAA-MM-DDTHH:mm reales", () => {
    for (const v of ["2026-03-05", "2026-03-05T09:30", "2028-02-29T23:59"]) expect(isValidLocal(v), v).toBe(true);
    for (const v of ["2026-02-30", "2026-03-05T24:00", "2026-03-05T09:60", "2026-03-05 09:30", "ayer", "2026-3-5"]) expect(isValidLocal(v), v).toBe(false);
  });
});

describe("recurrencia diaria y semanal (T-294)", () => {
  it("la ocurrencia n-ésima desde la ancla", () => {
    expect(occurrence("2026-03-05T09:00", daily, 0)).toBe("2026-03-05T09:00");
    expect(occurrence("2026-03-05T09:00", daily, 1)).toBe("2026-03-06T09:00");
    expect(occurrence("2026-03-05T09:00", { freq: "daily", interval: 3 }, 2)).toBe("2026-03-11T09:00");
    expect(occurrence("2026-03-05", weekly, 1)).toBe("2026-03-12");
    expect(occurrence("2026-03-05", { freq: "weekly", interval: 2 }, 3)).toBe("2026-04-16");
  });
  it("cruza fin de mes y de año", () => {
    expect(occurrence("2026-12-30", daily, 3)).toBe("2027-01-02");
    expect(occurrence("2026-02-27", daily, 2)).toBe("2026-03-01");
    expect(occurrence("2028-02-27", daily, 2)).toBe("2028-02-29");
  });
  it("nextAfter: la primera ocurrencia estrictamente posterior", () => {
    expect(nextAfter("2026-03-05T09:00", daily, "2026-03-05T09:00")).toBe("2026-03-06T09:00");
    expect(nextAfter("2026-03-05T09:00", daily, "2026-03-05T08:59")).toBe("2026-03-05T09:00");
    expect(nextAfter("2026-03-05T09:00", daily, "2026-03-20T10:00")).toBe("2026-03-21T09:00");
    expect(nextAfter("2026-03-05", weekly, "2026-03-20")).toBe("2026-03-26");
  });
  it("antes de la ancla, la siguiente es la propia ancla", () => {
    expect(nextAfter("2026-03-05", daily, "2026-01-01")).toBe("2026-03-05");
  });
});

describe("recurrencia mensual y anual con ajuste a fin de mes (T-295, CL-25)", () => {
  it("el día 31 cae en el último día de los meses cortos y vuelve al 31 cuando se puede (se calcula desde la ancla)", () => {
    const a = "2026-01-31";
    expect([1, 2, 3, 4, 5].map((n) => occurrence(a, monthly, n))).toEqual(["2026-02-28", "2026-03-31", "2026-04-30", "2026-05-31", "2026-06-30"]);
  });
  it("29 y 30 de enero en febrero (año normal y bisiesto)", () => {
    expect(occurrence("2026-01-29", monthly, 1)).toBe("2026-02-28");
    expect(occurrence("2028-01-29", monthly, 1)).toBe("2028-02-29");
    expect(occurrence("2026-01-30", monthly, 1)).toBe("2026-02-28");
    expect(occurrence("2028-01-30", monthly, 1)).toBe("2028-02-29");
  });
  it("conserva la hora y cruza de año", () => {
    expect(occurrence("2026-11-15T18:45", monthly, 3)).toBe("2027-02-15T18:45");
    expect(occurrence("2026-12-31T08:00", monthly, 2)).toBe("2027-02-28T08:00");
  });
  it("intervalo de varios meses", () => {
    expect(occurrence("2026-01-31", { freq: "monthly", interval: 3 }, 1)).toBe("2026-04-30");
  });
  it("anual: el 29 de febrero cae el 28 en años no bisiestos y vuelve al 29 en bisiestos", () => {
    const a = "2028-02-29";
    expect([1, 2, 3, 4].map((n) => occurrence(a, yearly, n))).toEqual(["2029-02-28", "2030-02-28", "2031-02-28", "2032-02-29"]);
    expect(occurrence("2026-03-05T10:00", yearly, 2)).toBe("2028-03-05T10:00");
  });
  it("nextAfter funciona con meses cortos", () => {
    expect(nextAfter("2026-01-31", monthly, "2026-02-28")).toBe("2026-03-31");
    expect(nextAfter("2026-01-31", monthly, "2026-02-27")).toBe("2026-02-28");
  });
});

describe("completar una tarea recurrente (T-296, CL-32)", () => {
  it("completar antes de tiempo programa la siguiente a partir de la fecha original, no de la de cierre", () => {
    // La ocurrencia vigente es la del 5; se completa el 3 (antes de tiempo): la siguiente es la del 6, no el 4
    expect(nextOnCompletion("2026-03-05T09:00", daily, "2026-03-05T09:00")).toBe("2026-03-06T09:00");
    expect(nextOnCompletion("2026-03-05", weekly, "2026-03-05")).toBe("2026-03-12");
  });
  it("la ocurrencia vigente puede ser cualquiera de la serie; la siguiente es su sucesora", () => {
    expect(nextOnCompletion("2026-01-31", monthly, "2026-02-28")).toBe("2026-03-31");
    expect(nextOnCompletion("2026-01-31", monthly, "2026-03-31")).toBe("2026-04-30");
  });
  it("si la ocurrencia no es de la serie, la siguiente es la primera posterior a ella", () => {
    expect(nextOnCompletion("2026-03-05", daily, "2026-03-05T12:00")).toBe("2026-03-06");
  });
});

describe("ancla de la serie", () => {
  it("se conserva si es válida y se rechaza si no", () => {
    const ok = validateRecurrence({ freq: "monthly", interval: 1, anchor: "2026-01-31T09:00" });
    expect(ok.ok && ok.value.anchor).toBe("2026-01-31T09:00");
    expect(validateRecurrence({ freq: "monthly", interval: 1, anchor: "ayer" }).ok).toBe(false);
  });
});

describe("propiedades", () => {
  const rule = fc.record({ freq: fc.constantFrom("daily", "weekly", "monthly", "yearly"), interval: fc.integer({ min: 1, max: 5 }) }) as fc.Arbitrary<Recurrence>;
  const date = fc.record({ y: fc.integer({ min: 2020, max: 2035 }), m: fc.integer({ min: 1, max: 12 }), d: fc.integer({ min: 1, max: 28 }) }).map(({ y, m, d }) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
  it("las ocurrencias son estrictamente crecientes y siempre fechas válidas", () => {
    fc.assert(fc.property(date, rule, (a, r) => {
      let prev = occurrence(a, r, 0);
      for (let n = 1; n < 30; n++) { const o = occurrence(a, r, n); expect(isValidLocal(o)).toBe(true); expect(o > prev).toBe(true); prev = o; }
    }), { numRuns: 300 });
  });
  it("nextAfter(x) siempre es posterior a x y no se salta ninguna ocurrencia", () => {
    fc.assert(fc.property(date, rule, fc.integer({ min: 0, max: 400 }), (a, r, days) => {
      const after = occurrence(a, { freq: "daily", interval: 1 }, days);
      const nx = nextAfter(a, r, after);
      expect(nx > after).toBe(true);
      let n = 0; while (occurrence(a, r, n) <= after) n++;
      expect(nx).toBe(occurrence(a, r, n));
    }), { numRuns: 300 });
  });
});

describe("advanceSchedule: siguiente repetición de una tarea recurrente", () => {
  it("avanza fecha límite y aviso juntos y fija la ancla de la serie", () => {
    const r = advanceSchedule({ due: "2026-03-07", remindAt: "2026-03-07T09:00", recurrence: { freq: "daily", interval: 1 } });
    expect(r).toEqual({ due: "2026-03-08", remindAt: "2026-03-08T09:00", recurrence: { freq: "daily", interval: 1, anchor: "2026-03-07T09:00" } });
  });
  it("solo con fecha límite", () => {
    expect(advanceSchedule({ due: "2026-01-31", remindAt: null, recurrence: { freq: "monthly", interval: 1 } })).toEqual({ due: "2026-02-28", remindAt: null, recurrence: { freq: "monthly", interval: 1, anchor: "2026-01-31" } });
  });
  it("sigue la serie desde la ancla (fin de mes) en repeticiones sucesivas", () => {
    let cur: Schedule = { due: "2026-01-31", remindAt: null, recurrence: { freq: "monthly", interval: 1 } };
    const seen: string[] = [];
    for (let i = 0; i < 4; i++) { const n = advanceSchedule(cur)!; seen.push(n.due!); cur = n; }
    expect(seen).toEqual(["2026-02-28", "2026-03-31", "2026-04-30", "2026-05-31"]);
  });
  it("sin repetición o sin fechas no hay siguiente", () => {
    expect(advanceSchedule({ due: "2026-03-07", remindAt: null, recurrence: null })).toBeNull();
    expect(advanceSchedule({ due: null, remindAt: null, recurrence: { freq: "daily", interval: 1 } })).toBeNull();
  });
});

