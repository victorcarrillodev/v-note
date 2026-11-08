import type { ReactNode } from "react";

/** Capa SVG sin tamaño propio para dibujar sobre el lienzo del diagrama en coordenadas del lienzo; el SVG en línea vive en `design/` (estándar). `z` ordena la capa respecto a las formas: negativa = debajo, mayor que la elevación de una forma seleccionada = encima. */
export function OverlaySvg({ children, z = 0 }: { children: ReactNode; z?: number }) {
  return <svg width={1} height={1} style={{ position: "absolute", left: 0, top: 0, overflow: "visible", pointerEvents: "none", zIndex: z }}>{children}</svg>;
}
