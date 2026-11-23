import * as S from "@radix-ui/react-switch";
import * as TG from "@radix-ui/react-toggle-group";
import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Popover } from "./Popover";
import { cx } from "../design/cx";
import { Icon } from "../design/Icon";
import { colorPresets } from "../design/tokens";

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

const HEX6 = /^#[0-9a-fA-F]{6}$/;

/** Botón de opción estándar: círculo con punto interior (forma, no solo color), foco visible; el `<input type="radio">` sigue siendo el control real. */
export function Radio({ name, checked, onChange, disabled = false, ariaLabel }: { name: string; checked: boolean; onChange: () => void; disabled?: boolean; ariaLabel?: string }) {
  return (
    <span className="relative inline-flex size-4.5 shrink-0 items-center justify-center [@media(pointer:coarse)]:size-6">
      <input type="radio" name={name} checked={checked} disabled={disabled} onChange={onChange} {...(ariaLabel ? { "aria-label": ariaLabel } : {})} className="peer absolute inset-0 m-0 h-full w-full cursor-[inherit] opacity-0" />
      <span aria-hidden="true" className={cx("inline-flex h-full w-full items-center justify-center rounded-full border transition-colors duration-100 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--c-accent)]", checked ? "border-[var(--c-accent)]" : "border-[var(--c-border-control)] bg-[var(--c-card)]")}>
        {checked && <span className="size-2 rounded-full bg-[var(--c-accent)]" />}
      </span>
    </span>
  );
}

/**
 * Selector de color estándar: una muestra redonda que abre un panel con colores predefinidos y un campo hexadecimal, con el mismo
 * estilo que el resto de menús (ya no se abre la ventana de color del sistema). El `<input type="color">` sigue en el documento,
 * oculto, como respaldo accesible y para pruebas.
 */
export function ColorInput({ label, value, onChange, className }: { label: string; value: string; onChange: (hex: string) => void; className?: string }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(value);
  const [shown, setShown] = useState(value);
  if (value !== shown) { setShown(value); setText(value); }
  const apply = (hex: string) => { setText(hex); onChange(hex); };
  return (
    <span className={cx("relative inline-block size-8 shrink-0 [@media(pointer:coarse)]:size-11", className)}>
      <input type="color" aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} tabIndex={-1} className="sr-only" />
      <Popover open={open} onOpenChange={setOpen} align="start" trigger={
        <button type="button" title={label} aria-label={t("color.open", { label })} aria-haspopup="dialog" className="peer block h-full w-full cursor-pointer rounded-full outline-none ring-offset-0 transition-shadow duration-100 hover:ring-2 hover:ring-[var(--c-border-control)] focus-visible:ring-2 focus-visible:ring-[var(--c-accent)]" style={{ background: value }} />
      }>
        <div className="flex w-48 flex-col gap-2">
          <div role="group" aria-label={label} className="grid grid-cols-8 gap-1">
            {colorPresets.map((c) => (
              <button key={c} type="button" aria-label={c} aria-pressed={c.toLowerCase() === value.toLowerCase()} onClick={() => apply(c)} style={{ background: c }} className="size-5 rounded-full border border-[var(--c-border)] outline-none hover:scale-110 focus-visible:ring-2 focus-visible:ring-[var(--c-accent)] aria-pressed:ring-2 aria-pressed:ring-[var(--c-accent)]" />
            ))}
          </div>
          <input
            aria-label={t("color.hex")}
            value={text}
            spellCheck={false}
            onChange={(e) => { setText(e.target.value); if (HEX6.test(e.target.value)) onChange(e.target.value); }}
            className="h-8 w-full rounded-[var(--radius-md)] border border-[var(--c-border-control)] bg-[var(--c-card)] px-2.5 font-[family-name:var(--font-mono)] text-[length:var(--text-ui-size)] outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--c-accent)]"
          />
        </div>
      </Popover>
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
export function Segmented({ label, value, onChange, options, compact }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; compact?: boolean }) {
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
        <TG.Item key={o.value} value={o.value} data-value={o.value} role="radio" aria-checked={o.value === value} className={cx("inline-flex h-7 items-center gap-1 rounded-sm text-[length:var(--text-ui-small-size)]", compact ? "px-2" : "px-3", o.value === value ? "bg-[var(--c-raised)] font-semibold text-[var(--c-text)]" : "text-[var(--c-text-muted)] hover:bg-[var(--c-raised)]")}>
          {o.value === value && <Icon name="check" size={14} />}
          {o.label}
        </TG.Item>
      ))}
    </TG.Root>
  );
}
