import { addDays, addMonths, addYears } from "date-fns";
import { appError, err, ok, type Result } from "../result";

export const FREQUENCIES = ["daily", "weekly", "monthly", "yearly"] as const;
export type Frequency = (typeof FREQUENCIES)[number];
/** `anchor`: fecha original de la serie (opcional); se conserva mientras la serie siga, aunque se complete antes o después (CL-32). */
export type Recurrence = { freq: Frequency; interval: number; anchor?: string };

const LOCAL = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/;

/** Fecha (AAAA-MM-DD) u hora local flotante (AAAA-MM-DDTHH:mm) real. Sin zona horaria: es la hora que la persona quiso (CL-13). */
export function isValidLocal(v: string): boolean {
  const m = LOCAL.exec(v);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const t = new Date(y, mo - 1, d, 12);
  if (t.getFullYear() !== y || t.getMonth() !== mo - 1 || t.getDate() !== d) return false;
  return m[4] === undefined || (Number(m[4]) < 24 && Number(m[5]) < 60);
}

export function validateRecurrence(raw: unknown): Result<Recurrence> {
  if (!raw || typeof raw !== "object") return err(appError("INVALID", "La repetición no es válida", { reason: "RECURRENCE" }));
  const { freq, interval, anchor } = raw as { freq?: unknown; interval?: unknown; anchor?: unknown };
  if (typeof freq !== "string" || !FREQUENCIES.includes(freq as Frequency)) return err(appError("INVALID", "La frecuencia debe ser diaria, semanal, mensual o anual", { reason: "RECURRENCE" }));
  const n = interval === undefined ? 1 : interval;
  if (typeof n !== "number" || !Number.isInteger(n) || n < 1 || n > 366) return err(appError("INVALID", "El intervalo debe ser un entero entre 1 y 366", { reason: "RECURRENCE" }));
  if (anchor !== undefined && (typeof anchor !== "string" || !isValidLocal(anchor))) return err(appError("INVALID", "La fecha original de la repetición no es válida", { reason: "RECURRENCE" }));
  return ok({ freq: freq as Frequency, interval: n, ...(anchor !== undefined ? { anchor } : {}) });
}

const pad = (n: number, w = 2) => String(n).padStart(w, "0");
/** La fecha se calcula al mediodía local para que un cambio de horario nunca mueva el día; la hora original se vuelve a pegar tal cual. */
function split(v: string): { date: Date; time: string | null } {
  const m = LOCAL.exec(v)!;
  return { date: new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12), time: m[4] === undefined ? null : `${m[4]}:${m[5]}` };
}
const join = (d: Date, time: string | null) => `${pad(d.getFullYear(), 4)}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}${time ? `T${time}` : ""}`;

/** Ocurrencia n-ésima de la serie (n = 0 es la ancla). Siempre se calcula desde la ancla: el día 31 vuelve a ser 31 cuando el mes lo permite (CL-25). */
export function occurrence(anchor: string, rule: Recurrence, n: number): string {
  const { date, time } = split(anchor);
  const k = n * rule.interval;
  const d = rule.freq === "daily" ? addDays(date, k) : rule.freq === "weekly" ? addDays(date, 7 * k) : rule.freq === "monthly" ? addMonths(date, k) : addYears(date, k);
  return join(d, time);
}

/** Primera ocurrencia estrictamente posterior a `after` (si `after` es anterior a la ancla, la propia ancla). */
export function nextAfter(anchor: string, rule: Recurrence, after: string): string {
  if (anchor > after) return anchor;
  // Salto aproximado por días para no recorrer series largas una a una, y ajuste fino
  const days = Math.max(0, Math.floor((split(after.length === 10 ? after : after.slice(0, 10)).date.getTime() - split(anchor).date.getTime()) / 86_400_000));
  const per = rule.freq === "daily" ? rule.interval : rule.freq === "weekly" ? 7 * rule.interval : rule.freq === "monthly" ? 28 * rule.interval : 365 * rule.interval;
  let n = Math.max(0, Math.floor(days / (per + (rule.freq === "monthly" ? 3 * rule.interval : rule.freq === "yearly" ? rule.interval : 0))) - 1);
  while (occurrence(anchor, rule, n) <= after) n++;
  return occurrence(anchor, rule, n);
}

/**
 * Al completar una tarea recurrente, la siguiente se programa a partir de la ocurrencia vigente (la fecha original),
 * no de cuándo se cerró: completarla antes o después no desplaza la serie (CL-32).
 */
export function nextOnCompletion(anchor: string, rule: Recurrence, current: string): string {
  return nextAfter(anchor, rule, current);
}

export type Schedule = { due: string | null; remindAt: string | null; recurrence: Recurrence | null };

/**
 * Siguiente repetición de una tarea recurrente: avanza la fecha límite y el aviso juntos por la serie, que se calcula
 * siempre desde su ancla (la fecha original, CL-32 y CL-25). `null` si la tarea no se repite.
 */
export function advanceSchedule(s: Schedule): Schedule | null {
  if (!s.recurrence || (!s.due && !s.remindAt)) return null;
  const primary = (s.remindAt ?? s.due)!;
  const rule: Recurrence = { ...s.recurrence, anchor: s.recurrence.anchor ?? primary };
  const nextPrimary = nextAfter(rule.anchor!, rule, primary);
  const dayDelta = s.due && s.remindAt ? Math.round((Date.parse(`${s.due.slice(0, 10)}T12:00:00Z`) - Date.parse(`${s.remindAt.slice(0, 10)}T12:00:00Z`)) / 86_400_000) : 0;
  const shiftDay = (d: string) => new Date(Date.parse(`${d.slice(0, 10)}T12:00:00Z`) + dayDelta * 86_400_000).toISOString().slice(0, 10);
  return {
    remindAt: s.remindAt ? nextPrimary : null,
    due: s.due ? (s.remindAt ? shiftDay(nextPrimary) : nextPrimary) : null,
    recurrence: rule,
  };
}

