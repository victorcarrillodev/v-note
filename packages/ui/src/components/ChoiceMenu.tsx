import { Children, Fragment, isValidElement, type PointerEventHandler, type ReactElement, type ReactNode } from "react";
import * as D from "@radix-ui/react-dropdown-menu";
import { cx } from "../design/cx";
import { Icon } from "../design/Icon";

export interface ChoiceOption { value: string; label: string; disabled?: boolean }

/** Estilo único de todos los desplegables de elección de la app (el menú de «Ajuste» de la galería es la referencia). */
const TRIGGER = "inline-flex items-center justify-between gap-2 rounded-[var(--radius-md)] border border-[var(--c-border-control)] bg-[var(--c-card)] font-[family-name:var(--font-sans)] text-[var(--c-text)] outline-none hover:bg-[var(--c-raised)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--c-accent)] disabled:cursor-not-allowed disabled:opacity-60 data-[state=open]:bg-[var(--c-raised)]";
const SIZE = { md: "h-8 min-w-32 px-2.5 text-[length:var(--text-ui-size)]", sm: "h-6 min-w-20 px-2 text-[length:var(--text-note-size)]" } as const;

/** Menú desplegable para elegir una opción (reemplaza al `<select>` nativo): mismo estilo y fuente de la interfaz, con teclado completo. */
export function ChoiceMenu({ label, value, onChange, options, className, size = "md", disabled, id, combobox, exactLabel, onPointerDown, extra }: {
  label: string; value: string; onChange: (v: string) => void; options: readonly ChoiceOption[]; className?: string;
  size?: keyof typeof SIZE; disabled?: boolean; id?: string;
  /** Se anuncia como cuadro combinado (como el `<select>` que reemplaza). */
  combobox?: boolean;
  /** Usa `label` tal cual como nombre accesible, sin añadir la opción actual. */
  exactLabel?: boolean;
  onPointerDown?: PointerEventHandler<HTMLButtonElement>;
  /** Atributos `data-*` para el disparador (pruebas, estilos). */
  extra?: Record<string, string>;
}) {
  const shown = options.find((o) => o.value === value) ?? options[0];
  const current = shown?.label ?? value;
  return (
    <D.Root modal={false}>
      <D.Trigger
        id={id}
        disabled={disabled}
        {...(label ? { "aria-label": exactLabel ? label : `${label}: ${current}` } : {})}
        {...(combobox ? { role: "combobox", "aria-haspopup": "listbox" } : {})}
        data-value={value}
        {...extra}
        {...(onPointerDown ? { onPointerDown } : {})}
        className={cx(TRIGGER, SIZE[size], className)}
      >
        <span className="truncate">{current}</span>
        <span aria-hidden="true" className="shrink-0 text-[var(--c-text-muted)]"><Icon name="collapse" size={16} /></span>
      </D.Trigger>
      <D.Portal>
        <D.Content sideOffset={4} align="start" onFocusOutside={(e) => e.preventDefault()} onCloseAutoFocus={(e) => e.preventDefault()} className="z-[calc(var(--z-dialog)+10)] max-h-[min(16rem,var(--radix-dropdown-menu-content-available-height))] min-w-[max(10rem,var(--radix-dropdown-menu-trigger-width))] overflow-y-auto rounded-[var(--radius-md)] border border-[var(--c-border)] bg-[var(--c-card)] p-1 font-[family-name:var(--font-sans)] text-[length:var(--text-ui-size)] text-[var(--c-text)] shadow-[var(--elevation-3)]">
          <D.RadioGroup value={value} onValueChange={onChange}>
            {options.map((o) => (
              <D.RadioItem key={o.value} value={o.value} data-value={o.value} disabled={o.disabled} className="flex h-8 cursor-pointer items-center gap-2 rounded-[var(--radius-sm)] px-2 outline-none data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50 data-[highlighted]:bg-[var(--c-raised)]">
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

function textOf(node: ReactNode): string {
  return Children.toArray(node).map((c) => (typeof c === "string" || typeof c === "number" ? String(c) : isValidElement(c) ? textOf((c.props as { children?: ReactNode }).children) : "")).join("");
}

function collect(children: ReactNode, out: ChoiceOption[]): void {
  Children.forEach(children, (c) => {
    if (!isValidElement(c)) return;
    const el = c as ReactElement<{ value?: string | number; children?: ReactNode; disabled?: boolean }>;
    if (el.type === Fragment) collect(el.props.children, out);
    else if (el.type === "option") {
      const label = textOf(el.props.children);
      out.push({ value: String(el.props.value ?? label), label, ...(el.props.disabled ? { disabled: true } : {}) });
    }
  });
}

/**
 * Sustituto directo del `<select>` nativo: acepta `<option>` como hijos y `onChange` con `e.target.value`,
 * pero abre el mismo menú que `ChoiceMenu`, para que todas las listas de la app se vean igual.
 */
export function Dropdown({ children, value, onChange, "aria-label": ariaLabel, id, disabled, className, size, onPointerDown, ...rest }: {
  children: ReactNode; value: string | number; onChange?: (e: { target: { value: string } }) => void;
  "aria-label"?: string; id?: string; disabled?: boolean; className?: string; size?: keyof typeof SIZE; onPointerDown?: PointerEventHandler<HTMLButtonElement>;
  [data: `data-${string}`]: string | undefined;
}) {
  const options: ChoiceOption[] = [];
  collect(children, options);
  return (
    <ChoiceMenu
      combobox exactLabel
      label={ariaLabel ?? ""}
      value={String(value)}
      onChange={(v) => onChange?.({ target: { value: v } })}
      options={options}
      {...(id ? { id } : {})}
      {...(disabled ? { disabled } : {})}
      {...(className ? { className } : {})}
      {...(size ? { size } : {})}
      {...(onPointerDown ? { onPointerDown } : {})}
      extra={Object.fromEntries(Object.entries(rest).filter(([k, v]) => k.startsWith("data-") && typeof v === "string")) as Record<string, string>}
    />
  );
}
