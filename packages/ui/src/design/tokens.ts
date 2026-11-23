// Catálogo ÚNICO de valores de diseño (spec 002, plan 4). La hoja `tokens.css` se genera de aquí y una prueba comprueba que coinciden.
// Sin dependencias de React ni del DOM.
import type { PaletteId, ThemeColors } from "./themes";

export const themes = ["light", "dark"] as const;
export type Theme = (typeof themes)[number];
type Pair = { light: string; dark: string };

/** Superficies, texto, acento y estados. Valores verificados contra el contraste exigido (ver `tokens.test.ts`). */
export const colors = {
  canvas: { light: "#FCF9F5", dark: "#131313" },
  sidebar: { light: "#F7F6F3", dark: "#1B1C1C" },
  card: { light: "#FFFFFF", dark: "#222323" },
  raised: { light: "#EFEDE8", dark: "#2A2B2B" },
  border: { light: "#E9E8E4", dark: "#282828" },
  borderControl: { light: "#8A8884", dark: "#807F7B" },
  text: { light: "#37352F", dark: "#E3E2DE" },
  textMuted: { light: "#65635F", dark: "#A3A29E" },
  textPlaceholder: { light: "#6E6C68", dark: "#8C8B87" },
  textDisabled: { light: "#A8A6A1", dark: "#5F5E5B" },
  accent: { light: "#0B6BCB", dark: "#5CA6D6" },
  onAccent: { light: "#FFFFFF", dark: "#0B1B26" },
  success: { light: "#1B7F6E", dark: "#4DAB9A" },
  warning: { light: "#9A4F08", dark: "#E08A3C" },
  danger: { light: "#C0312F", dark: "#EC6A67" },
  scrim: { light: "rgba(0, 0, 0, 0.4)", dark: "rgba(0, 0, 0, 0.6)" },
} satisfies Record<string, Pair>;


/** Valores de los diez temas de color (Apéndice A del plan 006). Solo sobrescriben estos 15 colores; el resto lo hereda de la variante. */
export const paletteColors: Record<PaletteId, ThemeColors> = {
  oceano: { canvas: "#F3F8FB", sidebar: "#EAF2F7", card: "#FFFFFF", raised: "#E1ECF3", border: "#D5E3EC", borderControl: "#6F8797", text: "#16303F", textMuted: "#486373", textPlaceholder: "#52697A", textDisabled: "#9DB0BC", accent: "#0A6E8C", onAccent: "#FFFFFF", success: "#17745A", warning: "#9A4F08", danger: "#C0312F" },
  bosque: { canvas: "#F5F8F1", sidebar: "#ECF2E6", card: "#FFFFFF", raised: "#E3ECDA", border: "#D8E3CD", borderControl: "#7A8A6E", text: "#22301F", textMuted: "#52604B", textPlaceholder: "#5B6955", textDisabled: "#A4B09B", accent: "#2D7A3E", onAccent: "#FFFFFF", success: "#17745A", warning: "#9A4F08", danger: "#C0312F" },
  atardecer: { canvas: "#FFF8F2", sidebar: "#FBEEE3", card: "#FFFFFF", raised: "#F6E4D4", border: "#EFD9C7", borderControl: "#8E7766", text: "#3A2518", textMuted: "#6A5242", textPlaceholder: "#74594A", textDisabled: "#B9A595", accent: "#BE3F0C", onAccent: "#FFFFFF", success: "#17745A", warning: "#9A4F08", danger: "#C0312F" },
  lavanda: { canvas: "#F9F7FD", sidebar: "#F0ECF9", card: "#FFFFFF", raised: "#E7E1F5", border: "#DDD5EF", borderControl: "#80779A", text: "#2A2140", textMuted: "#5A5075", textPlaceholder: "#645A80", textDisabled: "#B1A9C6", accent: "#6B3FC2", onAccent: "#FFFFFF", success: "#17745A", warning: "#9A4F08", danger: "#C0312F" },
  "blanco-y-negro": { canvas: "#FFFFFF", sidebar: "#F5F5F5", card: "#FFFFFF", raised: "#EBEBEB", border: "#C4C4C4", borderControl: "#000000", text: "#000000", textMuted: "#333333", textPlaceholder: "#4D4D4D", textDisabled: "#8C8C8C", accent: "#000000", onAccent: "#FFFFFF", success: "#17745A", warning: "#9A4F08", danger: "#C0312F" },
  medianoche: { canvas: "#0E1320", sidebar: "#141B2C", card: "#1A2336", raised: "#222D45", border: "#26314A", borderControl: "#7482A3", text: "#E4E9F5", textMuted: "#A2AEC8", textPlaceholder: "#8B97B2", textDisabled: "#56627E", accent: "#8CA8FF", onAccent: "#0B1130", success: "#4DAB9A", warning: "#E08A3C", danger: "#EC6A67" },
  esmeralda: { canvas: "#0C1512", sidebar: "#121E1A", card: "#182822", raised: "#20352D", border: "#243A31", borderControl: "#6E9183", text: "#E1EEE8", textMuted: "#9DB8AC", textPlaceholder: "#86A295", textDisabled: "#4F6B5F", accent: "#4FD1A1", onAccent: "#06231A", success: "#4DAB9A", warning: "#E08A3C", danger: "#EC6A67" },
  "rosa-nocturna": { canvas: "#19111A", sidebar: "#211722", card: "#2A1D2C", raised: "#352538", border: "#3A2A3D", borderControl: "#9A7A9E", text: "#F1E4F0", textMuted: "#BBA2BC", textPlaceholder: "#A28BA4", textDisabled: "#6A546C", accent: "#F28BC4", onAccent: "#2B0A1E", success: "#4DAB9A", warning: "#E08A3C", danger: "#EC6A67" },
  ambar: { canvas: "#17120C", sidebar: "#1F1911", card: "#292117", raised: "#33291C", border: "#3A2F20", borderControl: "#917E62", text: "#F0E6D6", textMuted: "#BCAE96", textPlaceholder: "#A29478", textDisabled: "#665843", accent: "#EBAA3A", onAccent: "#241600", success: "#4DAB9A", warning: "#E08A3C", danger: "#EC6A67" },
  grafito: { canvas: "#232323", sidebar: "#1C1C1C", card: "#2B2B2B", raised: "#353535", border: "#3E3E3E", borderControl: "#9A9A9A", text: "#EDEDED", textMuted: "#BDBDBD", textPlaceholder: "#ABABAB", textDisabled: "#707070", accent: "#D6D6D6", onAccent: "#1F1F1F", success: "#4DAB9A", warning: "#E08A3C", danger: "#EC6A67" },
};

