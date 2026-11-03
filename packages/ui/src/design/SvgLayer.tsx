import type { ReactNode } from "react";

/** Capa SVG decorativa (conectores) sobre un lienzo: el SVG en línea vive en `design/` para que el estándar lo controle. */
export function SvgLayer({ width, height, children }: { width: number; height: number; children: ReactNode }) {
  return <svg width={width} height={height} style={{ position: "absolute", inset: 0 }} aria-hidden="true">{children}</svg>;
}
