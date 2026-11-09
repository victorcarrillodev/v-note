import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Property, QueryRow } from "@vnote/core";
import type { DatabaseController } from "./databaseController";
import { addDaysIso, dayOf, daysBetween, resizeRange, shiftRange } from "./dateUtils";
import { dateOf, dateProperty, titleOf } from "./viewHelpers";
import { SidePanel } from "../components/SidePanel";
import { Button } from "../components/Button";
import { useDatabase } from "./useDatabase";

const DAY_W = 32;
const ROW_H = 44;
const LABEL_W = 220;

/** Línea de tiempo tipo Gantt: una barra por rango; arrastrar la mueve y el borde derecho la redimensiona (T-275, T-276). */
function useSelected() { return useState<string | null>(null); }

export function TimelineView({ controller, onOpenRow, today = new Date().toISOString().slice(0, 10) }: { controller: DatabaseController; onOpenRow?: (pageId: string) => void; today?: string }) {
  const { t } = useTranslation();
  const snap = useDatabase(controller);
  const prop = dateProperty(snap);
  const rows = snap.result?.rows ?? [];
  const [selected, setSelected] = useSelected();
  const dated = rows.map((r) => ({ r, d: dateOf(r, prop) })).filter((x): x is { r: QueryRow; d: NonNullable<ReturnType<typeof dateOf>> } => x.d !== null);
  const undated = rows.filter((r) => !dateOf(r, prop));
  if (!prop) return <p className="opacity-70">{t("databases.noDateProp")}</p>;

  const starts = dated.map((x) => dayOf(x.d.start));
  const ends = dated.map((x) => dayOf(x.d.end ?? x.d.start));
  const origin = starts.length ? addDaysIso([...starts].sort()[0]!, -3) : "";
  const last = ends.length ? addDaysIso([...ends].sort().at(-1)!, 7) : "";
  const total = starts.length ? daysBetween(origin, last) + 1 : 0;
  const days = Array.from({ length: total }, (_, i) => addDaysIso(origin, i));
  const todayX = total && today >= origin && today <= last ? daysBetween(origin, today) * DAY_W + DAY_W / 2 : null;

  return (
    <div className="flex flex-col gap-2">
      {dated.length === 0 ? <p className="opacity-70">{t("databases.noDates")}</p> : (
        <div className="overflow-x-auto rounded border">
          <div style={{ width: LABEL_W + total * DAY_W }} className="relative">
            {todayX !== null && <div data-today-line aria-hidden="true" className="pointer-events-none absolute top-0 z-[1] h-full w-0.5 bg-[var(--c-accent)]" style={{ left: LABEL_W + todayX }} />}
            <div className="sticky top-0 z-10 flex border-b border-[var(--c-border)] bg-[var(--c-canvas)] text-[length:var(--text-ui-small-size)]" style={{ height: 28 }}>
              <div style={{ width: LABEL_W }} className="shrink-0 px-2 py-1 font-semibold">{prop.name}</div>
              {days.map((d) => <div key={d} style={{ width: DAY_W }} className={`shrink-0 border-l text-center ${d.endsWith("-01") ? "font-bold" : "opacity-70"}`}>{d.endsWith("-01") ? d.slice(5, 7) + "/" : ""}{Number(d.slice(8, 10))}</div>)}
            </div>
            {dated.map(({ r, d }) => (
              <Row key={r.pageId} onSelect={() => setSelected(r.pageId)} row={r} date={d} origin={origin} prop={prop} controller={controller} title={titleOf(r, t("databases.untitled"))} {...(onOpenRow ? { onOpenRow } : {})} />
            ))}
          </div>
        </div>
      )}
      {(() => {
        const sel = dated.find((x) => x.r.pageId === selected);
        return (
          <SidePanel open={!!sel} onClose={() => setSelected(null)} title={sel ? titleOf(sel.r, t("databases.untitled")) : ""} closeLabel={t("shell.close", { defaultValue: "Cerrar" })}>
            {sel && (
              <dl className="flex flex-col gap-2">
                <div><dt className="text-[var(--c-text-muted)]">{t("databases.startOf", { title: "" }).trim()}</dt><dd>{sel.d.start}</dd></div>
                <div><dt className="text-[var(--c-text-muted)]">{t("databases.endOf", { title: "" }).trim()}</dt><dd>{sel.d.end ?? sel.d.start}</dd></div>
                {onOpenRow && <Button onClick={() => onOpenRow(sel.r.pageId)}>{t("databases.openRow", { title: titleOf(sel.r, t("databases.untitled")) })}</Button>}
              </dl>
            )}
          </SidePanel>
        );
      })()}
      {undated.length > 0 && (
        <section role="region" aria-label={t("databases.noDate")} className="rounded border p-2">
          <h3 className="mb-1 font-semibold">{t("databases.noDate")}</h3>
          <ul className="flex flex-wrap gap-2">{undated.map((r) => <li key={r.pageId}>{titleOf(r, t("databases.untitled"))}</li>)}</ul>
        </section>
      )}
    </div>
  );
}

