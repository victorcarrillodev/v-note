import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { SnoozeOption } from "@vnote/core";

/** Ventana pequeña de recordatorio (RF-11): aparece sin quitar el foco y ofrece Abrir, Hecho y Posponer. */
export function ReminderPopup({ title, when, onOpen, onDone, onSnooze, onClose }: {
  title: string; when: string;
  onOpen: () => void | Promise<void>; onDone: () => void | Promise<void>; onSnooze: (o: SnoozeOption) => void | Promise<void>; onClose: () => void;
}) {
  const { t } = useTranslation();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onClose]);
  const act = async (f: () => void | Promise<void>) => {
    try { await f(); setFailed(false); onClose(); } catch { setFailed(true); }
  };
  return (
    <div role="alertdialog" aria-labelledby="rp-title" aria-describedby="rp-when" className="flex h-screen flex-col justify-between gap-2 p-3">
      <div>
        <h1 id="rp-title" className="font-semibold">{title || "·"}</h1>
        <p id="rp-when" className="text-sm opacity-80">{when}</p>
      </div>
      {failed && <p role="alert" className="text-sm text-[var(--c-danger)]">{t("reminders.popupFailed")}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => void act(onOpen)}>{t("reminders.openShort")}</button>
        <button type="button" onClick={() => void act(onDone)}>{t("reminders.done")}</button>
        <select aria-label={t("reminders.snoozeLabel")} value="" onChange={(e) => { if (e.target.value) void act(() => onSnooze(e.target.value as SnoozeOption)); }}>
          <option value="">{t("reminders.snoozeLabel")}</option>
          <option value="10m">{t("reminders.snooze10")}</option>
          <option value="1h">{t("reminders.snooze1h")}</option>
          <option value="tomorrow">{t("reminders.snoozeTomorrow")}</option>
        </select>
      </div>
    </div>
  );
}
