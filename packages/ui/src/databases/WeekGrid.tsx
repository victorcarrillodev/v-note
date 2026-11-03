import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { groupCrowded, nowPosition, placeWeek, type PlanEvent } from "@vnote/core";
import { Popover } from "../components/Popover";

/** Altura de una hora en la rejilla; el contenedor mide 24 × este valor. */
export const HOUR_PX = 48;
/** Carriles máximos antes de agrupar el resto con acceso al detalle (CL-11). */
export const MAX_LANES = 4;

const pad = (n: number) => String(n).padStart(2, "0");
const dayDate = (weekStart: string, d: number) => { const t = new Date(Date.parse(`${weekStart}T00:00:00Z`) + d * 86_400_000); return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`; };
const hhmm = (min: number) => `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;

/** Calendario semanal por horas: eje horario, franja «Todo el día», línea de «ahora» y eventos por hora y duración (RF-7.2 a RF-7.4). */
export function WeekGrid({ events, weekStart, now, offsetMinutes, onOpen, onCreateAt }: {
  events: readonly PlanEvent[]; weekStart: string; now: () => number; offsetMinutes: number;
  onOpen: (id: string) => void; onCreateAt: (date: string, minute: number) => void;
}) {
  const { t, i18n } = useTranslation();
  const [tick, setTick] = useState(0);
  useEffect(() => { const id = setInterval(() => setTick((n) => n + 1), 60_000); return () => clearInterval(id); }, []);
  void tick;
  const placement = useMemo(() => placeWeek(events, weekStart), [events, weekStart]);
  const { visible, groups } = useMemo(() => groupCrowded(placement.segments, MAX_LANES), [placement]);
  const title = new Map(events.map((e) => [e.id, e.title]));
  const line = nowPosition(now(), offsetMinutes, weekStart);
  const dayName = (d: number) => new Intl.DateTimeFormat(i18n.language, { weekday: "short", day: "numeric", timeZone: "UTC" }).format(Date.parse(`${dayDate(weekStart, d)}T00:00:00Z`));

  return (
    <div role="grid" aria-label={t("calendar.grid")} className="flex flex-col border border-[var(--c-border)] text-[length:var(--text-ui-small-size)]">
      <div role="row" className="grid grid-cols-[3.5rem_repeat(7,minmax(0,1fr))] border-b border-[var(--c-border)] bg-[var(--c-raised)]">
        <span role="columnheader" className="sr-only">{t("calendar.hour")}</span>
        {Array.from({ length: 7 }, (_, d) => <div key={d} role="columnheader" className="border-l border-[var(--c-border)] px-1 py-1 text-center font-semibold capitalize">{dayName(d)}</div>)}
      </div>
      <div role="row" className="grid grid-cols-[3.5rem_repeat(7,minmax(0,1fr))] border-b border-[var(--c-border)]">
        <div role="rowheader" className="px-1 py-1 text-[var(--c-text-muted)]">{t("calendar.allDay")}</div>
        <div role="gridcell" className="col-span-7"><div role="group" aria-label={t("calendar.allDay")} className="grid grid-cols-7 gap-y-0.5 py-0.5">
          {placement.allDay.map((b) => (
            <button key={b.id} type="button" onClick={() => onOpen(b.id)} style={{ gridColumn: `${b.startDay + 1} / span ${b.endDay - b.startDay + 1}` }} className="mx-0.5 truncate rounded bg-[var(--chip-info-bg)] px-2 text-left text-[var(--chip-info-fg)]">{title.get(b.id)}</button>
          ))}
        </div></div>
      </div>
      <div role="row" className="relative grid grid-cols-[3.5rem_repeat(7,minmax(0,1fr))]" style={{ height: 24 * HOUR_PX }}>
        <div role="rowheader" aria-label={t("calendar.hour")} className="relative">
          {Array.from({ length: 24 }, (_, h) => <span key={h} data-hour={h} className="absolute right-1 -translate-y-1/2 text-[var(--c-text-muted)]" style={{ top: `${(h / 24) * 100}%` }}>{h === 0 ? "" : `${pad(h)}:00`}</span>)}
        </div>
        {Array.from({ length: 7 }, (_, d) => (
          <div key={d} role="gridcell" aria-label={dayName(d)} className="relative border-l border-[var(--c-border)]">
            {Array.from({ length: 24 }, (_, h) => (
              <div key={h} data-slot={`${dayDate(weekStart, d)}T${pad(h)}:00`} onClick={() => onCreateAt(dayDate(weekStart, d), h * 60)} className="absolute inset-x-0 border-t border-[var(--c-border)]" style={{ top: `${(h / 24) * 100}%`, height: `${100 / 24}%` }} />
            ))}
            {visible.filter((s) => s.day === d).map((s, i) => (
              <div key={`${s.id}:${i}`} data-event data-start-min={s.startMin} data-end-min={s.endMin} data-lanes={s.lanes} data-continues-before={s.continuesBefore} data-continues-after={s.continuesAfter}
                className={`absolute overflow-hidden border border-[var(--c-card)] bg-[var(--chip-info-bg)] px-1 text-[var(--chip-info-fg)] ${s.continuesBefore ? "rounded-t-none" : "rounded-t"} ${s.continuesAfter ? "rounded-b-none" : "rounded-b"}`}
                style={{ top: `${(s.startMin / 1440) * 100}%`, height: `${((s.endMin - s.startMin) / 1440) * 100}%`, left: `${(s.lane / s.lanes) * 100}%`, width: `${100 / s.lanes}%` }}>
                <button type="button" onClick={() => onOpen(s.id)} className="block w-full truncate text-left" aria-label={`${title.get(s.id)} ${hhmm(s.startMin)}–${hhmm(s.endMin)}`}>{title.get(s.id)}</button>
              </div>
            ))}
            {groups.filter((g) => g.day === d).map((g, i) => (
              <div key={i} className="absolute right-0 z-[1]" style={{ top: `${(g.startMin / 1440) * 100}%` }}>
                <Popover trigger={<button type="button" className="rounded bg-[var(--c-raised)] px-1 text-[var(--c-accent)]">{t("calendar.moreSimultaneous", { count: g.ids.length })}</button>}>
                  <ul aria-label={t("calendar.simultaneous")} className="flex flex-col gap-1">
                    {g.ids.map((id) => <li key={id}><button type="button" className="w-full truncate text-left" onClick={() => onOpen(id)}>{title.get(id)}</button></li>)}
                  </ul>
                </Popover>
              </div>
            ))}
            {line && line.day === d && <div data-now-line data-day={line.day} data-minute={line.minute} aria-hidden="true" className="pointer-events-none absolute inset-x-0 z-[2] h-0.5 bg-[var(--c-accent)]" style={{ top: `${(line.minute / 1440) * 100}%` }} />}
          </div>
        ))}
      </div>
    </div>
  );
}
