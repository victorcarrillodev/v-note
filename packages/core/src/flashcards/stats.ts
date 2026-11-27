import { isDue, type CardState } from "./schedule";

/** Intervalo (en días) desde el que una tarjeta se considera dominada. */
export const MASTERED_DAYS = 21;

export type StudyStats = {
  total: number;
  /** Tocan hoy o están atrasadas (incluye las nuevas). */
  due: number;
  /** Nunca repasadas. */
  fresh: number;
  /** Ya repasadas pero con un intervalo corto. */
  learning: number;
  /** Intervalo de {@link MASTERED_DAYS} días o más. */
  mastered: number;
  reviewedToday: number;
  /** Olvidos acumulados. */
  lapses: number;
  /** Porcentaje de repasos sin olvido: (repasos − olvidos) / repasos, de toda la vida de las tarjetas; `null` sin repasos. */
  retention: number | null;
};

/** Números de la vista Repaso, calculados solo con el estado que ya viaja en cada tarjeta (sin historial aparte). */
export function studyStats(cards: readonly CardState[], today: string): StudyStats {
  let fresh = 0, learning = 0, mastered = 0, due = 0, reviewedToday = 0, lapses = 0, reviews = 0;
  for (const c of cards) {
    if (isDue(c, today)) due++;
    if (c.last === today) reviewedToday++;
    lapses += c.lapses;
    reviews += c.reviews;
    if (c.reps === 0 && c.last === "" && c.due === "") fresh++;
    else if (c.interval >= MASTERED_DAYS) mastered++;
    else learning++;
  }
  return { total: cards.length, due, fresh, learning, mastered, reviewedToday, lapses, retention: reviews === 0 ? null : Math.round(((reviews - lapses) / reviews) * 100) };
}
