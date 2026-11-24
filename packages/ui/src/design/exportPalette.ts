// Paleta del documento exportado a partir del tema (spec 006, RF-6, CL-11). Los valores viven aquí (catálogo de diseño); el núcleo solo recibe datos.
import { EXPORT_BLOCK_COLORS, EXPORT_CHIPS, UNDERLINE_COLORS, type ExportPalette } from "@vnote/core";
import { resolveTheme } from "../theme/resolveTheme";
import { blockColors, chips, underlineColors } from "./tokens";
import { colorsOf, isPaletteId } from "./themes";

/**
 * «Sistema» usa lo que muestre el sistema ahora; Claro y Oscuro, los colores base; los diez temas de color, los de su catálogo.
 * Los colores de llamadas y de bloque son los de la variante (los temas no los redefinen).
 */
export function exportPaletteFor(mode: string | null | undefined, systemDark: boolean): ExportPalette {
  const variant = resolveTheme(mode, systemDark);
  const c = colorsOf(isPaletteId(mode) ? mode : variant);
  return {
    variant,
    canvas: c.canvas, text: c.text, textMuted: c.textMuted, border: c.border, borderControl: c.borderControl, raised: c.raised, accent: c.accent, danger: c.danger,
    chips: Object.fromEntries(EXPORT_CHIPS.map((k) => [k, { fg: chips[k][variant].fg, bg: chips[k][variant].bg }])) as ExportPalette["chips"],
    blocks: Object.fromEntries(EXPORT_BLOCK_COLORS.map((k) => [k, { text: blockColors[k]![variant].text, bg: blockColors[k]![variant].bg }])) as ExportPalette["blocks"],
    underlines: Object.fromEntries(UNDERLINE_COLORS.map((k) => [k, underlineColors[k]![variant]])) as ExportPalette["underlines"],
  };
}
