import type { ReactNode } from "react";

/**
 * Capa SVG decorativa (conectores) sobre un lienzo: el SVG en línea vive en `design/` para que el estándar lo controle.
 * Con `unbounded` no recorta lo que se sale de su caja ni recibe el puntero (capas en el espacio de un lienzo con zoom).
 */
export function SvgLayer({ width, height, unbounded = false, children }: { width: number; height: number; unbounded?: boolean; children: ReactNode }) {
  return <svg width={width} height={height} style={{ position: "absolute", ...(unbounded ? { left: 0, top: 0, overflow: "visible", pointerEvents: "none" } : { inset: 0 }) }} aria-hidden="true">{children}</svg>;
}
