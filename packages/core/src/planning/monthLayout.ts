import { toMinutes } from "./schedule";
import { eventEnd } from "./schedule";
import type { PlanEvent } from "./weekLayout";

/** Eventos sueltos visibles en una casilla antes de resumir el resto en «+N más». */
export const MAX_VISIBLE_PER_DAY = 3;
const DAY = 1440;
const pad = (n: number) => String(n).padStart(2, "0");
const dateOf = (min: number) => { const d = new Date(min * 60_000); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`; };

export type GridDay = { date: string; inMonth: boolean };

/** Rejilla del mes (semanas de lunes a domingo) con los días de los meses vecinos marcados como ajenos. */
export function monthGrid(month: string): GridDay[][] {
  const first = toMinutes(`${month}-01`);
  const dow = (new Date(first * 60_000).getUTCDay() + 6) % 7; // 0 = lunes
  const [y, m] = month.split("-").map(Number) as [number, number];
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const weeks = Math.ceil((dow + daysInMonth) / 7);
  const start = first - dow * DAY;
  return Array.from({ length: weeks }, (_, w) => Array.from({ length: 7 }, (_, d) => {
    const date = dateOf(start + (w * 7 + d) * DAY);
    return { date, inMonth: date.startsWith(month) };
  }));
}

export type DayCell = { shown: PlanEvent[]; more: number; all: PlanEvent[] };
export type MonthBar = { id: string; week: number; startCol: number; endCol: number; row: number; continuesBefore: boolean; continuesAfter: boolean };

/** Fecha de inicio y de fin (días) de un evento; fin inclusivo. Un fin exactamente a medianoche no cuenta el día siguiente. */
function span(e: PlanEvent): { first: number; last: number } {
  const first = toMinutes(e.start.slice(0, 10));
  if (!e.start.includes("T")) return { first, last: e.end ? toMinutes(e.end.slice(0, 10)) : first };
  const endMin = toMinutes(eventEnd(e));
  const lastDay = Math.floor((endMin - (endMin % DAY === 0 && endMin > toMinutes(e.start) ? 1 : 0)) / DAY) * DAY;
  return { first, last: Math.max(first, lastDay) };
}

/** Reparte los eventos en las casillas del mes: sueltos con «+N más» y barras para los que abarcan varios días (RF-7.1, CL-10, CL-12). */
export function layoutMonth(events: readonly PlanEvent[], month: string): { days: Map<string, DayCell>; bars: MonthBar[] } {
  const grid = monthGrid(month);
  const days = new Map<string, DayCell>();
  for (const w of grid) for (const d of w) days.set(d.date, { shown: [], more: 0, all: [] });
  const gridStart = toMinutes(grid[0]![0]!.date);
  const bars: MonthBar[] = [];
  const rowsUsed = new Map<number, boolean[][]>(); // semana → filas → columnas ocupadas

  const multi: { e: PlanEvent; first: number; last: number }[] = [];
  for (const e of events) {
    const { first, last } = span(e);
    if (last > first) multi.push({ e, first, last });
    else days.get(dateOf(first))?.all.push(e);
  }
  for (const c of days.values()) {
    c.all.sort((a, b) => a.start.localeCompare(b.start) || a.id.localeCompare(b.id));
    c.shown = c.all.slice(0, MAX_VISIBLE_PER_DAY);
    c.more = Math.max(0, c.all.length - MAX_VISIBLE_PER_DAY);
  }
  multi.sort((a, b) => a.first - b.first || b.last - a.last || a.e.id.localeCompare(b.e.id));
  for (const { e, first, last } of multi) {
    for (let w = 0; w < grid.length; w++) {
      const ws = gridStart + w * 7 * DAY, we = ws + 6 * DAY;
      if (last < ws || first > we) continue;
      const startCol = Math.max(0, Math.round((first - ws) / DAY)), endCol = Math.min(6, Math.round((last - ws) / DAY));
      const rows = rowsUsed.get(w) ?? [];
      let row = 0;
      while (rows[row]?.slice(startCol, endCol + 1).some(Boolean)) row++;
      rows[row] ??= Array(7).fill(false);
      for (let c = startCol; c <= endCol; c++) rows[row]![c] = true;
      rowsUsed.set(w, rows);
      bars.push({ id: e.id, week: w, startCol, endCol, row, continuesBefore: first < ws, continuesAfter: last > we });
    }
  }
  bars.sort((a, b) => a.week - b.week || a.row - b.row || a.startCol - b.startCol);
  return { days, bars };
}
