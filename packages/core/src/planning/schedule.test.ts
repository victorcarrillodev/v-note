// U-186 (RF-8.3, CL-15): validación de hora de inicio, fin y duración de una tarea con horario.
import { describe, it, expect } from "vitest";
import { validateSchedule, eventEnd, DEFAULT_DURATION_MIN } from "./schedule";

describe("validateSchedule", () => {
  it("acepta inicio con fin posterior", () => {
    expect(validateSchedule({ start: "2026-03-05T09:00", end: "2026-03-05T10:30" }).ok).toBe(true);
  });
  it("acepta inicio con duración positiva", () => {
    expect(validateSchedule({ start: "2026-03-05T09:00", durationMin: 45 }).ok).toBe(true);
  });
  it("acepta solo inicio (usa la duración por omisión)", () => {
    expect(validateSchedule({ start: "2026-03-05T09:00" }).ok).toBe(true);
  });
  it("rechaza un fin anterior al inicio", () => {
    const r = validateSchedule({ start: "2026-03-05T10:00", end: "2026-03-05T09:00" });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error.details).toMatchObject({ reason: "END_BEFORE_START" });
  });
  it("rechaza un fin igual al inicio (duración cero)", () => {
    const r = validateSchedule({ start: "2026-03-05T10:00", end: "2026-03-05T10:00" });
    expect(!r.ok && r.error.details).toMatchObject({ reason: "ZERO_DURATION" });
  });
  it("rechaza duración cero, negativa o no entera", () => {
    for (const d of [0, -5, 1.5, Number.NaN]) expect(validateSchedule({ start: "2026-03-05T09:00", durationMin: d }).ok, String(d)).toBe(false);
  });
  it("rechaza fechas u horas inexistentes", () => {
    expect(validateSchedule({ start: "2026-02-30T09:00" }).ok).toBe(false);
    expect(validateSchedule({ start: "2026-03-05T25:00" }).ok).toBe(false);
    expect(validateSchedule({ start: "2026-03-05T09:00", end: "basura" }).ok).toBe(false);
  });
  it("un fin al día siguiente (cruce de medianoche) es válido", () => {
    expect(validateSchedule({ start: "2026-03-05T23:00", end: "2026-03-06T01:00" }).ok).toBe(true);
  });
  it("no admite fin y duración a la vez si se contradicen", () => {
    expect(validateSchedule({ start: "2026-03-05T09:00", end: "2026-03-05T10:00", durationMin: 30 }).ok).toBe(false);
    expect(validateSchedule({ start: "2026-03-05T09:00", end: "2026-03-05T10:00", durationMin: 60 }).ok).toBe(true);
  });
});
describe("eventEnd", () => {
  it("suma la duración, cruzando días si hace falta", () => {
    expect(eventEnd({ start: "2026-03-05T23:30", durationMin: 90 })).toBe("2026-03-06T01:00");
  });
  it("usa el fin explícito cuando existe", () => {
    expect(eventEnd({ start: "2026-03-05T09:00", end: "2026-03-05T11:15" })).toBe("2026-03-05T11:15");
  });
  it("sin fin ni duración usa la duración por omisión", () => {
    expect(eventEnd({ start: "2026-03-05T09:00" })).toBe("2026-03-05T10:00");
    expect(DEFAULT_DURATION_MIN).toBe(60);
  });
});
