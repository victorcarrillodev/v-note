// Subrayado con estilo: estilo en línea `underlineStyle` con valor «<tipo>:<color>». TypeScript puro.
//   tipo  := "line" (liso, como de máquina) | "soft" (difuminado) | "marker" (marcatextos rápido)
//   color := uno de los nueve colores de bloque (los mismos que el color de texto y el resaltado)
// El subrayado simple de siempre (`underline: true`, Ctrl+U) no cambia y convive con este.

export const UNDERLINE_STYLE_KEY = "underlineStyle";
export const UNDERLINE_KINDS = ["line", "soft", "marker"] as const;
export type UnderlineKind = (typeof UNDERLINE_KINDS)[number];
export const UNDERLINE_COLORS = ["yellow", "orange", "red", "pink", "purple", "blue", "green", "gray", "brown"] as const;
export type UnderlineColor = (typeof UNDERLINE_COLORS)[number];
export type Underline = { kind: UnderlineKind; color: UnderlineColor };

/** Lee el valor del estilo. Algo mal formado (o de una versión futura) da `null`: el texto se ve sin subrayado, nunca se rompe. */
export function parseUnderline(value: unknown): Underline | null {
  if (typeof value !== "string") return null;
  const i = value.indexOf(":");
  if (i < 0) return null;
  const kind = value.slice(0, i), color = value.slice(i + 1);
  return (UNDERLINE_KINDS as readonly string[]).includes(kind) && (UNDERLINE_COLORS as readonly string[]).includes(color)
    ? { kind: kind as UnderlineKind, color: color as UnderlineColor } : null;
}

export const formatUnderline = (u: Underline): string => `${u.kind}:${u.color}`;

/** Fuerza del marcatextos y del difuminado en oscuro (1 = igual que en claro): más transparentes para que la letra se lea. */
export const UNDERLINE_DARK_STRENGTH = 0.55;
