import type { CardState } from "./schedule";


export type StudyStreak = {
  /** Días seguidos con repaso hasta hoy; si hoy aún no se repasa, hasta ayer. */
  current: number;
  /** La racha más larga entre los días guardados. */
  best: number;
};

const DAY_MS = 86_400_000;
const dayIndex = (day: string): number => Math.round(Date.parse(`${day}T00:00:00Z`) / DAY_MS);

/** Racha diaria: junta los días de repaso de todas las tarjetas (sin historial aparte; viaja con cada tarjeta). */
export function studyStreak(cards: readonly CardState[], today: string): StudyStreak {
  const days = new Set<number>();
  for (const c of cards) for (const d of c.days.split(",")) if (d) days.add(dayIndex(d));
  if (days.size === 0) return { current: 0, best: 0 };
  const sorted = [...days].sort((a, b) => a - b);
  let best = 1, run = 1;
  for (let i = 1; i < sorted.length; i++) { run = sorted[i] === sorted[i - 1]! + 1 ? run + 1 : 1; best = Math.max(best, run); }
  const t = dayIndex(today);
  let cursor = days.has(t) ? t : t - 1, current = 0;
  while (days.has(cursor)) { current++; cursor--; }
  return { current, best };
}
