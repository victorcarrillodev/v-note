// Estilo de página (plan 005, §4.1 y §7.2): opciones de presentación de una página. TypeScript puro.
// Toda clave es opcional: ausente = «Predeterminado» (sigue la apariencia global, D-11) o, en la cabecera, el estilo clásico.
import { sortKeys } from "../backup/stableJson";
import { customAccentVars, parseCustomAccent, type CustomAccent } from "./accent";

/** Catálogo de fuentes incluidas en la aplicación (D-16). */
export const FONT_IDS = ["inter", "geist", "nunito", "source-serif", "lora", "merriweather", "jetbrains-mono", "fira-code", "atkinson", "caveat", "comic-neue", "patrick-hand", "indie-flower", "kalam"] as const;
export type FontId = (typeof FONT_IDS)[number];

/** Colores de acento: los colores de bloque con tono fuerte de contraste verificado (D-21). */
export const ACCENT_IDS = ["gray", "brown", "red", "orange", "yellow", "green", "blue", "purple", "pink"] as const;
export type AccentId = (typeof ACCENT_IDS)[number];

export const COVER_HEIGHTS = ["low", "medium", "high"] as const;
export type CoverHeight = (typeof COVER_HEIGHTS)[number];
export const CONTENT_WIDTHS = ["narrow", "normal", "wide", "full"] as const;
export type ContentWidth = (typeof CONTENT_WIDTHS)[number];
export const TEXT_SIZES = ["small", "normal", "large"] as const;
export type TextSize = (typeof TEXT_SIZES)[number];
export const LEADINGS = ["compact", "normal", "relaxed"] as const;
export type Leading = (typeof LEADINGS)[number];
export const TOC_LEVELS = [1, 2, 3] as const;
export type TocLevel = (typeof TOC_LEVELS)[number];

/** Rangos numéricos y valores predeterminados (plan §4.1 y DP-16). */
export const LIMITS = {
  pos: { min: 0, max: 100, def: 50 },
  overlay: { min: 0, max: 100, def: 60 },
  radius: { min: 0, max: 48 },
  tagText: { max: 32 },
} as const;

/** Radio de las esquinas: uno para las cuatro o [sup-izq, sup-der, inf-der, inf-izq]. */
export type CornerRadius = number | [number, number, number, number];

export type PageStyle = {
  header?: {
    titleOverCover?: boolean;
    description?: boolean;
    tag?: boolean;
    tagText?: string;
    updated?: boolean;
    iconOverlap?: boolean;
    gradient?: boolean;
    rounded?: boolean;
  };
  cover?: { height?: CoverHeight; posX?: number; posY?: number; overlay?: number; radius?: CornerRadius };
  typography?: { body?: FontId; headings?: FontId };
  spacing?: { width?: ContentWidth; textSize?: TextSize; leading?: Leading };
  toc?: { floating?: boolean; maxLevel?: TocLevel };
  accent?: AccentId | CustomAccent;
};

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** Lee el estilo guardado. Nunca falla: un texto dañado da `{}` (la página se ve con el estilo predeterminado). */
export function parseStyle(text: string | null | undefined): PageStyle {
  if (!text) return {};
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { return {}; }
  if (!isRecord(raw)) return {};
  return sanitizeStyle(raw);
}

/** Número finito recortado a [min, max] y redondeado a entero; cualquier otra cosa → undefined. */
const clampInt = (v: unknown, min: number, max: number): number | undefined =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : undefined;

type Defined<T> = { [K in keyof T]?: Exclude<T[K], undefined> };
/** Copia solo las claves con valor definido (el objeto resultante no tiene `undefined`). */
function defined<T extends object>(o: T): Defined<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Defined<T>;
}

