import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { fromMinutes, toMinutes, validateSchedule, type Recurrence } from "@vnote/core";
import { Dialog } from "../components/Dialog";
import { Button } from "../components/Button";
import { InlineAlert } from "../components/InlineAlert";
import { Select, TextField } from "../components/fields";
import { DateField, TimeField } from "./PickerFields";
import { addMinutes } from "./parse";

export type ScheduleValues = {
  title: string; date: string; startTime: string; end: string; durationMin: number;
  remindAt?: string; recurrence?: Recurrence;
};
const DURATIONS = [15, 30, 45, 60, 90, 120, 180];
const REMIND: Record<string, number | null> = { none: null, at_start: 0, "10m": 10, "1h": 60, "1d": 1440 };
const FREQ = ["never", "daily", "weekly", "monthly", "yearly"] as const;

/** Modal «Crear tarea con horario»: título, fecha, inicio, fin o duración, recordatorio y repetición (RF-8). */
export function TaskScheduleDialog({ open, onOpenChange, onSave, nowLocal, initial }: {
  open: boolean; onOpenChange: (o: boolean) => void; onSave: (v: ScheduleValues) => void; nowLocal: () => string; initial?: { date?: string; startTime?: string };
}) {
  const { t } = useTranslation();
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(initial?.date ?? nowLocal().slice(0, 10));
  const [startTime, setStartTime] = useState(initial?.startTime ?? "09:00");
  const [endTime, setEndTime] = useState(() => addMinutes(initial?.startTime ?? "09:00", 60).time);
  const [duration, setDuration] = useState("60");
  const [remind, setRemind] = useState("none");
  const [freq, setFreq] = useState<(typeof FREQ)[number]>("never");
  const [pastAsk, setPastAsk] = useState(false);
  const startRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (open) setPastAsk(false); }, [open, remind, date, startTime]);

  /** El fin puede caer al día siguiente (cruce de medianoche): si es menor que el inicio y la diferencia no se pidió, es un error. */
  const startLocal = `${date}T${startTime}`;
  const endLocal = `${date}T${endTime}`;
  const check = useMemo(() => (startTime && endTime ? validateSchedule({ start: startLocal, end: endLocal }) : null), [startLocal, endLocal, startTime, endTime]);
  const endError = check && !check.ok ? (check.error.details as { reason?: string } | undefined)?.reason === "ZERO_DURATION" ? t("schedule.zeroDuration") : t("schedule.endBeforeStart") : undefined;
  const reasons = [title.trim() === "" ? t("schedule.needTitle") : null, endError ?? null, !startTime ? t("schedule.invalidTime") : null].filter(Boolean) as string[];
  const blocked = reasons.length > 0;

  const remindAt = (() => { const m = REMIND[remind]; return m == null || !startTime ? undefined : fromMinutes(toMinutes(startLocal) - m); })();
  const isPast = remindAt !== undefined && remindAt < nowLocal();

  const submit = (force = false) => {
    if (blocked) return;
    if (isPast && !force) { setPastAsk(true); return; }
    const durationMin = toMinutes(endLocal) - toMinutes(startLocal);
    onSave({ title: title.trim(), date, startTime, end: endLocal, durationMin, ...(remindAt ? { remindAt } : {}), ...(freq !== "never" ? { recurrence: { freq, interval: 1 } as Recurrence } : {}) });
    onOpenChange(false);
  };
  const changeStart = (v: string) => { setStartTime(v); if (v) setEndTime(addMinutes(v, Number(duration)).time); };
  const changeDuration = (v: string) => { setDuration(v); if (startTime) setEndTime(addMinutes(startTime, Number(v)).time); };
  const changeEnd = (v: string) => { setEndTime(v); if (v && startTime) { const d = toMinutes(`${date}T${v}`) - toMinutes(startLocal); if (DURATIONS.includes(d)) setDuration(String(d)); } };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={t("schedule.title")} size="m"
      footer={<>
        {blocked && <p className="mr-auto text-[length:var(--text-note-size)] text-[var(--c-text-muted)]">{t("schedule.cannotSave")} {reasons[0]}</p>}
        <Button onClick={() => onOpenChange(false)}>{t("schedule.cancel")}</Button>
        <Button variant="primary" disabled={blocked} onClick={() => submit()}>{t("schedule.save")}</Button>
      </>}>
      <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <TextField label={t("schedule.titleLabel")} value={title} onChange={setTitle} />
        <DateField label={t("schedule.date")} pickLabel={t("schedule.pickDate")} value={date} onChange={setDate} />
        <TimeField label={t("schedule.start")} pickLabel={t("schedule.pickStart")} value={startTime} onChange={changeStart} inputRef={startRef} />
        <TimeField label={t("schedule.end")} pickLabel={t("schedule.pickEnd")} value={endTime} onChange={changeEnd} error={endError} />
        <Select label={t("schedule.duration")} value={duration} onChange={changeDuration} options={DURATIONS.map((d) => ({ value: String(d), label: t("schedule.minutes", { count: d }) }))} />
        <Select label={t("schedule.remind")} value={remind} onChange={setRemind} options={Object.keys(REMIND).map((k) => ({ value: k, label: t(`schedule.remindOption.${k}`) }))} />
        <Select label={t("schedule.repeat")} value={freq} onChange={(v) => setFreq(v as (typeof FREQ)[number])} options={FREQ.map((f) => ({ value: f, label: t(`task.${f === "never" ? "never" : f}`) }))} />
        {pastAsk && (
          <div role="group" aria-label={t("schedule.pastGroup")} className="flex flex-col gap-2">
            <InlineAlert tone="warning">{t("schedule.pastReminder")}</InlineAlert>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => submit(true)}>{t("schedule.saveOverdue")}</Button>
              <Button size="sm" onClick={() => { setPastAsk(false); startRef.current?.focus(); }}>{t("schedule.changeTime")}</Button>
            </div>
          </div>
        )}
        <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
      </form>
    </Dialog>
  );
}
