// backlog-b7-b11 T-1 (prueba primero): racha diaria de repaso a partir de los días guardados en cada tarjeta.
import { describe, it, expect } from "vitest";
import { cardState, reviewCard, MAX_DAYS_KEPT, type CardState } from "./schedule";
import { studyStreak } from "./streak";

const card = (days: string): CardState => ({ ...cardState({}), days });
const today = "2026-03-10";

describe("días de repaso guardados en la tarjeta", () => {
  it("una tarjeta nueva no tiene días", () => {
    expect(cardState({}).days).toBe("");
  });
  it("al repasar se añade el día de hoy; repasar dos veces el mismo día no lo duplica", () => {
    const once = reviewCard(cardState({}), "good", "2026-03-09");
    const twice = reviewCard(once, "again", "2026-03-09");
    const next = reviewCard(twice, "good", today);
    expect(once.days).toBe("2026-03-09");
    expect(twice.days).toBe("2026-03-09");
    expect(next.days).toBe("2026-03-09,2026-03-10");
  });
  it("lee solo fechas válidas, sin repetidas y ordenadas; ignora basura", () => {
    expect(cardState({ days: "2026-03-10,hola,2026-03-08,2026-03-10,5" }).days).toBe("2026-03-08,2026-03-10");
    expect(cardState({ days: 42 }).days).toBe("");
  });
  it("guarda como mucho los últimos MAX_DAYS_KEPT días", () => {
    let s = cardState({});
    const base = Date.UTC(2026, 0, 1);
    for (let i = 0; i < MAX_DAYS_KEPT + 10; i++) s = reviewCard(s, "again", new Date(base + i * 86400000).toISOString().slice(0, 10));
    const kept = s.days.split(",");
    expect(kept).toHaveLength(MAX_DAYS_KEPT);
    expect(kept[kept.length - 1]).toBe(new Date(base + (MAX_DAYS_KEPT + 9) * 86400000).toISOString().slice(0, 10));
  });
});

describe("racha diaria", () => {
  it("sin repasos la racha es 0", () => {
    expect(studyStreak([], today)).toEqual({ current: 0, best: 0 });
    expect(studyStreak([card("")], today)).toEqual({ current: 0, best: 0 });
  });
  it("cuenta los días seguidos hasta hoy, juntando los días de todas las tarjetas", () => {
    const cards = [card("2026-03-08,2026-03-10"), card("2026-03-09")];
    expect(studyStreak(cards, today)).toEqual({ current: 3, best: 3 });
  });
  it("si hoy aún no se repasa pero ayer sí, la racha sigue viva", () => {
    expect(studyStreak([card("2026-03-08,2026-03-09")], today).current).toBe(2);
  });
  it("un día sin repasar la rompe, pero la mejor racha se conserva", () => {
    const s = studyStreak([card("2026-03-01,2026-03-02,2026-03-03,2026-03-04,2026-03-07")], today);
    expect(s).toEqual({ current: 0, best: 4 });
  });
  it("cruza el cambio de mes y de año", () => {
    expect(studyStreak([card("2025-12-30,2025-12-31,2026-01-01")], "2026-01-01").current).toBe(3);
  });
});
