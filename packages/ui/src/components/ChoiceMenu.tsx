import * as D from "@radix-ui/react-dropdown-menu";
import { cx } from "../design/cx";
import { Icon } from "../design/Icon";

/** Menú desplegable para elegir una opción (reemplaza al `<select>` nativo): mismo estilo y fuente de la interfaz, con teclado completo. */
export function ChoiceMenu({ label, value, onChange, options, className }: {
  label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; className?: string;
}) {
  const current = options.find((o) => o.value === value)?.label ?? value;
  return (
    <D.Root modal={false}>
      <D.Trigger
        aria-label={`${label}: ${current}`}
        className={cx("inline-flex h-8 min-w-32 items-center justify-between gap-2 rounded-[var(--radius-md)] border border-[var(--c-border-control)] bg-[var(--c-card)] px-2.5 font-[family-name:var(--font-sans)] text-[length:var(--text-ui-size)] text-[var(--c-text)] outline-none hover:bg-[var(--c-raised)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--c-accent)] data-[state=open]:bg-[var(--c-raised)]", className)}
      >
        <span className="truncate">{current}</span>
        <span aria-hidden="true" className="shrink-0 text-[var(--c-text-muted)]"><Icon name="collapse" size={16} /></span>
      </D.Trigger>
      <D.Portal>
        <D.Content sideOffset={4} align="start" onFocusOutside={(e) => e.preventDefault()} onCloseAutoFocus={(e) => e.preventDefault()} className="z-[var(--z-menu)] min-w-40 rounded-md border border-[var(--c-border)] bg-[var(--c-card)] p-1 font-[family-name:var(--font-sans)] text-[length:var(--text-ui-size)] text-[var(--c-text)] shadow-[var(--elevation-3)]">
          <D.RadioGroup value={value} onValueChange={onChange}>
            {options.map((o) => (
              <D.RadioItem key={o.value} value={o.value} className="flex h-8 cursor-pointer items-center gap-2 rounded px-2 outline-none data-[highlighted]:bg-[var(--c-raised)]">
                <span className="inline-flex w-4 shrink-0 justify-center"><D.ItemIndicator><Icon name="check" size={14} /></D.ItemIndicator></span>
                {o.label}
              </D.RadioItem>
            ))}
          </D.RadioGroup>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
