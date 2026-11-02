// Utilidades de fechas de las vistas de calendario y línea de tiempo (T-273…T-276).
import { describe, it, expect } from "vitest";
import { addDaysIso, daysBetween, monthMatrix, dayOf, shiftRange, resizeRange, monthLabelKey } from "./dateUtils";

describe("addDaysIso / daysBetween", () => {
  it("suma días conservando la hora si la hay", () => {
    expect(addDaysIso("2026-03-05", 3)).toBe("2026-03-08");
    expect(addDaysIso("2026-03-05T14:30", 3)).toBe("2026-03-08T14:30");
    expect(addDaysIso("2026-03-30", 5)).toBe("2026-04-04");
    expect(addDaysIso("2026-01-01", -1)).toBe("2025-12-31");
    expect(addDaysIso("2028-02-28", 1)).toBe("2028-02-29");
  });
  it("diferencia en días (solo la parte de fecha)", () => {
    expect(daysBetween("2026-03-05", "2026-03-10")).toBe(5);
    expect(daysBetween("2026-03-10T23:00", "2026-03-05T01:00")).toBe(-5);
    expect(daysBetween("2026-03-05", "2026-03-05")).toBe(0);
    expect(daysBetween("2026-02-27", "2026-03-02")).toBe(3);
  });
  it("dayOf extrae la fecha", () => { expect(dayOf("2026-03-05T14:30")).toBe("2026-03-05"); expect(dayOf("2026-03-05")).toBe("2026-03-05"); });
});

describe("monthMatrix", () => {
  it("semanas completas de lunes a domingo que cubren el mes", () => {
    const m = monthMatrix(2026, 3); // marzo 2026: empieza en domingo
    expect(m[0]![0]).toBe("2026-02-23");
    expect(m[0]![6]).toBe("2026-03-01");
    expect(m.at(-1)!.at(-1)).toBe("2026-04-05");
    expect(m.every((w) => w.length === 7)).toBe(true);
    expect(m.flat()).toContain("2026-03-31");
  });
  it("febrero de un año bisiesto", () => {
    const flat = monthMatrix(2028, 2).flat();
    expect(flat).toContain("2028-02-29");
    expect(flat.filter((d) => d.startsWith("2028-02"))).toHaveLength(29);
  });
  it("sin días repetidos y consecutivos", () => {
    const flat = monthMatrix(2026, 12).flat();
    for (let i = 1; i < flat.length; i++) expect(daysBetween(flat[i - 1]!, flat[i]!)).toBe(1);
  });
  it("etiqueta del mes", () => { expect(monthLabelKey(3)).toBe("databases.month.3"); });
});

describe("shiftRange / resizeRange", () => {
  it("mover desplaza inicio y fin juntos", () => {
    expect(shiftRange({ start: "2026-03-05", end: "2026-03-08" }, 2)).toEqual({ start: "2026-03-07", end: "2026-03-10" });
    expect(shiftRange({ start: "2026-03-05" }, -1)).toEqual({ start: "2026-03-04" });
  });
  it("redimensionar cambia solo el final y nunca queda antes del inicio", () => {
    expect(resizeRange({ start: "2026-03-05", end: "2026-03-08" }, 3)).toEqual({ start: "2026-03-05", end: "2026-03-11" });
    expect(resizeRange({ start: "2026-03-05", end: "2026-03-08" }, -10)).toEqual({ start: "2026-03-05", end: "2026-03-05" });
    expect(resizeRange({ start: "2026-03-05" }, 2)).toEqual({ start: "2026-03-05", end: "2026-03-07" });
  });
  it("conserva otros campos (aviso y repetición)", () => {
    const v = { start: "2026-03-05", remind: "2026-03-04T08:00" } as { start: string; end?: string; remind?: string };
    expect(shiftRange(v, 1)).toEqual({ start: "2026-03-06", remind: "2026-03-04T08:00" });
  });
});
