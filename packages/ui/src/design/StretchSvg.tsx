import type { ReactNode } from "react";

/**
 * Capa SVG decorativa que llena su caja y se estira con ella (coordenadas de 0 a 100 en ambos ejes). Sirve para dibujar
 * el contorno de formas que CSS no sabe trazar, como el rombo. El SVG en línea vive en `design/` para que el estándar lo controle.
 * Usa `vector-effect="non-scaling-stroke"` en los trazos para que el grosor no se deforme al estirarse.
 */
export function StretchSvg({ children }: { children: ReactNode }) {
  return <svg aria-hidden="true" data-stretch-svg="" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}>{children}</svg>;
}