type FgBg = { fg: string; bg: string };
/** Chips y avisos semánticos: texto sobre su propio fondo. */
export const chips: Record<"info" | "success" | "warning" | "error", Record<Theme, FgBg>> = {
  info: { light: { fg: "#0B5CAD", bg: "#DCEBFA" }, dark: { fg: "#8EC3E8", bg: "#1D3447" } },
  success: { light: { fg: "#145E4F", bg: "#DDF1E5" }, dark: { fg: "#7BD0AE", bg: "#1F3A2B" } },
  warning: { light: { fg: "#7A3F06", bg: "#FCE8D3" }, dark: { fg: "#F0AE72", bg: "#46301B" } },
  error: { light: { fg: "#9E2523", bg: "#FBE3E1" }, dark: { fg: "#F5A19E", bg: "#472624" } },
};

/** Colores de bloque (texto de color y resaltado). Se guardan por NOMBRE; el tema decide el valor (CL-5). */
export const blockColors: Record<string, Record<Theme, { text: string; bg: string }>> = {
  gray: { light: { text: "#6B6A66", bg: "#EBEAE6" }, dark: { text: "#A3A29E", bg: "#2F2F2E" } },
  brown: { light: { text: "#8A4F2A", bg: "#EFE3DA" }, dark: { text: "#C98B5E", bg: "#3A2F27" } },
  red: { light: { text: "#C0312F", bg: "#FBE3E1" }, dark: { text: "#EC6A67", bg: "#472624" } },
  orange: { light: { text: "#A8540A", bg: "#FCE8D3" }, dark: { text: "#E08A3C", bg: "#46301B" } },
  yellow: { light: { text: "#8A6500", bg: "#FBF0C2" }, dark: { text: "#D9AE3A", bg: "#463A16" } },
  green: { light: { text: "#1B7F4E", bg: "#DDF1E5" }, dark: { text: "#5BC08A", bg: "#1F3A2B" } },
  blue: { light: { text: "#0B6BCB", bg: "#DCEBFA" }, dark: { text: "#5CA6D6", bg: "#1D3447" } },
  purple: { light: { text: "#7A3FB5", bg: "#EBE0F7" }, dark: { text: "#B58AE0", bg: "#33283F" } },
  pink: { light: { text: "#B5307A", bg: "#F8DFEC" }, dark: { text: "#E06BA8", bg: "#42263A" } },
};

