import { describe, it, expect } from "vitest";
import { cardState, isDue, reviewCard } from "./schedule";

const today = "2026-03-10";
const fresh = cardState({});

describe("repaso espaciado", () => {
  it("una tarjeta nueva toca hoy", () => {
    expect(fresh).toEqual({ due: "", interval: 0, ease: 2.5, reps: 0 });
    expect(isDue(fresh, today)).toBe(true);
  });
  it("«bien» separa cada vez más los repasos", () => {
    const a = reviewCard(fresh, "good", today);
    expect([a.interval, a.due, a.reps]).toEqual([1, "2026-03-11", 1]);
    const b = reviewCard(a, "good", a.due);
    expect([b.interval, b.due]).toEqual([3, "2026-03-14"]);
    const c = reviewCard(b, "good", b.due);
    expect([c.interval, c.due]).toEqual([8, "2026-03-22"]);
    expect(isDue(c, "2026-03-21")).toBe(false);
    expect(isDue(c, "2026-03-22")).toBe(true);
  });
  it("«fácil» salta más y sube la facilidad", () => {
    const a = reviewCard(fresh, "easy", today);
    expect([a.interval, a.ease]).toEqual([4, 2.65]);
  });
  it("«otra vez» reinicia, deja la tarjeta para hoy y no baja la facilidad de 1.3", () => {
    let s = reviewCard(reviewCard(fresh, "good", today), "again", today);
    expect([s.reps, s.interval, s.due, s.ease]).toEqual([0, 0, today, 2.3]);
    for (let i = 0; i < 20; i++) s = reviewCard(s, "again", today);
    expect(s.ease).toBe(1.3);
  });
  it("tolera propiedades dañadas", () => {
    expect(cardState({ interval: "x", ease: -4, reps: "2", due: 5 })).toEqual({ due: "", interval: 0, ease: 2.5, reps: 2 });
  });
});
