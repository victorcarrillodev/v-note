import { useCallback, useEffect, useState } from "react";
import { EmptyState } from "../empty/EmptyState";
import { InlineAlert } from "../components/InlineAlert";
import { Button } from "../components/Button";
import { ViewLayout, ViewSection, VIEW_ROW } from "../components/ViewLayout";
import { INPUT, MUTED } from "../components/formStyles";
import { cx } from "../design/cx";
import { useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import type { SnoozeOption, Task } from "@vnote/core";
import { useUndoToast } from "../feedback/useUndoToast";
import type { ReminderCenter, Summary, SummaryItem } from "./reminderCenter";

/** Recordatorios: vencidos de todos los espacios, tareas de hoy y agenda del espacio activo (RF-11, RF-12). */
export function RemindersView({ center, activeWorkspaceId, onOpen }: { center: ReminderCenter; activeWorkspaceId: string | null; onOpen: (workspaceId: string, pageId: string) => void }) {
  const { t } = useTranslation();
  const snap = useSyncExternalStore(center.subscribe, center.getSnapshot, center.getSnapshot);
  const [summary, setSummary] = useState<Summary | null>(null);
  const announce = useUndoToast();
  const complete = (wsId: string, taskId: string) => void center.completeUndoable(wsId, taskId).then((undo) => { if (undo) announce("task-done", t("toast.taskDone"), undo); });
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
    <ViewLayout title={t("reminders.title")}>
      {snap.permissionWarning && (
        <InlineAlert tone="warning" action={{ label: t("reminders.dismissWarning"), onClick: () => center.dismissPermissionWarning() }}>{t("reminders.permissionDenied")}</InlineAlert>
      )}
      {empty && <EmptyState illustration="reminders" title={t("reminders.nothing")} />}

      {summary.overdue.length > 0 && (
        <ViewSection title={t("reminders.overdue")} flush>
          <ul aria-label={t("reminders.overdue")} className="flex flex-col">
            {summary.overdue.map((o) => (
              <li key={`${o.workspace.id}:${o.task.id}`} className={cx(VIEW_ROW, "flex-wrap")}>
                <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full bg-[var(--c-danger)]" />
                <div className="min-w-0 flex-1">
                  <strong className="block truncate font-medium">{o.task.title || t("app.untitled")}</strong>
                  <small className={MUTED}>{o.workspace.name} · {when(o)}{o.missed > 0 ? ` · ${t("reminders.missed", { count: o.missed })}` : ""}</small>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <Button size="sm" variant="primary" aria-label={t("reminders.markDone", { title: o.task.title })} onClick={() => complete(o.workspace.id, o.task.id)}>{t("reminders.done")}</Button>
                  <Button size="sm" aria-label={t("reminders.open", { title: o.task.title })} onClick={() => onOpen(o.workspace.id, o.task.pageId)}>{t("reminders.openShort")}</Button>
                  <select aria-label={t("reminders.snooze", { title: o.task.title })} value="" onChange={(e) => e.target.value && void center.snooze(o.workspace.id, o.task.id, e.target.value as SnoozeOption)} className={cx(INPUT, "h-7 w-auto text-[length:var(--text-ui-small-size)]")}>
                    <option value="">{t("reminders.snoozeLabel")}</option>
                    <option value="10m">{t("reminders.snooze10")}</option>
                    <option value="1h">{t("reminders.snooze1h")}</option>
                    <option value="tomorrow">{t("reminders.snoozeTomorrow")}</option>
                  </select>
                  <Button size="sm" variant="ghost" aria-label={t("reminders.dismiss", { title: o.task.title })} onClick={() => void center.dismiss(o.workspace.id, o.task.id)}>{t("reminders.dismissShort")}</Button>
                </div>
              </li>
            ))}
          </ul>
        </ViewSection>
      )}

      {summary.today.length > 0 && (
        <ViewSection title={t("reminders.today")} flush>
          <ul aria-label={t("reminders.today")} className="flex flex-col">
            {summary.today.map((o) => (
              <li key={`${o.workspace.id}:${o.task.id}`} className={VIEW_ROW}>
                <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full bg-[var(--c-accent)]" />
                <span className="min-w-0 flex-1 truncate"><span className="font-medium">{o.task.title}</span> <small className={MUTED}>· {o.workspace.name}</small></span>
                <Button size="sm" variant="primary" aria-label={t("reminders.markDone", { title: o.task.title })} onClick={() => complete(o.workspace.id, o.task.id)}>{t("reminders.done")}</Button>
                <Button size="sm" aria-label={t("reminders.open", { title: o.task.title })} onClick={() => onOpen(o.workspace.id, o.task.pageId)}>{t("reminders.openShort")}</Button>
              </li>
            ))}
          </ul>
        </ViewSection>
      )}

      {agenda.length > 0 && (
        <ViewSection title={t("reminders.agenda")} flush>
          <ul aria-label={t("reminders.agenda")} className="flex flex-col">
            {agenda.map((a) => (
              <li key={a.id} className={cx(VIEW_ROW, a.done && "text-[var(--c-text-muted)] line-through")}>
                <span className={cx("w-28 shrink-0 tabular-nums", MUTED)}>{a.due ?? a.remindAt?.slice(0, 10)}</span>
                <span className="min-w-0 flex-1 truncate">{a.title}</span>
                <Button size="sm" aria-label={t("reminders.open", { title: a.title })} onClick={() => activeWorkspaceId && onOpen(activeWorkspaceId, a.pageId)}>{t("reminders.openShort")}</Button>
              </li>
            ))}
          </ul>
        </ViewSection>
      )}
    </ViewLayout>
  );
}