/** Portadas con degradado suave (único uso decorativo permitido en páginas). */
export const coverGradients: Record<string, Record<Theme, [string, string]>> = {
  sand: { light: ["#F3E7D3", "#E9D4B5"], dark: ["#4A3D2A", "#33291C"] },
  sage: { light: ["#DCE8DA", "#BFD6C2"], dark: ["#2E4033", "#22302A"] },
  sky: { light: ["#DCEBFA", "#B9D6F2"], dark: ["#243C52", "#1A2B3B"] },
  lavender: { light: ["#E7DDF5", "#D2C3EC"], dark: ["#3A2F4F", "#2A223B"] },
  rose: { light: ["#F6DDE6", "#EDBFD1"], dark: ["#4D2E3C", "#37212B"] },
  graphite: { light: ["#E4E3DF", "#C9C7C0"], dark: ["#3A3A39", "#2A2A29"] },
};

/**
 * Fuentes que se pueden elegir para una página (spec 005, RF-5, D-16): familia declarada en `fonts.css`, archivo y pila de respaldo.
 * `id` es el `FontId` del núcleo; la variable CSS de cada una es `--font-<id>`.
 */
export const pageFonts: Record<string, { family: string; file: string; fallback: string; label: string }> = {
  inter: { family: "Inter Variable", file: "inter-latin-wght-normal.woff2", fallback: "system-ui, -apple-system, \"Segoe UI\", Roboto, sans-serif", label: "Inter" },
  geist: { family: "Geist Variable", file: "geist-latin-wght-normal.woff2", fallback: "system-ui, -apple-system, \"Segoe UI\", Roboto, sans-serif", label: "Geist" },
  nunito: { family: "Nunito Variable", file: "nunito-latin-wght-normal.woff2", fallback: "system-ui, -apple-system, \"Segoe UI\", Roboto, sans-serif", label: "Nunito" },
  "source-serif": { family: "Source Serif 4 Variable", file: "source-serif-4-latin-wght-normal.woff2", fallback: "Georgia, \"Times New Roman\", serif", label: "Source Serif" },
  lora: { family: "Lora Variable", file: "lora-latin-wght-normal.woff2", fallback: "Georgia, \"Times New Roman\", serif", label: "Lora" },
  merriweather: { family: "Merriweather Variable", file: "merriweather-latin-wght-normal.woff2", fallback: "Georgia, \"Times New Roman\", serif", label: "Merriweather" },
  "jetbrains-mono": { family: "JetBrains Mono Variable", file: "jetbrains-mono-latin-wght-normal.woff2", fallback: "ui-monospace, \"SF Mono\", Menlo, Consolas, monospace", label: "JetBrains Mono" },
  "fira-code": { family: "Fira Code Variable", file: "fira-code-latin-wght-normal.woff2", fallback: "ui-monospace, \"SF Mono\", Menlo, Consolas, monospace", label: "Fira Code" },
  atkinson: { family: "Atkinson Hyperlegible Next Variable", file: "atkinson-hyperlegible-next-latin-wght-normal.woff2", fallback: "system-ui, -apple-system, \"Segoe UI\", Roboto, sans-serif", label: "Atkinson Hyperlegible" },
  caveat: { family: "Caveat Variable", file: "caveat-latin-wght-normal.woff2", fallback: "\"Segoe Print\", \"Comic Sans MS\", cursive", label: "Caveat" },
  "comic-neue": { family: "Comic Neue", file: "comic-neue-latin-400-normal.woff2", fallback: "\"Comic Sans MS\", \"Chalkboard SE\", cursive", label: "Comic Neue" },
  "patrick-hand": { family: "Patrick Hand", file: "patrick-hand-latin-400-normal.woff2", fallback: "\"Segoe Print\", \"Comic Sans MS\", cursive", label: "Patrick Hand" },
  "indie-flower": { family: "Indie Flower", file: "indie-flower-latin-400-normal.woff2", fallback: "\"Segoe Print\", \"Comic Sans MS\", cursive", label: "Indie Flower" },
  kalam: { family: "Kalam", file: "kalam-latin-400-normal.woff2", fallback: "\"Segoe Print\", \"Comic Sans MS\", cursive", label: "Kalam" },
};

