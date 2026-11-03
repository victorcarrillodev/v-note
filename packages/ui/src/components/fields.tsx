import { useId, type ReactNode } from "react";
import { cx } from "../design/cx";

const CONTROL = "w-full rounded border bg-[var(--c-card)] px-2 text-[length:var(--text-ui-size)] text-[var(--c-text)] placeholder:text-[var(--c-text-placeholder)] disabled:cursor-not-allowed disabled:opacity-60";
const border = (error?: string) => (error ? "border-[var(--c-danger)]" : "border-[var(--c-border-control)]");

function Field({ id, label, error, children }: { id: string; label: string; error?: string | undefined; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-[length:var(--text-ui-small-size)] font-medium text-[var(--c-text)]">{label}</label>
      {children}
      {error && <p id={`${id}-error`} role="alert" className="flex items-center gap-1 text-[length:var(--text-note-size)] text-[var(--c-danger)]">{error}</p>}
    </div>
  );
}
const describe = (id: string, error?: string) => ({ "aria-invalid": error ? true : undefined, "aria-describedby": error ? `${id}-error` : undefined });

/** Campo de texto con etiqueta visible; el error se comunica con borde, `aria-invalid` y un MENSAJE (no solo color). */
export function TextField({ label, value, onChange, error, type = "text", placeholder, disabled, className, ariaLabel }: { ariaLabel?: string; label: string; value: string; onChange: (v: string) => void; error?: string; type?: string; placeholder?: string; disabled?: boolean; className?: string }) {
  const id = useId();
  return (
    <Field id={id} label={label} error={error}>
      <input id={id} type={type} {...(ariaLabel ? { "aria-label": ariaLabel } : {})} value={value} placeholder={placeholder} disabled={disabled} onChange={(e) => onChange(e.target.value)} {...describe(id, error)} className={cx(CONTROL, "h-8", border(error), className)} />
    </Field>
  );
}

export function TextArea({ label, value, onChange, error, placeholder, className }: { label: string; value: string; onChange: (v: string) => void; error?: string; placeholder?: string; className?: string }) {
  const id = useId();
  const rows = Math.min(12, Math.max(3, value.split("\n").length));
  return (
    <Field id={id} label={label} error={error}>
      <textarea id={id} rows={rows} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} {...describe(id, error)} className={cx(CONTROL, "py-1", border(error), className)} />
    </Field>
  );
}

export function Select({ label, value, onChange, options, error }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; error?: string }) {
  const id = useId();
  return (
    <Field id={id} label={label} error={error}>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} {...describe(id, error)} className={cx(CONTROL, "h-8", border(error))}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </Field>
  );
}
