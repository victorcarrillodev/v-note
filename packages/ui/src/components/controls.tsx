import * as S from "@radix-ui/react-switch";
import * as TG from "@radix-ui/react-toggle-group";
import { useId, useRef, type KeyboardEvent, type ReactNode } from "react";
import { cx } from "../design/cx";
import { Icon } from "../design/Icon";

/** Casilla estándar de la aplicación: ≥ 18 px, foco visible y estado marcado con ícono (forma), no solo con color. Sin `label` visible, pasa `ariaLabel`. */
export function Checkbox({ label, ariaLabel, checked, onChange, disabled = false, className }: { label?: ReactNode; ariaLabel?: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; className?: string }) {
  const id = useId();
  return (
    <label htmlFor={id} className={cx("inline-flex min-h-6 items-center gap-2 text-[length:var(--text-ui-size)] [@media(pointer:coarse)]:min-h-11", disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer", className)}>
      <span className="relative inline-flex size-4.5 shrink-0 items-center justify-center [@media(pointer:coarse)]:size-6">
        <input id={id} type="checkbox" aria-label={label === undefined ? ariaLabel : undefined} checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} className="peer absolute inset-0 m-0 h-full w-full cursor-[inherit] opacity-0" />
        <span aria-hidden="true" className={cx("inline-flex h-full w-full items-center justify-center rounded border transition-colors duration-100 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--c-accent)]", checked ? "border-[var(--c-accent)] bg-[var(--c-accent)] text-[var(--c-on-accent)]" : "border-[var(--c-border-control)] bg-[var(--c-card)]")}>
          {checked && <Icon name="check" size={14} />}
        </span>
      </span>
      {label}
    </label>
  );
}

/** Selector de color estándar: muestra el color como una muestra redonda sin borde; el selector nativo del sistema queda invisible encima. */
export function ColorInput({ label, value, onChange, className }: { label: string; value: string; onChange: (hex: string) => void; className?: string }) {
  return (
    <span className={cx("relative inline-block size-8 shrink-0 [@media(pointer:coarse)]:size-11", className)}>
      <input type="color" aria-label={label} title={label} value={value} onChange={(e) => onChange(e.target.value)} className="peer absolute inset-0 m-0 h-full w-full cursor-pointer opacity-0" />
      <span aria-hidden="true" style={{ background: value }} className="pointer-events-none block h-full w-full rounded-full transition-shadow duration-100 peer-hover:ring-2 peer-hover:ring-[var(--c-border-control)] peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--c-accent)]" />
    </span>
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
