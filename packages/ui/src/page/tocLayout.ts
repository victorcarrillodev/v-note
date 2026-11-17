import { BREAKPOINTS } from "../layout/layoutMode";
import { pageStyle, sizes } from "../design/tokens";

/** Ancho de la columna del índice y separación con el contenido (px). */
export const TOC_WIDTH = 224;
export const TOC_GAP = 24;
/** Margen mínimo que necesita el índice a la derecha del contenido. */
export const TOC_NEEDED_MARGIN = TOC_WIDTH + TOC_GAP;

/** Ancho del contenido según el ancho elegido para la página; «completo» no deja margen. */
export const contentWidthOf = (width: "narrow" | "normal" | "wide" | "full" | undefined): number =>
  width === "full" ? Infinity : pageStyle.widths[width ?? "normal"];

/**
 * ¿Cabe el índice flotante en el margen derecho? (RF-7.7, CL-17). La barra lateral ocupa su ancho solo cuando está fija
 * (desde 1 040 px); el contenido va centrado en lo que queda. Si no cabe se usa el modo reducido («En esta página»).
 */
export function tocFits(viewport: number, contentWidth: number): boolean {
  const sidebar = viewport >= BREAKPOINTS.normal ? sizes.sidebarWidth : 0;
  const main = viewport - sidebar;
  const content = Math.min(contentWidth, main);
  return (main - content) / 2 >= TOC_NEEDED_MARGIN;
}
