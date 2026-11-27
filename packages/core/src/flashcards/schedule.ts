/** Repaso espaciado (SM-2 simplificado). El estado vive en las propiedades del bloque: viaja con la página en respaldos y exportaciones. */
export type CardState = {
  due: string; interval: number; ease: number;
  /** Aciertos seguidos desde el último olvido. */
  reps: number;
  /** Día (`AAAA-MM-DD`) del último repaso; vacío si nunca se repasó. */
  last: string;
  /** Veces que se olvidó («otra vez») en toda su vida. */
  lapses: number;
  /** Total de repasos en toda su vida (aciertos y olvidos): base de la retención. */
  reviews: number;
  /** Días (`AAAA-MM-DD`, separados por coma, del más viejo al más nuevo) en que se repasó: base de la racha. Solo los últimos {@link MAX_DAYS_KEPT}. */
  days: string;
};
export type Grade = "again" | "good" | "easy";

const MIN_EASE = 1.3, DEFAULT_EASE = 2.5;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
/** Días de repaso que conserva cada tarjeta (los más recientes). */
export const MAX_DAYS_KEPT = 60;

function cleanDays(v: unknown, add?: string): string {
  const list = typeof v === "string" ? v.split(",") : [];
  if (add) list.push(add);
  return [...new Set(list.filter((d) => DATE.test(d)))].sort().slice(-MAX_DAYS_KEPT).join(",");
}

export function cardState(props: Record<string, unknown>): CardState {
  const num = (v: unknown) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : 0);
  const ease = num(props.ease);
  return {
    due: typeof props.due === "string" && DATE.test(props.due) ? props.due : "",
    interval: num(props.interval),
    ease: ease >= MIN_EASE ? ease : DEFAULT_EASE,
    reps: num(props.reps),
    last: typeof props.last === "string" && DATE.test(props.last) ? props.last : "",
    lapses: Math.floor(num(props.lapses)),
    // Las tarjetas guardadas antes de existir este dato se estiman con lo que sí se sabía; nunca menos de lo ya visto.
    reviews: Math.max(Math.floor(num(props.reviews)), Math.floor(num(props.reps)) + Math.floor(num(props.lapses))),
    days: cleanDays(props.days),
  };
}

/** `today` y `due` son fechas locales `AAAA-MM-DD`. Sin fecha = nunca repasada. */
export const isDue = (s: CardState, today: string): boolean => s.due === "" || s.due <= today;

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function reviewCard(s: CardState, grade: Grade, today: string): CardState {
  const round = (n: number) => Math.round(n * 100) / 100;
  if (grade === "again") return { due: today, interval: 0, ease: Math.max(MIN_EASE, round(s.ease - 0.2)), reps: 0, last: today, lapses: s.lapses + 1, reviews: s.reviews + 1, days: cleanDays(s.days, today) };
  const ease = grade === "easy" ? round(s.ease + 0.15) : s.ease;
  const interval = grade === "easy"
    ? (s.reps === 0 ? 4 : Math.round(Math.max(1, s.interval) * ease * 1.3))
    : (s.reps === 0 ? 1 : s.reps === 1 ? 3 : Math.round(s.interval * ease));
  return { due: addDays(today, interval), interval, ease, reps: s.reps + 1, last: today, lapses: s.lapses, reviews: s.reviews + 1, days: cleanDays(s.days, today) };
}