const oneOf = <T extends string | number>(list: readonly T[], v: unknown): T | undefined => (list as readonly unknown[]).includes(v) ? (v as T) : undefined;
const bool = (v: unknown): boolean | undefined => (typeof v === "boolean" ? v : undefined);
/** Objeto sin claves → undefined (así un grupo vacío desaparece del estilo). */
const nonEmpty = <T extends object>(o: T): T | undefined => (Object.keys(o).length ? o : undefined);

function sanitizeTagText(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = v.trim().slice(0, LIMITS.tagText.max);
  return t || undefined;
}

function sanitizeHeader(raw: unknown): PageStyle["header"] {
  if (!isRecord(raw)) return undefined;
  return nonEmpty(defined({
    titleOverCover: bool(raw.titleOverCover), description: bool(raw.description), tag: bool(raw.tag), tagText: sanitizeTagText(raw.tagText),
    updated: bool(raw.updated), iconOverlap: bool(raw.iconOverlap), gradient: bool(raw.gradient), rounded: bool(raw.rounded),
  }));
}

/** Radio único o por esquina; una tupla que no tenga exactamente cuatro números se descarta entera. */
function sanitizeRadius(v: unknown): CornerRadius | undefined {
  const { min, max } = LIMITS.radius;
  if (!Array.isArray(v)) return clampInt(v, min, max);
  if (v.length !== 4) return undefined;
  const corners = v.map((c) => clampInt(c, min, max));
  return corners.every((c): c is number => c !== undefined) ? (corners as [number, number, number, number]) : undefined;
}

function sanitizeCover(raw: unknown): PageStyle["cover"] {
  if (!isRecord(raw)) return undefined;
  const { pos, overlay, radius } = LIMITS;
  return nonEmpty(defined({
    height: oneOf(COVER_HEIGHTS, raw.height),
    posX: clampInt(raw.posX, pos.min, pos.max),
    posY: clampInt(raw.posY, pos.min, pos.max),
    overlay: clampInt(raw.overlay, overlay.min, overlay.max),
    radius: sanitizeRadius(raw.radius),
  }));
}

function sanitizeStyle(raw: Record<string, unknown>): PageStyle {
  const typo = isRecord(raw.typography) ? raw.typography : {};
  const spacing = isRecord(raw.spacing) ? raw.spacing : {};
  const toc = isRecord(raw.toc) ? raw.toc : {};
  return defined({
    header: sanitizeHeader(raw.header),
    cover: sanitizeCover(raw.cover),
    typography: nonEmpty(defined({ body: oneOf(FONT_IDS, typo.body), headings: oneOf(FONT_IDS, typo.headings) })),
    spacing: nonEmpty(defined({ width: oneOf(CONTENT_WIDTHS, spacing.width), textSize: oneOf(TEXT_SIZES, spacing.textSize), leading: oneOf(LEADINGS, spacing.leading) })),
    toc: nonEmpty(defined({ floating: bool(toc.floating), maxLevel: oneOf(TOC_LEVELS, toc.maxLevel) })),
    accent: oneOf(ACCENT_IDS, raw.accent) ?? parseCustomAccent(raw.accent),
  });
}

/** Valores que equivalen a «no tocado». `description` y `gradient` no están: su predeterminado depende de otros datos. */
const DEFAULTS = {
  header: { titleOverCover: false, tag: false, updated: false, iconOverlap: false, rounded: false },
  cover: { height: "medium", posX: LIMITS.pos.def, posY: LIMITS.pos.def, overlay: LIMITS.overlay.def, radius: 0 },
  toc: { floating: true, maxLevel: 3 },
} as const;

function withoutDefaults<T extends object>(group: T | undefined, defaults: Record<string, unknown>): T | undefined {
  if (!group) return undefined;
  return nonEmpty(Object.fromEntries(Object.entries(group).filter(([k, v]) => defaults[k] !== v)) as T);
}

/** Cuatro esquinas iguales → un número. */
const collapseRadius = (r: CornerRadius | undefined): CornerRadius | undefined =>
  Array.isArray(r) && r.every((c) => c === r[0]) ? r[0] : r;