type Mode = "move" | "resize";
function Row({ row, date, origin, prop, controller, title, onOpenRow, onSelect }: { onSelect: () => void; row: QueryRow; date: { start: string; end?: string }; origin: string; prop: Property; controller: DatabaseController; title: string; onOpenRow?: (id: string) => void }) {
  const { t } = useTranslation();
  const [drag, setDrag] = useState<{ mode: Mode; dx: number } | null>(null);
  const startX = useRef(0);
  const dragged = useRef(false);
  const start = dayOf(date.start), end = dayOf(date.end ?? date.start);
  const left = daysBetween(origin, start) * DAY_W;
  const width = (daysBetween(start, end) + 1) * DAY_W;
  const dxFor = (e: PointerEvent) => e.clientX - startX.current;

  useEffect(() => {
    if (!drag) return;
    const mode = drag.mode;
    const onMove = (e: PointerEvent) => setDrag({ mode, dx: dxFor(e) });
    const onUp = (e: PointerEvent) => {
      const delta = Math.round(dxFor(e) / DAY_W);
      setDrag(null);
      dragged.current = delta !== 0; // soltar tras arrastrar no cuenta como clic (no abre el panel)
      if (delta !== 0) void controller.setCell(row.pageId, prop.id, mode === "move" ? shiftRange(date, delta) : resizeRange(date, delta));
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp, { once: true });
    return () => { window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag?.mode]);

  const begin = (mode: Mode) => (e: React.PointerEvent) => { e.preventDefault(); e.stopPropagation(); startX.current = e.clientX; setDrag({ mode, dx: 0 }); };
  const liveLeft = drag?.mode === "move" ? left + Math.round(drag.dx / DAY_W) * DAY_W : left;
  const liveWidth = drag?.mode === "resize" ? Math.max(DAY_W, width + Math.round(drag.dx / DAY_W) * DAY_W) : width;
  const label = date.end ? `${title}: ${date.start} → ${date.end}` : `${title}: ${date.start}`;
  return (
    <div className="flex items-center border-b border-[var(--c-border)]" style={{ height: ROW_H }}>
      <div style={{ width: LABEL_W }} className="flex shrink-0 flex-col gap-0.5 px-2 text-xs">
        <button type="button" className="truncate text-left font-medium" onClick={() => onOpenRow?.(row.pageId)}>{title}</button>
        <span className="flex gap-1">
          <input type="date" aria-label={t("databases.startOf", { title })} value={start} onChange={(e) => e.target.value && void controller.setCell(row.pageId, prop.id, { ...date, start: e.target.value, ...(date.end && date.end < e.target.value ? { end: e.target.value } : {}) })} className="w-28" />
          <input type="date" aria-label={t("databases.endOf", { title })} value={date.end ? end : ""} onChange={(e) => void controller.setCell(row.pageId, prop.id, e.target.value ? { ...date, end: e.target.value } : { start: date.start })} className="w-28" />
        </span>
      </div>
      <div className="relative h-full flex-1">
        <button
          type="button" aria-label={label} onPointerDown={begin("move")} onClick={(e) => { if (dragged.current) { dragged.current = false; return; } e.currentTarget.focus(); onSelect(); }}
          className="vn-grab absolute top-2 flex h-7 items-center overflow-hidden rounded bg-[var(--c-accent)] px-1 text-[length:var(--text-ui-small-size)] text-[var(--c-on-accent)]"
          style={{ left: liveLeft, width: liveWidth, touchAction: "none" }}
        >
          <span className="truncate">{title}</span>
          <span data-resize aria-hidden="true" onPointerDown={begin("resize")} className="absolute right-0 top-0 h-full w-2 cursor-ew-resize bg-[var(--c-scrim)]" />
        </button>
      </div>
    </div>
  );
}
