import { useId, useState, type ReactNode, type Ref } from "react";
import { useTranslation } from "react-i18next";
import { monthGrid } from "@vnote/core";
import { Popover } from "../components/Popover";
import { Icon } from "../design/Icon";
import { parseDate, parseTime } from "./parse";

const CONTROL = "h-8 min-w-0 flex-1 rounded-l border bg-[var(--c-card)] px-2 text-[length:var(--text-ui-size)] text-[var(--c-text)]";

function Shell({ id, label, error, input, picker }: { id: string; label: string; error?: string | undefined; input: ReactNode; picker: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-[length:var(--text-ui-small-size)] font-medium text-[var(--c-text)]">{label}</label>
      <div className="flex">{input}{picker}</div>
      {error && <p id={`${id}-error`} role="alert" className="text-[length:var(--text-note-size)] text-[var(--c-danger)]">{error}</p>}
    </div>
  );
}
const pickerButton = "flex h-8 w-8 items-center justify-center rounded-r bg-[var(--c-raised)] text-[var(--c-text-muted)] hover:bg-[var(--c-border)]";

/** Hora: se puede ESCRIBIR («930», «9 pm») o elegir de una lista de franjas; al salir del campo se normaliza a HH:mm. */
export function TimeField({ label, pickLabel, value, onChange, error, inputRef }: { label: string; pickLabel: string; value: string; onChange: (v: string) => void; error?: string | undefined; inputRef?: Ref<HTMLInputElement> }) {
  const { t } = useTranslation();
  const id = useId();
  const [text, setText] = useState(value);
  const [shown, setShown] = useState(value);
  const [bad, setBad] = useState(false);
  const [open, setOpen] = useState(false);
  if (value !== shown) { setShown(value); setText(value); setBad(false); }
  const commit = () => {
    const p = parseTime(text);
    if (text.trim() === "") { onChange(""); setBad(false); return; }
    if (p) { setBad(false); setText(p); setShown(p); onChange(p); } else setBad(true);
  };
  const slots = Array.from({ length: 48 }, (_, i) => `${String(Math.floor(i / 2)).padStart(2, "0")}:${i % 2 ? "30" : "00"}`);
  const msg = bad ? t("schedule.invalidTime") : error;
  return (
    <Shell id={id} label={label} error={msg}
      input={<input ref={inputRef} id={id} value={text} onChange={(e) => setText(e.target.value)} onBlur={commit} onKeyDown={(e) => { if (e.key === "Enter") { commit(); } }} {...(msg ? { "aria-invalid": true, "aria-describedby": `${id}-error` } : {})} className={`${CONTROL} ${msg ? "border-[var(--c-danger)]" : "border-[var(--c-border-control)]"}`} />}
      picker={
        <Popover open={open} onOpenChange={setOpen} align="end" trigger={<button type="button" aria-label={pickLabel} className={pickerButton}><Icon name="time" size={16} /></button>}>
          <ul role="listbox" aria-label={t("schedule.hours")} className="max-h-56 overflow-y-auto">
            {slots.map((s) => (
              <li key={s} role="option" aria-selected={s === value} tabIndex={0} onClick={() => { onChange(s); setOpen(false); }} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onChange(s); setOpen(false); } if (e.key === "ArrowDown") (e.currentTarget.nextElementSibling as HTMLElement | null)?.focus(); if (e.key === "ArrowUp") (e.currentTarget.previousElementSibling as HTMLElement | null)?.focus(); }} className="cursor-pointer rounded px-2 py-1 hover:bg-[var(--c-raised)] focus:bg-[var(--c-raised)] aria-selected:font-semibold">{s}</li>
            ))}
          </ul>
        </Popover>
      } />
  );
}

/** Fecha: escrita (AAAA-MM-DD o DD/MM/AAAA) o elegida en una rejilla del mes. */
export function DateField({ label, pickLabel, value, onChange, error }: { label: string; pickLabel: string; value: string; onChange: (v: string) => void; error?: string | undefined }) {
  const { t, i18n } = useTranslation();
  const id = useId();
  const [text, setText] = useState(value);
  const [shown, setShown] = useState(value);
  const [bad, setBad] = useState(false);
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState((value || new Date().toISOString().slice(0, 10)).slice(0, 7));
  if (value !== shown) { setShown(value); setText(value); setBad(false); if (value) setMonth(value.slice(0, 7)); }
  const commit = () => {
    const p = parseDate(text);
    if (p) { setBad(false); setText(p); setShown(p); setMonth(p.slice(0, 7)); onChange(p); } else setBad(true);
  };
  const step = (n: number) => { const [y, m] = month.split("-").map(Number) as [number, number]; const t0 = m - 1 + n; setMonth(`${y + Math.floor(t0 / 12)}-${String(((t0 % 12) + 12) % 12 + 1).padStart(2, "0")}`); };
  const msg = bad ? t("schedule.invalidDate") : error;
  const fmt = (iso: string) => new Intl.DateTimeFormat(i18n.language, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(Date.parse(`${iso}T00:00:00Z`));
  return (
    <Shell id={id} label={label} error={msg}
      input={<input id={id} value={text} onChange={(e) => setText(e.target.value)} onBlur={commit} onKeyDown={(e) => { if (e.key === "Enter") commit(); }} {...(msg ? { "aria-invalid": true, "aria-describedby": `${id}-error` } : {})} className={`${CONTROL} ${msg ? "border-[var(--c-danger)]" : "border-[var(--c-border-control)]"}`} />}
      picker={
        <Popover open={open} onOpenChange={setOpen} align="end" trigger={<button type="button" aria-label={pickLabel} className={pickerButton}><Icon name="calendar" size={16} /></button>}>
          <div className="flex items-center justify-between pb-2">
            <button type="button" aria-label={t("databases.prevMonth")} onClick={() => step(-1)}>‹</button>
            <span className="font-semibold capitalize">{new Intl.DateTimeFormat(i18n.language, { month: "long", year: "numeric", timeZone: "UTC" }).format(Date.parse(`${month}-01T00:00:00Z`))}</span>
            <button type="button" aria-label={t("databases.nextMonth")} onClick={() => step(1)}>›</button>
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {monthGrid(month).flat().map((d) => (
              <button key={d.date} type="button" aria-label={fmt(d.date)} aria-pressed={d.date === value} onClick={() => { onChange(d.date); setOpen(false); }} className={`h-8 rounded text-center ${d.inMonth ? "" : "text-[var(--c-text-muted)]"} ${d.date === value ? "bg-[var(--c-accent)] text-[var(--c-on-accent)]" : "hover:bg-[var(--c-raised)]"}`}>{Number(d.date.slice(8))}</button>
            ))}
          </div>
        </Popover>
      } />
  );
}
