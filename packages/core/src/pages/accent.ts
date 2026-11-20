// Colores de acento de página: los 9 colores de bloque (heredados), tres paletas de 66 (vivos, pastel y degradados) y colores propios.
// Un acento se guarda como texto: un id de color de bloque, «#rrggbb» (sólido) o «#rrggbb~#rrggbb» (degradado de dos paradas).

export const ACCENT_PALETTE_SIZE = 66;
const HEX6 = /^#[0-9a-f]{6}$/i;

/** Acento sólido o degradado propio/de paleta (siempre empieza con «#»). */
export type CustomAccent = `#${string}`;

export function isHexColor(v: unknown): v is string { return typeof v === "string" && HEX6.test(v); }

/** Normaliza «#rrggbb» o «#rrggbb~#rrggbb» a minúsculas; devuelve `undefined` si no es válido. */
export function parseCustomAccent(v: unknown): CustomAccent | undefined {
  if (typeof v !== "string") return undefined;
  const parts = v.toLowerCase().split("~");
  if (parts.length > 2 || !parts.every(isHexColor)) return undefined;
  return parts.join("~") as CustomAccent;
}

export function accentStops(v: CustomAccent): [string, string?] {
  const [a, b] = v.split("~");
  return b ? [a!, b] : [a!];
}

function hslToHex(h: number, s: number, l: number): string {
  const hh = ((h % 360) + 360) % 360;
  const ss = s / 100, ll = l / 100;
  const k = (n: number) => (n + hh / 30) % 12;
  const a = ss * Math.min(ll, 1 - ll);
  const f = (n: number) => ll - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return "#" + [f(0), f(8), f(4)].map((x) => Math.round(x * 255).toString(16).padStart(2, "0")).join("");
}

// Cada paleta es una cuadrícula de 11 columnas (familias de color, de rojo a magenta) por 6 filas (tonos), en orden de fila: así se ve ordenada por gamas.
export const ACCENT_COLUMNS = 11;
const ACCENT_ROWS = ACCENT_PALETTE_SIZE / ACCENT_COLUMNS;
/** Matiz de cada familia: rojo, naranja, ámbar, amarillo, lima, verde, turquesa, cian, azul, violeta y magenta. */
const FAMILY_HUES = [0, 22, 42, 58, 88, 140, 174, 198, 222, 266, 316] as const;
const grid = (make: (hue: number, row: number) => string): readonly CustomAccent[] =>
  Array.from({ length: ACCENT_PALETTE_SIZE }, (_, i) => make(FAMILY_HUES[i % ACCENT_COLUMNS]!, Math.floor(i / ACCENT_COLUMNS)) as CustomAccent);

const VIVID_TONES = [[96, 68], [94, 58], [92, 50], [86, 42], [80, 34], [72, 26]] as const;
const PASTEL_TONES = [[88, 82], [86, 78], [84, 74], [82, 70], [80, 66], [78, 62]] as const;
/** Saltos de matiz del degradado por fila: de colores vecinos a casi opuestos. */
const GRADIENT_JUMPS = [28, 55, 90, 140, 200, 270] as const;

/** 66 colores vivos: 11 familias, cada columna de más claro a más oscuro. */
export const VIVID_ACCENTS: readonly CustomAccent[] = grid((h, r) => hslToHex(h, VIVID_TONES[r % ACCENT_ROWS]![0], VIVID_TONES[r % ACCENT_ROWS]![1]));
/** 66 colores pastel: las mismas familias, claros pero con color. */
export const PASTEL_ACCENTS: readonly CustomAccent[] = grid((h, r) => hslToHex(h, PASTEL_TONES[r % ACCENT_ROWS]![0], PASTEL_TONES[r % ACCENT_ROWS]![1]));
/** 66 degradados: cada columna parte de una familia y cada fila avanza más lejos por la rueda, así que ninguno se repite. */
export const GRADIENT_ACCENTS: readonly CustomAccent[] = grid((h, r) => `${hslToHex(h, 90, 52)}~${hslToHex(h + GRADIENT_JUMPS[r % ACCENT_ROWS]!, 90, 58)}`);

function luminance(hex: string): number {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
}

/** Texto legible sobre un fondo del color dado (negro o blanco, el de mayor contraste). */
export function onColor(hex: string): "#000000" | "#ffffff" {
  const L = luminance(hex);
  return (L + 0.05) / 0.05 >= 1.05 / (L + 0.05) ? "#000000" : "#ffffff";
}

/** Texto legible sobre un acento sólido o degradado (se calcula sobre el color medio de las paradas). */
export function accentOnColor(v: CustomAccent): "#000000" | "#ffffff" {
  const stops = accentStops(v).filter((x): x is string => !!x);
  const mid = [1, 3, 5].map((i) => Math.round(stops.reduce((n, h) => n + parseInt(h.slice(i, i + 2), 16), 0) / stops.length));
  return onColor("#" + mid.map((c) => c.toString(16).padStart(2, "0")).join(""));
}

/** Variables CSS de un acento propio: color base, texto de acento legible, texto sobre el acento y, si es degradado, el relleno. */
export function customAccentVars(v: CustomAccent): Record<string, string> {
  const [a, b] = accentStops(v);
  const vars: Record<string, string> = {
    "--c-accent": a,
    "--c-accent-text": `color-mix(in srgb, ${a} 55%, var(--c-text))`,
    "--c-on-accent": onColor(a),
  };
  if (b) vars["--c-accent-fill"] = `linear-gradient(90deg, ${a}, ${b})`;
  return vars;
}

/** CSS `background` para una muestra del acento. */
export function accentSwatch(v: CustomAccent): string {
  const [a, b] = accentStops(v);
  return b ? `linear-gradient(135deg, ${a}, ${b})` : a;
}

export const MAX_SAVED_ACCENTS = 64;
