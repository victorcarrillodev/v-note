// study-features-2 T-5 (prueba primero): números de la vista Repaso.
import { describe, it, expect } from "vitest";
import { studyStats } from "./stats";
import { reviewCard } from "./schedule";
import type { CardState } from "./schedule";

const card = (over: Partial<CardState>): CardState => ({ due: "", interval: 0, ease: 2.5, reps: 0, last: "", lapses: 0, reviews: 0, days: "", ...over });
const today = "2026-03-10";

describe("estadísticas de repaso", () => {
  it("sin tarjetas todo es cero y la retención es null", () => {
    expect(studyStats([], today)).toEqual({ total: 0, due: 0, fresh: 0, learning: 0, mastered: 0, reviewedToday: 0, lapses: 0, retention: null });
  });
  it("cuenta pendientes, nuevas, aprendiendo, dominadas y repasadas hoy", () => {
    const cards = [
      card({}),                                                                    // nueva (y pendiente)
      card({ due: "2026-03-09", interval: 3, reps: 2, last: "2026-03-06" }),       // aprendiendo, pendiente
      card({ due: "2026-03-20", interval: 10, reps: 3, last: today }),             // aprendiendo, repasada hoy
      card({ due: "2026-04-30", interval: 40, reps: 6, last: "2026-03-01" }),      // dominada
    ];
    const s = studyStats(cards, today);
    expect([s.total, s.due, s.fresh, s.learning, s.mastered, s.reviewedToday]).toEqual([4, 2, 1, 2, 1, 1]);
  });
  it("la retención es el porcentaje de repasos que no fallaron: éxitos acumulados frente a olvidos", () => {
    const s = studyStats([card({ reps: 9, lapses: 1, reviews: 10, interval: 5, due: "2026-03-20", last: today }), card({ reps: 0, lapses: 0 })], today);
    expect(s.lapses).toBe(1);
    expect(s.retention).toBe(90);
  });
  it("una tarjeta con olvidos pero sin éxitos todavía cuenta como 0 % si hay repasos", () => {
    expect(studyStats([card({ reps: 0, lapses: 3, reviews: 3, last: today, due: today })], today).retention).toBe(0);
  });

  it("con repasos reales encadenados (5 aciertos y 1 olvido) la retención es 83 %, no 0 %", () => {
    let c = card({});
    for (let i = 0; i < 5; i++) c = reviewCard(c, "good", today);
    c = reviewCard(c, "again", today);
    expect(studyStats([c], today).retention).toBe(83);
  });
});
