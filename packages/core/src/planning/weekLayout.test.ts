// U-187 a U-190 (RF-7.2, RF-7.3, RF-7.4, CL-11, CL-12, CL-13): colocación de eventos en la semana.
import { describe, it, expect } from "vitest";
import { placeWeek, type PlanEvent } from "./weekLayout";

const WEEK = "2026-03-02"; // lunes
const ev = (id: string, start: string, extra: Partial<PlanEvent> = {}): PlanEvent => ({ id, title: id, start, ...extra });

describe("posiciones por hora y duración (U-187)", () => {
  it("un evento de 09:00 a 10:30 el miércoles", () => {
    const { segments } = placeWeek([ev("a", "2026-03-04T09:00", { durationMin: 90 })], WEEK);
    expect(segments).toEqual([{ id: "a", day: 2, startMin: 540, endMin: 630, lane: 0, lanes: 1, continuesBefore: false, continuesAfter: false }]);
  });
  it("sin duración usa 60 min", () => {
    const { segments } = placeWeek([ev("a", "2026-03-02T08:15")], WEEK);
    expect(segments[0]).toMatchObject({ startMin: 495, endMin: 555 });
  });
  it("con fin explícito", () => {
    const { segments } = placeWeek([ev("a", "2026-03-08T22:00", { end: "2026-03-08T23:30" })], WEEK);
    expect(segments[0]).toMatchObject({ day: 6, startMin: 1320, endMin: 1410 });
  });
  it("lo que cae fuera de la semana no aparece", () => {
    expect(placeWeek([ev("a", "2026-03-09T09:00"), ev("b", "2026-03-01T09:00")], WEEK).segments).toEqual([]);
  });
});

describe("solapados lado a lado (U-188)", () => {
  it("tres eventos que coinciden usan tres carriles", () => {
    const { segments } = placeWeek([ev("a", "2026-03-02T09:00"), ev("b", "2026-03-02T09:30"), ev("c", "2026-03-02T09:15")], WEEK);
    expect(segments.map((s) => s.lanes)).toEqual([3, 3, 3]);
    expect(new Set(segments.map((s) => s.lane)).size).toBe(3);
  });
  it("eventos consecutivos (uno termina cuando empieza el otro) no se solapan", () => {
    const { segments } = placeWeek([ev("a", "2026-03-02T09:00"), ev("b", "2026-03-02T10:00")], WEEK);
    expect(segments.map((s) => [s.lane, s.lanes])).toEqual([[0, 1], [0, 1]]);
  });
  it("un carril libre se reutiliza dentro del mismo grupo", () => {
    const { segments } = placeWeek([ev("a", "2026-03-02T09:00", { durationMin: 180 }), ev("b", "2026-03-02T09:00", { durationMin: 30 }), ev("c", "2026-03-02T10:00", { durationMin: 30 })], WEEK);
    expect(Object.fromEntries(segments.map((s) => [s.id, s.lane]))).toEqual({ a: 0, b: 1, c: 1 });
    expect(segments.every((s) => s.lanes === 2)).toBe(true);
  });
  it("propiedad: ningún par solapado comparte día y carril (300 casos aleatorios)", () => {
    let seed = 7;
    const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
    for (let round = 0; round < 300; round++) {
      const n = 1 + Math.floor(rnd() * 12);
      const events = Array.from({ length: n }, (_, i) => {
        const day = 2 + Math.floor(rnd() * 3), h = Math.floor(rnd() * 22), m = Math.floor(rnd() * 4) * 15;
        return ev(`e${i}`, `2026-03-${String(day).padStart(2, "0")}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`, { durationMin: 15 * (1 + Math.floor(rnd() * 12)) });
      });
      const { segments } = placeWeek(events, WEEK);
      for (const a of segments) for (const b of segments) {
        if (a === b || a.day !== b.day) continue;
        const overlap = a.startMin < b.endMin && b.startMin < a.endMin;
        if (overlap) expect(a.lane, `${a.id}/${b.id}`).not.toBe(b.lane);
        expect(a.lane).toBeLessThan(a.lanes);
      }
    }
  });
});

describe("cruce de medianoche y varios días (U-189)", () => {
  it("23:00–01:00 se parte en dos segmentos continuos", () => {
    const { segments } = placeWeek([ev("n", "2026-03-04T23:00", { end: "2026-03-05T01:00" })], WEEK);
    expect(segments).toEqual([
      { id: "n", day: 2, startMin: 1380, endMin: 1440, lane: 0, lanes: 1, continuesBefore: false, continuesAfter: true },
      { id: "n", day: 3, startMin: 0, endMin: 60, lane: 0, lanes: 1, continuesBefore: true, continuesAfter: false },
    ]);
  });
  it("un evento de tres días ocupa tres columnas, con bordes continuos en medio", () => {
    const { segments } = placeWeek([ev("m", "2026-03-03T10:00", { end: "2026-03-05T16:00" })], WEEK);
    expect(segments.map((s) => [s.day, s.startMin, s.endMin, s.continuesBefore, s.continuesAfter])).toEqual([
      [1, 600, 1440, false, true], [2, 0, 1440, true, true], [3, 0, 960, true, false],
    ]);
  });
  it("terminar justo a medianoche no crea segmento vacío al día siguiente", () => {
    const { segments } = placeWeek([ev("n", "2026-03-04T22:00", { end: "2026-03-05T00:00" })], WEEK);
    expect(segments).toHaveLength(1);
    expect(segments[0]).toMatchObject({ day: 2, endMin: 1440, continuesAfter: false });
  });
  it("el cruce de la semana al lunes siguiente solo pinta lo que cae dentro", () => {
    const { segments } = placeWeek([ev("n", "2026-03-08T23:00", { end: "2026-03-09T02:00" })], WEEK);
    expect(segments).toHaveLength(1);
    expect(segments[0]).toMatchObject({ day: 6, continuesAfter: true });
  });
});

describe("«Todo el día» (U-190)", () => {
  it("fecha sin hora va a la franja de todo el día", () => {
    const r = placeWeek([ev("d", "2026-03-04")], WEEK);
    expect(r.segments).toEqual([]);
    expect(r.allDay).toEqual([{ id: "d", startDay: 2, endDay: 2, continuesBefore: false, continuesAfter: false }]);
  });
  it("un rango de fechas sin hora abarca varios días y se recorta a la semana", () => {
    const r = placeWeek([ev("d", "2026-03-07", { end: "2026-03-10" })], WEEK);
    expect(r.allDay).toEqual([{ id: "d", startDay: 5, endDay: 6, continuesBefore: false, continuesAfter: true }]);
  });
  it("una tarea con fecha y sin hora nunca aparece en la rejilla horaria", () => {
    expect(placeWeek([ev("d", "2026-03-04"), ev("t", "2026-03-04T09:00")], WEEK).segments.map((s) => s.id)).toEqual(["t"]);
  });
});
