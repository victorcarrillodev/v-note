import * as S from "@radix-ui/react-switch";
import * as TG from "@radix-ui/react-toggle-group";
import { useId, useRef, type KeyboardEvent } from "react";
import { cx } from "../design/cx";
import { Icon } from "../design/Icon";

/** Casilla de ≥ 24 px; el estado marcado se comunica con un ícono (forma), no solo con color. */
export function Checkbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  const id = useId();
  return (
    <label htmlFor={id} className="inline-flex min-h-6 cursor-pointer items-center gap-2 text-[length:var(--text-ui-size)]">
      <span className="relative inline-flex size-4.5 items-center justify-center">
        <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer absolute inset-0 m-0 h-full w-full cursor-pointer opacity-0" />
        <span aria-hidden="true" className={cx("inline-flex h-full w-full items-center justify-center rounded border", checked ? "border-[var(--c-accent)] bg-[var(--c-accent)] text-[var(--c-on-accent)]" : "border-[var(--c-border-control)] bg-[var(--c-card)]")}>
          {checked && <Icon name="check" size={14} />}
        </span>
      </span>
      {label}
    </label>
  );
}

export function Switch({ label, checked, onChange, disabled = false }: { label: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  const id = useId();
  return (
    <div className="inline-flex min-h-6 items-center gap-2 text-[length:var(--text-ui-size)]">
      <S.Root id={id} checked={checked} disabled={disabled} onCheckedChange={onChange} className={cx("relative h-5 w-9 rounded-full border disabled:cursor-not-allowed disabled:opacity-50", checked ? "border-[var(--c-accent)] bg-[var(--c-accent)]" : "border-[var(--c-border-control)] bg-[var(--c-raised)]")}>
        <S.Thumb className={cx("block h-3.5 w-3.5 rounded-full bg-[var(--c-card)] transition-transform duration-100", checked ? "translate-x-4.5" : "translate-x-0.5")} />
      </S.Root>
      <label htmlFor={id}>{label}</label>
    </div>
  );
}

/** Control segmentado (tema, tipografía, densidad): el valor activo se marca con fondo, peso y una marca, además del color. */
export function Segmented({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  const root = useRef<HTMLDivElement>(null);
  // Comportamiento de grupo de radios: las flechas mueven la selección y el foco.
  const onKeyDown = (e: KeyboardEvent) => {
    const dir = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    const i = options.findIndex((o) => o.value === value);
    const next = options[(i + dir + options.length) % options.length]!;
    onChange(next.value);
    requestAnimationFrame(() => root.current?.querySelector<HTMLElement>(`[data-value="${next.value}"]`)?.focus());
  };
  return (
    <TG.Root ref={root} type="single" value={value} onValueChange={(v) => v && onChange(v)} aria-label={label} onKeyDown={onKeyDown} rovingFocus={false} className="inline-flex rounded border border-[var(--c-border-control)] p-0.5">
      {options.map((o) => (
        <TG.Item key={o.value} value={o.value} data-value={o.value} role="radio" aria-checked={o.value === value} className={cx("inline-flex h-7 items-center gap-1 rounded-sm px-3 text-[length:var(--text-ui-small-size)]", o.value === value ? "bg-[var(--c-raised)] font-semibold text-[var(--c-text)]" : "text-[var(--c-text-muted)] hover:bg-[var(--c-raised)]")}>
          {o.value === value && <Icon name="check" size={14} />}
          {o.label}
        </TG.Item>
      ))}
    </TG.Root>
  );
}
