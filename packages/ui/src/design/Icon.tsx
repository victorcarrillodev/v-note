import { iconMap, type IconName } from "./iconMap";

export const ICON_SIZES = [14, 16, 20, 24, 40, 48] as const;
export type IconSize = (typeof ICON_SIZES)[number];

/**
 * Ícono del estándar: hereda el color del texto; trazo 1,75 hasta 20 px y 1,5 desde 24 px.
 * Sin `label` es decorativo (oculto a lectores); con `label` expone role=img y nombre accesible.
 */
export function Icon({ name, size = 16, label, className }: { name: IconName; size?: IconSize; label?: string; className?: string }) {
  const Cmp = iconMap[name];
  const common = { size, strokeWidth: size >= 24 ? 1.5 : 1.75, color: "currentColor", ...(className ? { className } : {}) };
  return label ? <Cmp {...common} role="img" aria-label={label} /> : <Cmp {...common} aria-hidden="true" focusable="false" />;
}
