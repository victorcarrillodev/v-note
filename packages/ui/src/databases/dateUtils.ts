import type { DateValue } from "@vnote/core";

const pad = (n: number, w = 2) => String(n).padStart(w, "0");
const parts = (iso: string) => { const [y, m, d] = iso.slice(0, 10).split("-").map(Number) as [number, number, number]; return { y, m, d }; };
const toUtc = (iso: string) => { const { y, m, d } = parts(iso); return Date.UTC(y, m - 1, d); };

export const dayOf = (iso: string) => iso.slice(0, 10);
const fmt = (ms: number) => { const t = new Date(ms); return `${pad(t.getUTCFullYear(), 4)}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`; };

/** Suma días a una fecha o fecha-hora local, conservando la hora si la tenía. */
export function addDaysIso(iso: string, n: number): string {
  return fmt(toUtc(iso) + n * 86_400_000) + iso.slice(10);
}
/** Días de `a` a `b` (solo cuenta la parte de fecha). */
export const daysBetween = (a: string, b: string): number => Math.round((toUtc(b) - toUtc(a)) / 86_400_000);

/** Semanas (lunes a domingo) completas que cubren el mes. `month` va de 1 a 12. */
export function monthMatrix(year: number, month: number): string[][] {
  const first = Date.UTC(year, month - 1, 1);
  const dow = (new Date(first).getUTCDay() + 6) % 7; // lunes = 0
  const start = first - dow * 86_400_000;
  const last = Date.UTC(year, month, 0);
  const weeks: string[][] = [];
  for (let t = start; t <= last || weeks.at(-1)!.length < 7; ) {
    const w: string[] = [];
    for (let i = 0; i < 7; i++, t += 86_400_000) w.push(fmt(t));
    weeks.push(w);
    if (t > last) break;
  }
  return weeks;
}
export const monthLabelKey = (month: number) => `databases.month.${month}`;

type Range = Pick<DateValue, "start" | "end"> & Record<string, unknown>;
/** Mueve una fecha o rango `delta` días (inicio y fin juntos). */
export function shiftRange<T extends Range>(v: T, delta: number): T {
  return { ...v, start: addDaysIso(v.start, delta), ...(v.end ? { end: addDaysIso(v.end, delta) } : {}) };
}
/** Cambia solo el final; si no había, lo crea a partir del inicio. Nunca queda antes del inicio. */
export function resizeRange<T extends Range>(v: T, delta: number): T {
  const end = addDaysIso(v.end ?? v.start, delta);
  return { ...v, end: end < v.start ? v.start : end };
}
