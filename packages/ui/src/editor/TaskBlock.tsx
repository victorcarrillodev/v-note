import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { advanceSchedule, validateRecurrence, type Frequency, type Recurrence } from "@vnote/core";

export type TaskProps = { checked: boolean; due: string; remindAt: string; recurrence: string };

function parseRecurrence(raw: string): Recurrence | null {
  if (!raw) return null;
  try { const r = validateRecurrence(JSON.parse(raw)); return r.ok ? r.value : null; } catch { return null; }
}

/** Casilla de tarea con fecha límite, recordatorio y repetición (RF-11). Presentacional: quien la usa decide cómo guardar los cambios. */
export function TaskBlockView({ props, onChange, now, content }: { props: TaskProps; onChange: (patch: Partial<TaskProps>) => void; now: string; content: ReactNode }) {
  const { t } = useTranslation();
  const rule = parseRecurrence(props.recurrence);
  const pastReminder = props.remindAt !== "" && props.remindAt < now;

  const toggle = () => {
    // Una tarea que se repite no se cierra al marcarla: pasa a su siguiente repetición (CL-32)
    if (!props.checked && rule) {
      const next = advanceSchedule({ due: props.due || null, remindAt: props.remindAt || null, recurrence: rule });
      if (next) { onChange({ due: next.due ?? "", remindAt: next.remindAt ?? "", recurrence: JSON.stringify(next.recurrence) }); return; }
    }
    onChange({ checked: !props.checked });
  };

  return (
    <div className="flex w-full flex-col gap-1">
      <div className="flex items-start gap-2">
        <input type="checkbox" aria-label={t("task.done")} checked={props.checked} onChange={toggle} contentEditable={false} className="mt-1" />
        <div className={`min-w-0 flex-1 ${props.checked ? "line-through opacity-60" : ""}`}>{content}</div>
      </div>
      <div className="ml-6 flex flex-wrap items-center gap-2 text-xs" contentEditable={false}>
        <label className="flex items-center gap-1">{t("task.due")}
          <input type="date" aria-label={t("task.due")} value={props.due} onChange={(e) => onChange({ due: e.target.value })} />
        </label>
        <label className="flex items-center gap-1">{t("task.remind")}
          <input type="datetime-local" aria-label={t("task.remind")} value={props.remindAt} onChange={(e) => onChange({ remindAt: e.target.value })} />
        </label>
        <label className="flex items-center gap-1">{t("task.repeat")}
          <select aria-label={t("task.repeat")} value={rule?.freq ?? ""} onChange={(e) => onChange({ recurrence: e.target.value === "" ? "" : JSON.stringify({ freq: e.target.value as Frequency, interval: 1 }) })}>
            <option value="">{t("task.never")}</option>
            <option value="daily">{t("task.daily")}</option>
            <option value="weekly">{t("task.weekly")}</option>
            <option value="monthly">{t("task.monthly")}</option>
            <option value="yearly">{t("task.yearly")}</option>
          </select>
        </label>
      </div>
      {pastReminder && <p role="note" className="ml-6 text-xs text-amber-800">{t("task.pastReminder")}</p>}
    </div>
  );
}