/**
 * Forma canónica del estilo: sin valores predeterminados ni grupos vacíos. Dos estilos equivalentes dan el mismo
 * resultado, y un estilo «sin tocar» da `null` (se guarda como NULL en SQLite).
 */
export function normalizeStyle(style: PageStyle): PageStyle | null {
  const s = sanitizeStyle(style as Record<string, unknown>);
  const cover = s.cover ? defined({ ...s.cover, radius: collapseRadius(s.cover.radius) }) : undefined;
  const out = defined({
    header: withoutDefaults(s.header, DEFAULTS.header),
    cover: withoutDefaults(cover, DEFAULTS.cover),
    typography: s.typography,
    spacing: s.spacing,
    toc: withoutDefaults(s.toc, DEFAULTS.toc),
    accent: s.accent,
  });
  return Object.keys(out).length ? out : null;
}

/** Texto para guardar en `pages.style`: JSON compacto con claves ordenadas, o `null` si el estilo no se ha tocado. */
export function styleToText(style: PageStyle): string | null {
  const n = normalizeStyle(style);
  return n ? JSON.stringify(sortKeys(n)) : null;
}

/** Cambio parcial del estilo: `undefined` en una clave la devuelve a «Predeterminado». Los arreglos se reemplazan enteros. */
export type StylePatch = {
  [K in keyof PageStyle]?: (NonNullable<PageStyle[K]> extends string ? PageStyle[K] : { [P in keyof NonNullable<PageStyle[K]>]?: NonNullable<PageStyle[K]>[P] | undefined }) | undefined;
};

function mergeGroup(base: unknown, patch: unknown): unknown {
  if (!isRecord(patch)) return patch; // valor simple o undefined
  const out: Record<string, unknown> = isRecord(base) ? { ...base } : {};
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) delete out[k];
    else out[k] = v;
  }
  return out;
}

/** Aplica un cambio parcial y devuelve el estilo normalizado (`{}` si queda sin tocar). */
export function applyStylePatch(style: PageStyle, patch: StylePatch): PageStyle {
  const merged: Record<string, unknown> = { ...style };
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) delete merged[k];
    else merged[k] = mergeGroup(merged[k], v);
  }
  return normalizeStyle(merged as PageStyle) ?? {};
}

/**
 * Variables CSS que el contenedor de la página debe declarar para su estilo (DP-5). Cada valor apunta a un token de
 * `design/tokens.ts`, así los valores concretos viven en un solo lugar. Lo ausente no se declara y hereda de la
 * apariencia global (D-11). Una variable que apunta a otra se resuelve donde se declara: por eso, si cambia la fuente
 * del texto, también se redeclara la de los títulos para que la siga dentro de la página.
 */
export function cssVarsFor(style: PageStyle): Record<string, string> {
  const vars: Record<string, string> = {};
  const { body, headings } = style.typography ?? {};
  if (body) vars["--font-content"] = `var(--font-${body})`;
  if (headings) vars["--font-headings"] = `var(--font-${headings})`;
  else if (body) vars["--font-headings"] = "var(--font-content)";
  const { textSize, leading } = style.spacing ?? {};
  if (textSize) vars["--text-reading-size"] = `var(--page-text-${textSize})`;
  // La altura de línea de la raíz está en px: con otro tamaño se usa un factor sin unidad para conservar la proporción.
  if (textSize || leading) vars["--text-reading-line"] = `var(--page-leading-${leading ?? "normal"})`;
  if (leading) vars["--block-gap"] = `var(--page-gap-${leading})`;
  const width = style.spacing?.width;
  if (width) vars["--size-reading-width"] = width === "full" ? "none" : `var(--page-width-${width})`;
  if (style.accent) {
    if (style.accent.startsWith("#")) Object.assign(vars, customAccentVars(style.accent as CustomAccent));
    else vars["--c-accent"] = `var(--block-${style.accent}-text)`;
  }
  return vars;
}
