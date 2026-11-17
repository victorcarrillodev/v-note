// Catálogo cerrado de temas de color (spec 006). Los valores están en `tokens.ts` (`paletteColors`); aquí viven los identificadores,
// la variante de cada tema y el orden del selector. Sin dependencias de React ni del DOM.
import { paletteColors, colors } from "./tokens";

/** Variante base de un tema: lo que hay en `data-theme`. */
export type Variant = "light" | "dark";

/** Temas de color, en el orden del selector: primero los cinco claros, luego los cinco oscuros. */
export const PALETTE_IDS = ["oceano", "bosque", "atardecer", "lavanda", "blanco-y-negro", "medianoche", "esmeralda", "rosa-nocturna", "ambar", "grafito"] as const;
export type PaletteId = (typeof PALETTE_IDS)[number];
export type ThemeId = "light" | "dark" | PaletteId;

/** Los 15 colores que un tema sobrescribe; el resto (scrim, elevaciones, chips, bloques y portadas) lo hereda de la variante. */
export type ThemeColors = {
  canvas: string; sidebar: string; card: string; raised: string; border: string; borderControl: string;
  text: string; textMuted: string; textPlaceholder: string; textDisabled: string;
  accent: string; onAccent: string; success: string; warning: string; danger: string;
};

export type ThemeDef = { id: PaletteId; variant: Variant; colors: ThemeColors };

const VARIANTS: Record<PaletteId, Variant> = {
  oceano: "light", bosque: "light", atardecer: "light", lavanda: "light", "blanco-y-negro": "light",
  medianoche: "dark", esmeralda: "dark", "rosa-nocturna": "dark", ambar: "dark", grafito: "dark",
};

/** Lista ordenada de temas con su variante y colores. */
export const THEMES: readonly ThemeDef[] = PALETTE_IDS.map((id) => ({ id, variant: VARIANTS[id], colors: paletteColors[id] }));

export const isPaletteId = (v: unknown): v is PaletteId => typeof v === "string" && (PALETTE_IDS as readonly string[]).includes(v);

/** Variante (`light`/`dark`) de cualquier tema. */
export function variantOf(id: ThemeId): Variant {
  return id === "light" || id === "dark" ? id : VARIANTS[id];
}

/** Los 15 colores de un tema: los del catálogo en los temas de color y los base de la variante en Claro y Oscuro. */
export function colorsOf(id: ThemeId): ThemeColors {
  if (id !== "light" && id !== "dark") return paletteColors[id];
  return Object.fromEntries(Object.keys(paletteColors.oceano).map((k) => [k, colors[k as keyof ThemeColors][id]])) as ThemeColors;
}
