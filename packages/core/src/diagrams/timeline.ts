import { appError, err, ok, type Result } from "../result";
import { newId } from "../ids";
import { stableJson } from "../backup/stableJson";
import { isValidDateString } from "../databases/values";

export type TEvent = { id: string; date: string; title: string };
export type Timeline = { events: TEvent[] };
export const EVENT_W = 140, EVENT_H = 36, DAY_W = 6, LANE_GAP = 8;

export const emptyTimeline = (): Timeline => ({ events: [] });
const isDay = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && isValidDateString(s);
const badDate = () => err(appError("INVALID", "La fecha del evento no es válida (usa AAAA-MM-DD)", { reason: "DATE" }));

export function addEvent(t: Timeline, e: { date: string; title: string; id?: string }): Result<{ timeline: Timeline; event: TEvent }> {
  if (!isDay(e.date)) return badDate();
  const event: TEvent = { id: e.id ?? newId(), date: e.date, title: e.title };
  return ok({ timeline: { events: [...t.events, event] }, event });
}
export const renameEvent = (t: Timeline, id: string, title: string): Timeline => ({ events: t.events.map((e) => (e.id === id ? { ...e, title } : e)) });
export const deleteEvent = (t: Timeline, id: string): Timeline => ({ events: t.events.filter((e) => e.id !== id) });
export function moveEvent(t: Timeline, id: string, date: string): Result<Timeline> {
  if (!isDay(date)) return badDate();
  if (!t.events.some((e) => e.id === id)) return err(appError("NOT_FOUND", "El evento no existe", { id }));
  return ok({ events: t.events.map((e) => (e.id === id ? { ...e, date } : e)) });
}

/** Cronológico; los empates conservan el orden en que se agregaron (estable). */
export const sortedEvents = (t: Timeline): TEvent[] => t.events.map((e, i) => ({ e, i })).sort((a, b) => (a.e.date < b.e.date ? -1 : a.e.date > b.e.date ? 1 : a.i - b.i)).map((x) => x.e);

const dayNumber = (d: string) => Math.round(Date.parse(`${d}T00:00:00Z`) / 86_400_000);
/** Posición de cada evento: x según la fecha y el carril más bajo donde no choque con otro (CL-10: nunca se superponen). */
export function placeEvents(t: Timeline): { id: string; x: number; lane: number; y: number }[] {
  const sorted = sortedEvents(t);
  if (sorted.length === 0) return [];
  const origin = dayNumber(sorted[0]!.date);
  const laneEnd: number[] = [];
  return sorted.map((e) => {
    const x = (dayNumber(e.date) - origin) * DAY_W;
    let lane = laneEnd.findIndex((end) => end <= x);
    if (lane === -1) { lane = laneEnd.length; laneEnd.push(0); }
    laneEnd[lane] = x + EVENT_W + 4;
    return { id: e.id, x, lane, y: lane * (EVENT_H + LANE_GAP) };
  });
}

export const serializeTimeline = (t: Timeline): string => stableJson(t);
export function parseTimeline(text: string): Result<Timeline> {
  if (text.trim() === "") return ok(emptyTimeline());
  const bad = (m: string) => err(appError("INVALID", m, { reason: "TIMELINE" }));
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { return bad("La línea de tiempo está dañada"); }
  const events = (raw as { events?: unknown } | null)?.events;
  if (!Array.isArray(events)) return bad("La línea de tiempo no tiene el formato esperado");
  const ids = new Set<string>();
  for (const e of events as Partial<TEvent>[]) {
    if (!e || typeof e.id !== "string" || typeof e.title !== "string" || typeof e.date !== "string" || !isDay(e.date) || ids.has(e.id)) return bad("Un evento de la línea de tiempo es inválido");
    ids.add(e.id);
  }
  return ok({ events: events as TEvent[] });
}
export const timelineText = (t: Timeline): string => sortedEvents(t).map((e) => `${e.title} ${e.date}`.trim()).join("\n");
