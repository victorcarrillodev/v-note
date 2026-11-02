import { useMemo, useState } from "react";
import { DndContext, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { useTranslation } from "react-i18next";
import type { Property, QueryRow } from "@vnote/core";
import type { DatabaseController } from "./databaseController";
import { addDaysIso, dayOf, daysBetween, monthMatrix, shiftRange } from "./dateUtils";
import { dateOf, dateProperty, titleOf } from "./viewHelpers";
import { useDatabase } from "./useDatabase";

/** Vista calendario (mes): las filas en su día; arrastrar a otro día cambia la fecha (T-273, T-274). */
export function CalendarView({ controller, today, onOpenRow }: { controller: DatabaseController; today: string; onOpenRow?: (pageId: string) => void }) {
  const { t, i18n } = useTranslation();
  const snap = useDatabase(controller);
  const prop = dateProperty(snap);
  const rows = snap.result?.rows ?? [];
  const [cursor, setCursor] = useState(() => ({ y: Number(today.slice(0, 4)), m: Number(today.slice(5, 7)) }));
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
  const step = (n: number) => setCursor(({ y, m }) => { const t0 = m - 1 + n; return { y: y + Math.floor(t0 / 12), m: ((t0 % 12) + 12) % 12 + 1 }; });

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
        <button type="button" aria-label={t("databases.prevMonth")} onClick={() => step(-1)}>‹</button>
        <h2 className="min-w-40 text-center text-lg font-semibold capitalize-first">{monthTitle}</h2>
        <button type="button" aria-label={t("databases.nextMonth")} onClick={() => step(1)}>›</button>
        <button type="button" onClick={() => setCursor({ y: Number(today.slice(0, 4)), m: Number(today.slice(5, 7)) })}>{t("databases.today")}</button>
      </div>
      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <div role="grid" aria-label={monthTitle} className="grid grid-cols-7 border-l border-t text-sm">
          {(t("databases.weekday", { returnObjects: true }) as string[]).map((w) => <div key={w} role="columnheader" className="border-b border-r bg-[var(--hover)] px-1 py-1 text-center font-semibold">{w}</div>)}
          {weeks.flat().map((d) => (
            <Day key={d} iso={d} label={dayLabel(d)} inMonth={Number(d.slice(5, 7)) === cursor.m} isToday={d === today}>
              {(byDay.get(d) ?? []).map((r) => <Chip key={r.pageId} row={r} prop={prop} title={titleOf(r, t("databases.untitled"))} controller={controller} onMove={move} {...(onOpenRow ? { onOpenRow } : {})} />)}
            </Day>
          ))}
        </div>
      </DndContext>
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

function Day({ iso, label, inMonth, isToday, children }: { iso: string; label: string; inMonth: boolean; isToday: boolean; children: React.ReactNode }) {
  const drop = useDroppable({ id: `day:${iso}` });
  return (
    <div ref={drop.setNodeRef} role="gridcell" aria-label={label} className={`min-h-24 border-b border-r p-1 ${inMonth ? "" : "opacity-50"} ${drop.isOver ? "bg-[var(--selected)]" : ""} ${isToday ? "outline outline-1 outline-[var(--accent,#2563eb)]" : ""}`}>
      <div className="text-xs opacity-70" aria-hidden="true">{Number(iso.slice(8, 10))}</div>
      <div className="flex flex-col gap-1">{children}</div>
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
      <input type="date" aria-label={t("databases.changeDate", { title })} value={cur ? dayOf(cur.start) : ""} onPointerDown={(e) => e.stopPropagation()} onChange={(e) => e.target.value && onMove(row, e.target.value)} className="w-5 shrink-0 opacity-60" />
    </div>
  );
}
void addDaysIso;
