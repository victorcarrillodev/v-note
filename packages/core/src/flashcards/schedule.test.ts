import { describe, it, expect } from "vitest";
import { cardState, isDue, reviewCard } from "./schedule";

const today = "2026-03-10";
const fresh = cardState({});

describe("repaso espaciado", () => {
  it("una tarjeta nueva toca hoy", () => {
    expect(fresh).toEqual({ due: "", interval: 0, ease: 2.5, reps: 0, last: "", lapses: 0, reviews: 0, days: "" });
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
    expect(cardState({ interval: "x", ease: -4, reps: "2", due: 5 })).toEqual({ due: "", interval: 0, ease: 2.5, reps: 2, last: "", lapses: 0, reviews: 2, days: "" });
  });

  it("cada repaso anota el día y los olvidos (study-features-2 T-5)", () => {
    const a = reviewCard(fresh, "good", today);
    expect([a.last, a.lapses]).toEqual([today, 0]);
    const b = reviewCard(a, "again", "2026-03-11");
    expect([b.last, b.lapses]).toEqual(["2026-03-11", 1]);
    const c = reviewCard(b, "again", "2026-03-11");
    expect(c.lapses).toBe(2);
    expect(reviewCard(c, "easy", "2026-03-12").lapses).toBe(2);
  });
  it("las propiedades de repaso dañadas se ignoran", () => {
    expect(cardState({ last: "ayer", lapses: -3 })).toMatchObject({ last: "", lapses: 0 });
    expect(cardState({ last: "2026-03-09", lapses: 4 })).toMatchObject({ last: "2026-03-09", lapses: 4 });
  });

  it("cuenta el total de repasos (reviews) sin importar los olvidos, y lee tarjetas viejas sin ese dato", () => {
    let s = fresh;
    for (let i = 0; i < 5; i++) s = reviewCard(s, "good", today);
    s = reviewCard(s, "again", today);
    expect([s.reps, s.lapses, s.reviews]).toEqual([0, 1, 6]);
    // una tarjeta guardada antes de existir `reviews`: se estima con lo que sí se sabía
    expect(cardState({ reps: 3, lapses: 2 }).reviews).toBe(5);
    expect(cardState({ reps: 3, lapses: 2, reviews: 10 }).reviews).toBe(10);
    expect(cardState({ reps: 3, lapses: 2, reviews: 1 }).reviews).toBe(5); // nunca menos de lo ya visto
  });
});
