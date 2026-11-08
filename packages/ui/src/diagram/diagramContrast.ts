// Aviso de contraste del texto de una forma (RF-13, CL-7): compara el texto con el relleno VISIBLE (con su opacidad sobre el lienzo del tema).
import { contrastRatio } from "../design/contrast";
import { blockColors, colors, type Theme } from "../design/tokens";

export const LOW_CONTRAST = 4.5;
type Role = "fill" | "stroke" | "text";

const expand = (hex: string): string => {
  const h = hex.replace("#", "");
  const six = h.length === 3 || h.length === 4 ? h.split("").map((c) => c + c).join("") : h;
  return `#${six.slice(0, 6).toLowerCase()}`;
};
/** Color final (#rrggbb) de un valor guardado en el tema dado: los hexadecimales son fijos y los de paleta cambian con el tema. */
export function resolveDiagramHex(value: string, role: Role, theme: Theme): string {
  if (value === "none") return colors.canvas[theme];
  if (value.startsWith("palette:")) {
    const id = value.slice(8);
    if (id === "ink") return colors.text[theme];
    if (id === "white") return role === "fill" ? colors.card[theme] : colors.text[theme];
    const c = blockColors[id];
    if (c) return role === "fill" ? c[theme].bg : c[theme].text;
    return colors.text[theme];
  }
  return /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(value) ? expand(value) : colors.text[theme];
}

const channels = (hex: string): [number, number, number] => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
/** Relleno tal como se ve: mezclado con el lienzo según la opacidad. */
export function visibleFill(fillHex: string, opacity: number, theme: Theme): string {
  const a = expand(fillHex), b = expand(colors.canvas[theme]), t = Math.min(1, Math.max(0, opacity));
  if (t >= 1) return a;
  if (t <= 0) return b;
  const [r1, g1, b1] = channels(a), [r2, g2, b2] = channels(b);
  const mix = (x: number, y: number) => Math.round(x * t + y * (1 - t)).toString(16).padStart(2, "0");
  return `#${mix(r1, r2)}${mix(g1, g2)}${mix(b1, b2)}`;
}
export function textContrast(textColor: string, fill: string, opacity: number, theme: Theme): number {
  return contrastRatio(resolveDiagramHex(textColor, "text", theme), visibleFill(resolveDiagramHex(fill, "fill", theme), opacity, theme));
}
export const hasLowContrast = (textColor: string, fill: string, opacity: number, theme: Theme): boolean => textContrast(textColor, fill, opacity, theme) < LOW_CONTRAST;
