import { colors } from "./tokens";
import { monogram } from "../layout/monogram";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * Ícono de la aplicación (1024 × 1024): la inicial del nombre sobre un cuadrado con degradado sutil del acento. Es el ÚNICO lugar con degradado de marca.
 * `maskable`: ocupa todo el lienzo (el sistema recorta) y deja el símbolo dentro de la zona segura (80 %).
 */
export function iconSvg(name: string, opts: { maskable?: boolean } = {}): string {
  const a = colors.accent.light;
  const size = 1024;
  const font = opts.maskable ? 520 : 640;
  const shape = opts.maskable
    ? `<rect width="${size}" height="${size}" fill="url(#g)"/>`
    : `<rect width="${size}" height="${size}" rx="${Math.round(size * 0.22)}" fill="url(#g)"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="color-mix(in srgb, ${a} 88%, black)"/></linearGradient></defs>${shape}<text x="512" y="512" text-anchor="middle" dominant-baseline="central" font-family="Inter Variable, system-ui, sans-serif" font-weight="650" font-size="${font}" fill="${colors.onAccent.light}">${esc(monogram(name))}</text></svg>`;
}
