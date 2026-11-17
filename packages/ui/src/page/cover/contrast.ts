// Legibilidad del título sobre la portada (plan 005, §6.3 y DP-16). Solo cálculo.

const lin = (v: number) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const luminance = (gray: number) => lin(gray); // gris neutro: R = G = B

/** Oscurecido (0–100) a partir del cual el título no necesita aviso (CL-3): da al menos 4,5:1 con texto blanco sobre una imagen blanca. */
export const SAFE_OVERLAY = 55;

/**
 * Contraste del texto blanco sobre el peor fondo posible (una imagen blanca) bajo un negro de opacidad `overlay`/100.
 * Con la imagen blanca, el fondo vale 255·(1 − α).
 */
export function whiteTextContrast(overlay: number): number {
  const alpha = Math.min(100, Math.max(0, overlay)) / 100;
  const bg = luminance(255 * (1 - alpha));
  return (1 + 0.05) / (bg + 0.05);
}

/** ¿Avisar de que el título puede no leerse? Solo con el título sobre la portada y poco oscurecido (CL-3). */
export const shouldWarnOverlay = (overlay: number, titleOverCover: boolean): boolean => titleOverCover && overlay < SAFE_OVERLAY;
