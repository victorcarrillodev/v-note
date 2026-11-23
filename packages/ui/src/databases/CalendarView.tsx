import { useMemo, useState } from "react";
import { DndContext, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { useTranslation } from "react-i18next";
import { layoutMonth, type PlanEvent, type Property, type QueryRow } from "@vnote/core";
import { TaskScheduleDialog } from "../schedule/TaskScheduleDialog";
import { WeekGrid } from "./WeekGrid";
import { Popover } from "../components/Popover";
import type { DatabaseController } from "./databaseController";
import { addDaysIso, dayOf, daysBetween, monthMatrix, shiftRange } from "./dateUtils";
import { dateOf, dateProperty, titleOf } from "./viewHelpers";
import { useDatabase } from "./useDatabase";
import { EmptyState } from "../empty/EmptyState";
import { DateInput } from "../components/DateInput";

/** Vista calendario (mes): las filas en su día; arrastrar a otro día cambia la fecha (T-273, T-274). */
export function CalendarView({ controller, today, onOpenRow, now = () => Date.now(), offsetMinutes = -new Date().getTimezoneOffset(), onCreateAt }: { controller: DatabaseController; today: string; onOpenRow?: (pageId: string) => void; now?: () => number; offsetMinutes?: number; onCreateAt?: (date: string, minute: number) => void }) {
  const { t, i18n } = useTranslation();
  const snap = useDatabase(controller);
  const prop = dateProperty(snap);
  const rows = snap.result?.rows ?? [];
  const [anchor, setAnchor] = useState(today);
  const [creating, setCreating] = useState<{ date: string; startTime: string } | null>(null);
  const [mode, setMode] = useState<"month" | "week">("month");
  const cursor = { y: Number(anchor.slice(0, 4)), m: Number(anchor.slice(5, 7)) };
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const weeks = useMemo(() => monthMatrix(cursor.y, cursor.m), [cursor]);
  const lang = i18n.language;
  const monthTitle = new Intl.DateTimeFormat(lang, { month: "long", year: "numeric", timeZone: "UTC" }).format(Date.UTC(cursor.y, cursor.m - 1, 1));
  const dayLabel = (iso: string) => new Intl.DateTimeFormat(lang, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(Date.parse(`${iso}T00:00:00Z`));
  const byDay = new Map<string, QueryRow[]>();
  const undated: QueryRow[] = [];
  for (const r of rows) {
    const d = dateOf(r, prop);
    if (!d) { undated.push(r); continue; }
    const k = dayOf(d.start);
    byDay.set(k, [...(byDay.get(k) ?? []), r]);
  }
  const monthKey = `${cursor.y}-${String(cursor.m).padStart(2, "0")}`;
  const events: PlanEvent[] = useMemo(() => rows.flatMap((r) => { const d = dateOf(r, prop); return d ? [{ id: r.pageId, title: titleOf(r, t("databases.untitled")), start: d.start, ...(d.end ? { end: d.end } : {}) }] : []; }), [rows, prop, t]);
  const month = useMemo(() => layoutMonth(events, monthKey), [events, monthKey]);
  const rowById = new Map(rows.map((r) => [r.pageId, r]));
  const stepMonth = (n: number) => { const t0 = cursor.m - 1 + n; const y = cursor.y + Math.floor(t0 / 12), m = ((t0 % 12) + 12) % 12 + 1; setAnchor(`${y}-${String(m).padStart(2, "0")}-01`); };
  const weekStart = addDaysIso(anchor, -((new Date(`${anchor}T00:00:00Z`).getUTCDay() + 6) % 7));
  const step = (n: number) => (mode === "month" ? stepMonth(n) : setAnchor(addDaysIso(anchor, 7 * n)));

  const move = (row: QueryRow, toDay: string) => {
    if (!prop) return;
    const cur = dateOf(row, prop);
    if (!cur) { void controller.setCell(row.pageId, prop.id, { start: toDay }); return; }
    const delta = daysBetween(cur.start, toDay);
    if (delta !== 0) void controller.setCell(row.pageId, prop.id, shiftRange(cur, delta));
  };
  const onDragEnd = (e: DragEndEvent) => {
    const over = e.over && String(e.over.id);
    if (!over?.startsWith("day:")) return;
    const row = rows.find((r) => r.pageId === String(e.active.id).slice(4));
    if (row) move(row, over.slice(4));
  };

  if (!prop) return <p className="opacity-70">{t("databases.noDateProp")}</p>;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <button type="button" aria-label={t(mode === "month" ? "databases.prevMonth" : "databases.prevWeek")} onClick={() => step(-1)}>‹</button>
        <h2 className="min-w-40 text-center text-lg font-semibold capitalize-first">{monthTitle}</h2>
        <button type="button" aria-label={t(mode === "month" ? "databases.nextMonth" : "databases.nextWeek")} onClick={() => step(1)}>›</button>
        <button type="button" onClick={() => setAnchor(today)}>{t("databases.today")}</button>
        <span className="flex-1" />
        <div role="group" aria-label={t("calendar.mode")} className="inline-flex overflow-hidden rounded-md bg-[var(--c-raised)]">
          {(["month", "week"] as const).map((m) => <button key={m} type="button" aria-pressed={mode === m} onClick={() => setMode(m)} className={`px-3 py-1 ${mode === m ? "bg-[var(--c-accent)] text-[var(--c-on-accent)]" : ""}`}>{t(`calendar.${m}`)}</button>)}
        </div>
      </div>
      {rows.length === 0 && <EmptyState illustration="table" title={t("databases.empty")} />}
      {mode === "week" ? <WeekGrid events={events} weekStart={weekStart} now={now} offsetMinutes={offsetMinutes} onOpen={(id) => onOpenRow?.(id)} onCreateAt={(d, m) => { onCreateAt?.(d, m); setCreating({ date: d, startTime: `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}` }); }} /> : (
      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <div role="grid" aria-label={monthTitle} className="flex flex-col border-l border-t border-[var(--c-border)] text-[length:var(--text-ui-small-size)]">
          <div role="row" className="grid grid-cols-7">
            {(t("databases.weekday", { returnObjects: true }) as string[]).map((w) => <div key={w} role="columnheader" className="border-b border-r border-[var(--c-border)] bg-[var(--c-raised)] px-1 py-1 text-center font-semibold">{w}</div>)}
          </div>
          {weeks.map((week, wi) => {
            const bars = month.bars.filter((b) => b.week === wi);
            const barRows = bars.reduce((n, b) => Math.max(n, b.row + 1), 0);
            return (
              <div key={week[0]} role="rowgroup" className="relative">
                <div role="row" className="grid grid-cols-7">
                  {week.map((d) => {
                    const cellData = month.days.get(d);
                    return (
                      <Day key={d} iso={d} label={dayLabel(d)} inMonth={Number(d.slice(5, 7)) === cursor.m} isToday={d === today} barRows={barRows}>
                        {(cellData?.shown ?? []).map((e) => { const r = rowById.get(e.id)!; return <Chip key={e.id} row={r} prop={prop} title={e.title} controller={controller} onMove={move} {...(onOpenRow ? { onOpenRow } : {})} />; })}
                        {cellData && cellData.more > 0 && (
                          <Popover trigger={<button type="button" className="text-left text-[length:var(--text-ui-small-size)] text-[var(--c-accent)]">{t("databases.moreEvents", { count: cellData.more })}</button>}>
                            <ul aria-label={t("databases.eventsOf", { day: dayLabel(d) })} className="flex flex-col gap-1">
                              {cellData.all.map((e) => <li key={e.id}><button type="button" className="w-full truncate text-left" onClick={() => onOpenRow?.(e.id)}>{e.title}</button></li>)}
                            </ul>
                          </Popover>
                        )}
                      </Day>
                    );
                  })}
                </div>
                {bars.length > 0 && (
                  <div role="row" aria-label={t("databases.multiDay")} className="pointer-events-none absolute inset-x-0 top-6 grid grid-cols-7">
                    <div role="gridcell" className="col-span-7 grid grid-cols-7 gap-y-0.5">
                    {bars.map((b) => {
                      const e = events.find((x) => x.id === b.id)!;
                      return (
                        <div key={`${b.id}:${b.week}`} data-bar data-continues-before={b.continuesBefore} data-continues-after={b.continuesAfter} style={{ gridColumn: `${b.startCol + 1} / span ${b.endCol - b.startCol + 1}`, gridRow: b.row + 1 }} className={`pointer-events-auto mx-0.5 truncate bg-[var(--chip-info-bg)] px-2 text-[var(--chip-info-fg)] ${b.continuesBefore ? "rounded-l-none" : "rounded-l"} ${b.continuesAfter ? "rounded-r-none" : "rounded-r"}`}>
                          <button type="button" className="w-full truncate text-left" onClick={() => onOpenRow?.(b.id)}>{e.title}</button>
                        </div>
                      );
                    })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </DndContext>)}
      {creating && prop && (
        <TaskScheduleDialog open onOpenChange={(o) => { if (!o) setCreating(null); }} initial={creating}
          nowLocal={() => new Date(now() + offsetMinutes * 60_000).toISOString().slice(0, 16)}
          onSave={(v) => void controller.addRow(v.title, { [prop.id]: { start: `${v.date}T${v.startTime}`, end: v.end, ...(v.remindAt ? { remind: v.remindAt } : {}), ...(v.recurrence ? { repeat: v.recurrence } : {}) } })} />
      )}
      {undated.length > 0 && (
        <section role="region" aria-label={t("databases.noDate")} className="rounded border p-2">
          <h3 className="mb-1 font-semibold">{t("databases.noDate")}</h3>
          <div className="flex flex-wrap gap-2">
            {undated.map((r) => <Chip key={r.pageId} row={r} prop={prop} title={titleOf(r, t("databases.untitled"))} controller={controller} onMove={move} {...(onOpenRow ? { onOpenRow } : {})} />)}
          </div>
        </section>
      )}
    </div>
  );
}

function Day({ iso, label, inMonth, isToday, barRows, children }: { iso: string; label: string; inMonth: boolean; isToday: boolean; barRows: number; children: React.ReactNode }) {
  const drop = useDroppable({ id: `day:${iso}` });
  return (
    <div ref={drop.setNodeRef} role="gridcell" aria-label={label} {...(isToday ? { "aria-current": "date" as const } : {})} {...(inMonth ? {} : { "data-outside": "true" })} className={`min-h-24 border-b border-r border-[var(--c-border)] p-1 ${inMonth ? "" : "bg-[var(--c-raised)] text-[var(--c-text-muted)]"} ${drop.isOver ? "bg-[var(--c-raised)]" : ""}`} style={{ paddingBottom: 4 }}>
      <div aria-hidden="true" className="mb-0.5 flex h-5 items-center"><span className={isToday ? "inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--c-accent)] px-1 font-semibold text-[var(--c-on-accent)]" : "text-[var(--c-text-muted)]"}>{Number(iso.slice(8, 10))}</span></div>
      <div className="flex flex-col gap-1" style={{ marginTop: barRows * 22 }}>{children}</div>
    </div>
  );
}

function Chip({ row, prop, title, controller, onMove, onOpenRow }: { row: QueryRow; prop: Property; title: string; controller: DatabaseController; onMove: (r: QueryRow, day: string) => void; onOpenRow?: (id: string) => void }) {
  const { t } = useTranslation();
  const drag = useDraggable({ id: `row:${row.pageId}` });
  void controller;
  const cur = dateOf(row, prop);
  return (
    <div ref={drag.setNodeRef} {...drag.listeners} className={`flex items-center gap-1 rounded bg-[var(--selected)] px-1 ${drag.isDragging ? "opacity-50" : ""}`} style={{ touchAction: "none" }}>
      <button type="button" className="min-w-0 flex-1 truncate text-left" onClick={() => onOpenRow?.(row.pageId)}>{title}</button>
      <DateInput type="date" aria-label={t("databases.changeDate", { title })} value={cur ? dayOf(cur.start) : ""} onPointerDown={(e) => e.stopPropagation()} onChange={(e) => e.target.value && onMove(row, e.target.value)} compact className="shrink-0" />
    </div>
  );
}
void addDaysIso;
