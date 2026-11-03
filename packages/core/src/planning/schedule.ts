import { appError, err, ok, type Result } from "../result";
import { isValidLocal } from "../tasks/recurrence";

/** Duración que se asume cuando una tarea con hora no indica fin ni duración. */
export const DEFAULT_DURATION_MIN = 60;

export type EventSchedule = { start: string; end?: string; durationMin?: number };

const pad = (n: number, w = 2) => String(n).padStart(w, "0");
const hasTime = (v: string) => v.includes("T");

/** Minutos desde una referencia fija a una hora local flotante (sin zona: así un cambio de horario no mueve lo escrito). */
export function toMinutes(local: string): number {
  const [d, t = "00:00"] = local.split("T");
  const [y, mo, da] = d!.split("-").map(Number) as [number, number, number];
  const [h, mi] = t.split(":").map(Number) as [number, number];
  return Math.round(Date.UTC(y, mo - 1, da, h, mi) / 60_000);
}
export function fromMinutes(min: number): string {
  const d = new Date(min * 60_000);
  return `${pad(d.getUTCFullYear(), 4)}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

/** Fin efectivo del evento: el explícito, o inicio + duración (o la duración por omisión). */
export function eventEnd(s: EventSchedule): string {
  if (s.end !== undefined) return s.end;
  return fromMinutes(toMinutes(s.start) + (s.durationMin ?? DEFAULT_DURATION_MIN));
}

const invalid = (reason: string, message: string) => err(appError("INVALID", message, { reason }));

/** El fin no puede ser anterior (ni igual) al inicio y la duración debe ser un entero positivo (RF-8.3, CL-15). */
export function validateSchedule(s: EventSchedule): Result<EventSchedule> {
  if (!isValidLocal(s.start) || !hasTime(s.start)) return invalid("START", "La hora de inicio no es válida");
  if (s.durationMin !== undefined && (!Number.isInteger(s.durationMin) || s.durationMin <= 0)) return invalid("ZERO_DURATION", "La duración debe ser mayor que cero");
  if (s.end !== undefined) {
    if (!isValidLocal(s.end) || !hasTime(s.end)) return invalid("END", "La hora de fin no es válida");
    const span = toMinutes(s.end) - toMinutes(s.start);
    if (span < 0) return invalid("END_BEFORE_START", "La hora de fin no puede ser anterior al inicio");
    if (span === 0) return invalid("ZERO_DURATION", "El evento no puede durar cero minutos");
    if (s.durationMin !== undefined && s.durationMin !== span) return invalid("CONFLICT", "El fin y la duración no coinciden");
  }
  return ok(s);
}
