import { useCallback, useEffect, useState } from "react";
import { useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import type { SnoozeOption, Task } from "@vnote/core";
import type { ReminderCenter, Summary, SummaryItem } from "./reminderCenter";

/** Recordatorios: vencidos de todos los espacios, tareas de hoy y agenda del espacio activo (RF-11, RF-12). */
export function RemindersView({ center, activeWorkspaceId, onOpen }: { center: ReminderCenter; activeWorkspaceId: string | null; onOpen: (workspaceId: string, pageId: string) => void }) {
  const { t } = useTranslation();
  const snap = useSyncExternalStore(center.subscribe, center.getSnapshot, center.getSnapshot);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [agenda, setAgenda] = useState<Task[]>([]);

  const reload = useCallback(async () => {
    setSummary(await center.summary());
    setAgenda(activeWorkspaceId ? await center.agenda(activeWorkspaceId) : []);
  }, [center, activeWorkspaceId]);
  useEffect(() => { void reload(); }, [reload, snap.version]);

  if (!summary) return null;
  const empty = summary.overdue.length === 0 && summary.today.length === 0;
  const when = (o: SummaryItem) => o.occurrence.replace("T", " ");
  return (
    <section aria-label={t("reminders.title")} className="flex flex-col gap-4 p-4">
      <h1 className="text-xl font-semibold">{t("reminders.title")}</h1>
      {snap.permissionWarning && (
        <p role="alert" className="rounded border border-amber-500 bg-amber-50 p-2 text-sm text-amber-900">
          {t("reminders.permissionDenied")} <button type="button" onClick={() => center.dismissPermissionWarning()}>{t("reminders.dismissWarning")}</button>
        </p>
      )}
      {empty && <p>{t("reminders.nothing")}</p>}

      {summary.overdue.length > 0 && (
        <ul aria-label={t("reminders.overdue")} className="flex flex-col divide-y rounded border">
          {summary.overdue.map((o) => (
            <li key={`${o.workspace.id}:${o.task.id}`} className="flex flex-wrap items-center gap-2 p-2">
              <div className="min-w-0 flex-1">
                <strong className="block truncate">{o.task.title || t("app.untitled")}</strong>
                <small className="opacity-75">{o.workspace.name} · {when(o)}{o.missed > 0 ? ` · ${t("reminders.missed", { count: o.missed })}` : ""}</small>
              </div>
              <button type="button" aria-label={t("reminders.open", { title: o.task.title })} onClick={() => onOpen(o.workspace.id, o.task.pageId)}>{t("reminders.openShort")}</button>
              <button type="button" aria-label={t("reminders.markDone", { title: o.task.title })} onClick={() => void center.complete(o.workspace.id, o.task.id)}>{t("reminders.done")}</button>
              <select aria-label={t("reminders.snooze", { title: o.task.title })} value="" onChange={(e) => e.target.value && void center.snooze(o.workspace.id, o.task.id, e.target.value as SnoozeOption)}>
                <option value="">{t("reminders.snoozeLabel")}</option>
                <option value="10m">{t("reminders.snooze10")}</option>
                <option value="1h">{t("reminders.snooze1h")}</option>
                <option value="tomorrow">{t("reminders.snoozeTomorrow")}</option>
              </select>
              <button type="button" aria-label={t("reminders.dismiss", { title: o.task.title })} onClick={() => void center.dismiss(o.workspace.id, o.task.id)}>{t("reminders.dismissShort")}</button>
            </li>
          ))}
        </ul>
      )}

      {summary.today.length > 0 && (
        <ul aria-label={t("reminders.today")} className="flex flex-col divide-y rounded border">
          {summary.today.map((o) => (
            <li key={`${o.workspace.id}:${o.task.id}`} className="flex items-center gap-2 p-2">
              <span className="flex-1"><span>{o.task.title}</span> <small className="opacity-75">· {o.workspace.name}</small></span>
              <button type="button" aria-label={t("reminders.open", { title: o.task.title })} onClick={() => onOpen(o.workspace.id, o.task.pageId)}>{t("reminders.openShort")}</button>
              <button type="button" aria-label={t("reminders.markDone", { title: o.task.title })} onClick={() => void center.complete(o.workspace.id, o.task.id)}>{t("reminders.done")}</button>
            </li>
          ))}
        </ul>
      )}

      {agenda.length > 0 && (
        <>
          <h2 className="font-semibold">{t("reminders.agenda")}</h2>
          <ul aria-label={t("reminders.agenda")} className="flex flex-col divide-y rounded border">
            {agenda.map((a) => (
              <li key={a.id} className={`flex items-center gap-2 p-2 ${a.done ? "line-through opacity-60" : ""}`}>
                <span className="w-28 shrink-0 text-sm tabular-nums">{a.due ?? a.remindAt?.slice(0, 10)}</span>
                <span className="flex-1">{a.title}</span>
                <button type="button" aria-label={t("reminders.open", { title: a.title })} onClick={() => activeWorkspaceId && onOpen(activeWorkspaceId, a.pageId)}>{t("reminders.openShort")}</button>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
