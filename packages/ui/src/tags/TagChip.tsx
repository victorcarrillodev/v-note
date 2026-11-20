import type { ReactNode } from "react";
import { accentOnColor, accentStops, accentSwatch, type CustomAccent, type TagColor } from "@vnote/core";
import { cx } from "../design/cx";
import { Icon } from "../design/Icon";

/** Estilo de un chip según el NOMBRE de color; el tema decide el valor (RF-2.6). */
export const tagChipStyle = (c: TagColor) =>
  c.startsWith("#") ? { background: accentSwatch(c as CustomAccent), color: accentOnColor(c as CustomAccent) } : { background: `var(--block-${c}-bg)`, color: `var(--block-${c}-text)` };
/** Color sólido del chip para el ícono de cerrar: la primera parada del color propio, o el tono fuerte de los colores de bloque (su fondo es muy claro para verse sobre blanco). */
const tagSolid = (c: TagColor) => (c.startsWith("#") ? accentStops(c as CustomAccent)[0]! : `var(--block-${c}-text)`);
/** Color sólido que representa a la etiqueta (muestras y puntos). */
export const tagSwatch = (c: TagColor) => (c.startsWith("#") ? accentSwatch(c as CustomAccent) : `var(--block-${c}-text)`);

const BASE = "inline-flex h-6 items-center gap-1 rounded-full pl-2.5 text-[length:var(--text-ui-small-size)] leading-none";

/**
 * Etiqueta estándar de la aplicación: píldora con el color de la etiqueta. Con `onRemove` lleva la «×» dentro de un círculo blanco;
 * con `onToggle` es un botón que se puede activar (filtros).
 */
export function TagChip({ name, color, onRemove, removeLabel, onToggle, pressed, children }: {
  name: string; color: TagColor; onRemove?: () => void; removeLabel?: string; onToggle?: () => void; pressed?: boolean; children?: ReactNode;
}) {
  const close = onRemove && (
    <button type="button" aria-label={removeLabel ?? name} onClick={onRemove} style={{ color: tagSolid(color) }} className="ml-1.5 mr-1 inline-flex size-4 items-center justify-center rounded-full bg-white hover:opacity-80">
      <Icon name="close" size={14} />
    </button>
  );
  if (onToggle) {
    return (
      <button type="button" aria-pressed={pressed === true} onClick={onToggle} data-color={color} style={tagChipStyle(color)} className={cx(BASE, "pr-2.5", pressed ? "outline outline-2 outline-offset-1 outline-[var(--c-text)] font-semibold" : "opacity-80 hover:opacity-100")}>
        {pressed && <Icon name="check" size={14} />}{name}{children}
      </button>
    );
  }
  return (
    <span data-color={color} style={tagChipStyle(color)} className={cx(BASE, !onRemove && "pr-2.5")}>
      {name}{children}{close}
    </span>
  );
}
