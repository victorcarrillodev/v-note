// Catálogo ÚNICO de valores de diseño (spec 002, plan 4). La hoja `tokens.css` se genera de aquí y una prueba comprueba que coinciden.
// Sin dependencias de React ni del DOM.

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

type Level = { size: number; line: number; weight: 400 | 500 | 600 | 700 };
export const typography: Record<"pageTitle" | "h1" | "h2" | "h3" | "reading" | "dialogTitle" | "component" | "ui" | "uiSmall" | "note" | "label", Level> = {
  pageTitle: { size: 36, line: 44, weight: 700 },
  h1: { size: 28, line: 36, weight: 700 },
  h2: { size: 22, line: 30, weight: 600 },
  h3: { size: 18, line: 26, weight: 600 },
  reading: { size: 16, line: 26, weight: 400 },
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
export const sizes = { modalS: 400, modalM: 520, modalL: 720, popoverMax: 360, panelWidth: 380, paletteWidth: 640, sidebarWidth: 240, headerHeight: 44, readingWidth: 720, windowMargin: 24, windowMin: 900 } as const;


/** Estilo de página (spec 005, plan §4.1): valores de cada opción del menú. El núcleo solo nombra estas variables (cssVarsFor). */
export const pageStyle = {
  widths: { narrow: 600, normal: 720, wide: 960 },
  textSizes: { small: 14, normal: 16, large: 18 },
  /** Altura de línea sin unidad: así sigue al tamaño de texto que se elija. */
  leadings: { compact: 1.45, normal: 1.625, relaxed: 1.85 },
  /** Separación entre bloques, en em. */
  gaps: { compact: 0.5, normal: 0.75, relaxed: 1.1 },
  coverHeights: { low: 160, medium: 240, high: 340 },
} as const;
