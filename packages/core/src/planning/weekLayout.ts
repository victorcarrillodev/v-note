import { toMinutes, eventEnd } from "./schedule";

export type PlanEvent = { id: string; title: string; start: string; end?: string; durationMin?: number };
export type Segment = { id: string; day: number; startMin: number; endMin: number; lane: number; lanes: number; continuesBefore: boolean; continuesAfter: boolean };
export type AllDayBar = { id: string; startDay: number; endDay: number; continuesBefore: boolean; continuesAfter: boolean };
export type WeekPlacement = { segments: Segment[]; allDay: AllDayBar[] };

const DAY = 1440;
const dayIndex = (dateMin: number, weekStartMin: number) => Math.floor((dateMin - weekStartMin) / DAY);

/** Asigna carriles a los segmentos de un día: los que se tocan en cadena forman un grupo y se reparten el ancho. */
function assignLanes(day: Segment[]): void {
  const sorted = [...day].sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin || a.id.localeCompare(b.id));
  let cluster: Segment[] = [];
  let clusterEnd = -1;
  const flush = () => { const lanes = Math.max(0, ...cluster.map((s) => s.lane + 1)); for (const s of cluster) s.lanes = lanes; cluster = []; };
  for (const s of sorted) {
    if (cluster.length && s.startMin >= clusterEnd) { flush(); clusterEnd = -1; }
    const used = new Set(cluster.filter((c) => c.endMin > s.startMin).map((c) => c.lane));
    let lane = 0;
    while (used.has(lane)) lane++;
    s.lane = lane;
    cluster.push(s);
    clusterEnd = Math.max(clusterEnd, s.endMin);
  }
  flush();
}

/**
 * Coloca los eventos en la semana que empieza en `weekStart` (AAAA-MM-DD, lunes):
 * - con hora: segmentos por día (se parten al cruzar medianoche) con carriles para los solapados;
 * - sin hora: barras de «Todo el día» recortadas a la semana (RF-7.2, RF-7.3, RF-7.4, CL-11, CL-12, CL-13).
 */
export function placeWeek(events: readonly PlanEvent[], weekStart: string): WeekPlacement {
  const w0 = toMinutes(weekStart);
  const w1 = w0 + 7 * DAY;
  const segments: Segment[] = [];
  const allDay: AllDayBar[] = [];

  for (const e of events) {
    if (!e.start.includes("T")) {
      const s = toMinutes(e.start);
      const endDate = e.end ? toMinutes(e.end.slice(0, 10)) : s;
      if (endDate < w0 || s >= w1) continue;
      allDay.push({ id: e.id, startDay: Math.max(0, dayIndex(s, w0)), endDay: Math.min(6, dayIndex(endDate, w0)), continuesBefore: s < w0, continuesAfter: endDate >= w1 });
      continue;
    }
    const s = toMinutes(e.start);
    const f = toMinutes(eventEnd(e));
    if (f <= w0 || s >= w1) continue;
    for (let d = Math.max(0, dayIndex(s, w0)); d <= 6; d++) {
      const dayStart = w0 + d * DAY, dayEnd = dayStart + DAY;
      if (dayStart >= f) break;
      const from = Math.max(s, dayStart), to = Math.min(f, dayEnd);
      if (to <= from) continue;
      segments.push({ id: e.id, day: d, startMin: from - dayStart, endMin: to - dayStart, lane: 0, lanes: 1, continuesBefore: s < dayStart, continuesAfter: f > dayEnd });
    }
  }
  for (let d = 0; d < 7; d++) assignLanes(segments.filter((x) => x.day === d));
  segments.sort((a, b) => a.day - b.day || a.startMin - b.startMin || a.id.localeCompare(b.id));
  return { segments, allDay };
}

export type CrowdGroup = { day: number; startMin: number; endMin: number; ids: string[] };

/** Si en un mismo momento coinciden más de `maxLanes` eventos, deja visibles `maxLanes − 1` y agrupa el resto con acceso al detalle (RF-7.3, CL-11). */
export function groupCrowded(segments: readonly Segment[], maxLanes: number): { visible: Segment[]; groups: CrowdGroup[] } {
  const visible: Segment[] = [];
  const groups: CrowdGroup[] = [];
  const crowded = segments.filter((s) => s.lanes > maxLanes);
  const keep = maxLanes - 1;
  for (const s of segments) if (s.lanes <= maxLanes) visible.push(s);
  const sorted = [...crowded].sort((a, b) => a.day - b.day || a.startMin - b.startMin || a.lane - b.lane);
  let cur: Segment[] = [];
  let curEnd = -1;
  const close = () => {
    if (!cur.length) return;
    const shown = cur.filter((s) => s.lane < keep).map((s) => ({ ...s, lanes: maxLanes }));
    const hidden = cur.filter((s) => s.lane >= keep);
    visible.push(...shown);
    groups.push({ day: cur[0]!.day, startMin: Math.min(...hidden.map((s) => s.startMin)), endMin: Math.max(...hidden.map((s) => s.endMin)), ids: hidden.map((s) => s.id) });
    cur = []; curEnd = -1;
  };
  for (const s of sorted) {
    if (cur.length && (s.day !== cur[0]!.day || s.startMin >= curEnd)) close();
    cur.push(s); curEnd = Math.max(curEnd, s.endMin);
  }
  close();
  visible.sort((a, b) => a.day - b.day || a.startMin - b.startMin || a.lane - b.lane);
  return { visible, groups };
}