/** Valores de partida del editor de portadas (selector de color y degradado propio), fijos para cualquier tema. */
/** Colores predefinidos del selector de color estándar (`ColorInput`). */
export const colorPresets = ["#ef4444", "#f97316", "#f59e0b", "#eab308", "#84cc16", "#22c55e", "#14b8a6", "#06b6d4", "#3b82f6", "#6366f1", "#8b5cf6", "#d946ef", "#ec4899", "#64748b", "#1f2937", "#ffffff"];
export const coverEditor = { neutral: "#808080", gradientStart: "#f3e7d3", gradientEnd: "#b9d6f2", gradientThird: "#e9d4b5" } as const;

type Level = { size: number; line: number; weight: 400 | 500 | 600 | 700 };
export const typography: Record<"pageTitle" | "h1" | "h2" | "h3" | "reading" | "dialogTitle" | "component" | "ui" | "uiSmall" | "note" | "label", Level> = {
  pageTitle: { size: 48, line: 56, weight: 700 },
  h1: { size: 28, line: 36, weight: 700 },
  h2: { size: 22, line: 30, weight: 600 },
  h3: { size: 18, line: 26, weight: 600 },
  reading: { size: 17, line: 28, weight: 400 },
  dialogTitle: { size: 18, line: 24, weight: 600 },
  component: { size: 14, line: 20, weight: 600 },
  ui: { size: 14, line: 20, weight: 400 },
  uiSmall: { size: 13, line: 18, weight: 500 },
  note: { size: 12, line: 16, weight: 500 },
  label: { size: 11, line: 14, weight: 600 },
};

/** Espaciado de base 4 px. */
export const spacing = [4, 8, 12, 16, 20, 24, 32, 40, 48] as const;
export const radii = { none: 0, xs: 2, base: 4, md: 6, lg: 8, full: 9999 } as const;

/** Elevación: en claro, borde y sombra; en oscuro, escalón de superficie sin sombra difusa. */
export const elevation = {
  light: {
    1: { shadow: "0px 1px 2px rgba(55, 53, 47, 0.06)" },
    2: { shadow: "0px 2px 4px rgba(55, 53, 47, 0.08)" },
    3: { shadow: "0px 8px 16px rgba(55, 53, 47, 0.12)" },
    4: { shadow: "0px 16px 32px rgba(55, 53, 47, 0.18)" },
  },
  dark: {
    1: { shadow: "none", surface: "sidebar" },
    2: { shadow: "none", surface: "card" },
    3: { shadow: "none", surface: "raised" },
    4: { shadow: "none", surface: "raised" },
  },
} as const;

/** Duraciones en milisegundos. */
export const motion = { instant: 0, fast: 100, base: 150, slow: 220, exit: 120, theme: 150 } as const;
/** Capas, de abajo hacia arriba. */
export const layers = { content: 0, sticky: 10, sidebarOverlay: 30, menu: 40, tooltip: 50, scrim: 55, dialog: 60, toast: 70, skipLink: 100 } as const;

/** Tamaños estructurales (modales, panel lateral, popover). */
export const sizes = { modalS: 400, modalM: 520, modalL: 720, popoverMax: 360, panelWidth: 380, drawerWidth: 560, paletteWidth: 640, sidebarWidth: 240, headerHeight: 44, readingWidth: 960, windowMargin: 24, windowMin: 900 } as const;


/** Estilo de página (spec 005, plan §4.1): valores de cada opción del menú. El núcleo solo nombra estas variables (cssVarsFor). */
export const pageStyle = {
  widths: { narrow: 800, normal: 960, wide: 1280 },
  textSizes: { small: 15, normal: 17, large: 19 },
  /** Altura de línea sin unidad: así sigue al tamaño de texto que se elija. */
  leadings: { compact: 1.45, normal: 1.625, relaxed: 1.85 },
  /** Separación entre bloques, en em. */
  gaps: { compact: 0.5, normal: 0.75, relaxed: 1.1 },
  coverHeights: { low: 160, medium: 240, high: 340 },
} as const;
