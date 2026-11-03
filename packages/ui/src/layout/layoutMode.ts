export type LayoutMode = "wide" | "normal" | "narrow" | "scroll";

/** Puntos de corte del estándar (plan 10.4): 1 280, 1 040 y 900 px. Por debajo de 900 solo se permite desplazar (sin diseño de teléfono). */
export const BREAKPOINTS = { wide: 1280, normal: 1040, narrow: 900 } as const;

export function layoutMode(width: number): LayoutMode {
  if (width >= BREAKPOINTS.wide) return "wide";
  if (width >= BREAKPOINTS.normal) return "normal";
  if (width >= BREAKPOINTS.narrow) return "narrow";
  return "scroll";
}

/** La barra lateral se pliega sola y se superpone por debajo de 1 040 px. */
export const sidebarMode = (width: number): "docked" | "overlay" => (width >= BREAKPOINTS.normal ? "docked" : "overlay");
