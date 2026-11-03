import { toMinutes } from "./schedule";

/** Posición de «ahora» en la semana que empieza en `weekStart`, según el desfase de zona VIGENTE en este momento (minutos respecto de UTC). */
export function nowPosition(utcMs: number, offsetMinutes: number, weekStart: string): { day: number; minute: number } | null {
  const local = Math.floor(utcMs / 60_000) + offsetMinutes;
  const rel = local - toMinutes(weekStart);
  if (rel < 0 || rel >= 7 * 1440) return null;
  return { day: Math.floor(rel / 1440), minute: rel % 1440 };
}
