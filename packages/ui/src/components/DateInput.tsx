import { useState, type PointerEventHandler } from "react";
import { useTranslation } from "react-i18next";
import { monthGrid } from "@vnote/core";
import { Icon } from "../design/Icon";
import { cx } from "../design/cx";
import { ChoiceMenu } from "./ChoiceMenu";
import { Popover } from "./Popover";
import "./dateInput.css";

type Kind = "date" | "datetime-local" | "time";

const HOURS = Array.from({ length: 24 }, (_, i) => { const v = String(i).padStart(2, "0"); return { value: v, label: v }; });
const MINUTES = Array.from({ length: 12 }, (_, i) => { const v = String(i * 5).padStart(2, "0"); return { value: v, label: v }; });
const FIELD = "h-8 min-w-0 border border-[var(--c-border-control)] bg-[var(--c-card)] px-2 font-[family-name:var(--font-sans)] text-[length:var(--text-ui-size)] text-[var(--c-text)] outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--c-accent)] disabled:cursor-not-allowed disabled:opacity-60";
const BUTTON = "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-r-[var(--radius-md)] border border-l-0 border-[var(--c-border-control)] bg-[var(--c-card)] text-[var(--c-text-muted)] outline-none hover:bg-[var(--c-raised)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--c-accent)] disabled:cursor-not-allowed disabled:opacity-60";

/** Fecha y hora en que se parte un valor `YYYY-MM-DD`, `YYYY-MM-DDTHH:mm` o `HH:mm`. */
function split(kind: Kind, value: string): { date: string; time: string } {
  if (kind === "time") return { date: "", time: value };
  const [date = "", time = ""] = value.split("T");
  return { date, time };
}

/**
 * Campo de fecha u hora con el selector de la app: el campo nativo sigue ahí (se puede escribir y es accesible), pero el botón
 * abre un calendario y listas de hora con el mismo estilo que el resto de menús, en vez de la ventana del navegador.
 * Se usa como un `<input type="date|datetime-local|time">`; `onChange` recibe `{ target: { value } }`.
 */
export function DateInput({ type, value, onChange, "aria-label": ariaLabel, disabled, className, onPointerDown, compact = false, size = "md" }: {
  type: Kind; value: string; onChange: (e: { target: { value: string } }) => void; "aria-label"?: string; disabled?: boolean; className?: string;
  onPointerDown?: PointerEventHandler<HTMLElement>;
  /** Solo el botón (el campo nativo queda oculto pero disponible para lectores de pantalla y pruebas). */
  compact?: boolean;
  /** `sm`: más bajo, para filas apretadas (línea de tiempo). */
  size?: "md" | "sm";
}) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const { date, time } = split(type, value);
  const [month, setMonth] = useState((date || new Date().toISOString().slice(0, 10)).slice(0, 7));
  const set = (v: string) => onChange({ target: { value: v } });
  const today = new Date().toISOString().slice(0, 10);
  const [hh = "09", mm = "00"] = (time || "09:00").split(":");
  const emit = (d: string, h: string, m: string) => set(type === "time" ? `${h}:${m}` : type === "date" ? d : d ? `${d}T${h}:${m}` : "");
  const step = (n: number) => { const [y, m] = month.split("-").map(Number) as [number, number]; const t0 = m - 1 + n; setMonth(`${y + Math.floor(t0 / 12)}-${String(((t0 % 12) + 12) % 12 + 1).padStart(2, "0")}`); };
  const fmt = (iso: string) => new Intl.DateTimeFormat(i18n.language, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(Date.parse(`${iso}T00:00:00Z`));
  const pickLabel = type === "time" ? t("schedule.pickTime") : t("schedule.pickDate");

  return (
    <span className={cx("inline-flex items-stretch", className)} {...(onPointerDown ? { onPointerDown } : {})}>
      <input
        type={type}
        value={value}
        disabled={disabled}
        data-vn-date=""
        {...(ariaLabel ? { "aria-label": ariaLabel } : {})}
        onChange={(e) => set(e.target.value)}
        className={cx(FIELD, "rounded-l-[var(--radius-md)]", size === "sm" && "h-6 min-w-0 flex-1 px-1 text-[length:var(--text-note-size)]", compact && "sr-only")}
      />
      <Popover open={open} onOpenChange={setOpen} align="end" trigger={
        <button type="button" disabled={disabled} aria-label={pickLabel} {...(ariaLabel ? { title: ariaLabel } : {})} className={cx(BUTTON, size === "sm" && "h-6 w-6", compact && "rounded-[var(--radius-md)] border-l")}>
          <Icon name={type === "time" ? "time" : "calendar"} size={16} />
        </button>
      }>
        <div className="flex flex-col gap-2">
          {type !== "time" && (
            <div>
              <div className="flex items-center justify-between pb-2">
                <button type="button" aria-label={t("databases.prevMonth")} onClick={() => step(-1)} className="vn-date-nav">‹</button>
                <span className="inline-block font-semibold first-letter:uppercase">{new Intl.DateTimeFormat(i18n.language, { month: "long", year: "numeric", timeZone: "UTC" }).format(Date.parse(`${month}-01T00:00:00Z`))}</span>
                <button type="button" aria-label={t("databases.nextMonth")} onClick={() => step(1)} className="vn-date-nav">›</button>
              </div>
              <div className="grid grid-cols-7 gap-0.5">
                {monthGrid(month).flat().map((d) => (
                  <button
                    key={d.date}
                    type="button"
                    aria-label={fmt(d.date)}
                    aria-pressed={d.date === date}
                    onClick={() => { emit(d.date, hh, mm); if (type === "date") setOpen(false); }}
                    className={cx("h-8 w-8 rounded-[var(--radius-sm)] text-center", d.inMonth ? "" : "text-[var(--c-text-muted)]", d.date === today && d.date !== date && "font-semibold underline", d.date === date ? "bg-[var(--c-accent)] text-[var(--c-on-accent)]" : "hover:bg-[var(--c-raised)]")}
                  >{Number(d.date.slice(8))}</button>
                ))}
              </div>
            </div>
          )}
          {type !== "date" && (
            <div className="flex items-center gap-2">
              <ChoiceMenu size="sm" label={t("schedule.hours")} exactLabel value={hh} onChange={(h) => emit(date, h, mm)} options={HOURS} className="!min-w-16" />
              <span aria-hidden="true">:</span>
              <ChoiceMenu size="sm" label={t("schedule.minutes")} exactLabel value={MINUTES.some((m) => m.value === mm) ? mm : "00"} onChange={(m) => emit(date, hh, m)} options={MINUTES} className="!min-w-16" />
            </div>
          )}
        </div>
      </Popover>
    </span>
  );
}
