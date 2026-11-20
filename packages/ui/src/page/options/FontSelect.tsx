import { useId, useRef, useState, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import { FONT_IDS, type FontId } from "@vnote/core";
import { cx } from "../../design/cx";
import { pageFonts } from "../../design/tokens";

export const DEFAULT_FONT = "";
type Value = FontId | typeof DEFAULT_FONT;

/**
 * Selector de fuente desplegable (RF-5.2): cerrado muestra la fuente elegida; abierto, «Predeterminado» y las fuentes, cada nombre escrito en la suya.
 * Flechas para moverse, Enter o clic para elegir, Esc para cerrar sin cerrar la barra lateral.
 */
export function FontSelect({ label, value, onChange }: { label: string; value: Value; onChange: (v: Value) => void }) {
  const { t } = useTranslation();
  const id = useId();
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const options: { id: Value; text: string; family?: string }[] = [
    { id: DEFAULT_FONT, text: t("pageOptions.default") },
    ...FONT_IDS.map((f) => ({ id: f, text: pageFonts[f]!.label, family: `var(--font-${f})` })),
  ];
  const current = options.find((o) => o.id === value) ?? options[0]!;
  const focusOption = (i: number) => requestAnimationFrame(() => list.current?.querySelectorAll<HTMLElement>('[role="option"]')[i]?.focus());
  const close = (back = true) => { setOpen(false); if (back) button.current?.focus(); };
  const pick = (v: Value) => { onChange(v); close(); };
  const toggle = () => { if (open) close(false); else { setOpen(true); focusOption(options.findIndex((o) => o.id === value)); } };
  const onButtonKey = (e: KeyboardEvent) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); if (!open) setOpen(true); focusOption(Math.max(0, options.findIndex((o) => o.id === value))); }
  };
  const onListKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const items = [...(list.current?.querySelectorAll<HTMLElement>('[role="option"]') ?? [])];
    const at = items.indexOf(document.activeElement as HTMLElement);
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); }
    else if (e.key === "ArrowDown") { e.preventDefault(); items[(at + 1) % items.length]?.focus(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); items[(at - 1 + items.length) % items.length]?.focus(); }
    else if (e.key === "Home") { e.preventDefault(); items[0]?.focus(); }
    else if (e.key === "End") { e.preventDefault(); items[items.length - 1]?.focus(); }
    else if (e.key === "Tab") setOpen(false);
  };
  return (
    <div className="flex flex-col gap-1">
      <span id={`${id}-label`} className="text-[length:var(--text-ui-small-size)] font-medium">{label}</span>
      <button
        ref={button} type="button" aria-haspopup="listbox" aria-expanded={open} aria-labelledby={`${id}-label ${id}-value`} aria-controls={open ? `${id}-list` : undefined}
        onClick={toggle} onKeyDown={onButtonKey}
        className="flex h-8 items-center justify-between rounded bg-[var(--c-raised)] px-2 text-left text-[length:var(--text-ui-size)] [@media(pointer:coarse)]:h-11"
      >
        <span id={`${id}-value`} style={current.family ? { fontFamily: current.family } : undefined}>{current.text}</span>
        <span aria-hidden="true" className={cx("text-[var(--c-text-muted)] transition-transform", open && "rotate-180")}>▾</span>
      </button>
      {open && (
        <div ref={list} id={`${id}-list`} role="listbox" data-handles-escape aria-labelledby={`${id}-label`} onKeyDown={onListKey} className="flex max-h-44 flex-col overflow-y-auto rounded-[var(--radius-md)] border border-[var(--c-border)]">
          {options.map((o) => (
            <div
              key={o.id || "default"} role="option" aria-selected={o.id === value} data-font={o.id} tabIndex={-1}
              onClick={() => pick(o.id)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(o.id); } }}
              style={o.family ? { fontFamily: o.family } : undefined}
              className={cx("flex h-8 shrink-0 cursor-pointer items-center justify-between px-2 text-[length:var(--text-ui-size)] hover:bg-[var(--c-raised)] focus-visible:bg-[var(--c-raised)] [@media(pointer:coarse)]:h-11", o.id === value && "bg-[var(--c-raised)] font-semibold")}
            >
              {o.text}{o.id === value && <span aria-hidden="true">✓</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
