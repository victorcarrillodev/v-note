import { parseCover, type Cover } from "@vnote/core";
import { coverGradients } from "../design/tokens";

export const COVER_NAMES = Object.keys(coverGradients);

/**
 * Fondo CSS de una portada guardada (RF-2.1): degradado del tema, color plano o degradado propio.
 * Las imágenes (`asset:`) no tienen fondo CSS: se pintan con una etiqueta `img` (`coverImageHash`).
 * Una portada inválida o dañada da `null`: se trata como «sin portada» y nunca falla al pintar (CL-14).
 */
export function coverBackground(cover: string | null | undefined): string | null {
  return backgroundOf(parseCover(cover));
}

export function backgroundOf(c: Cover | null): string | null {
  if (!c) return null;
  switch (c.kind) {
    case "gradient": return `var(--cover-${c.name})`;
    case "color": return c.hex;
    case "lgrad": return `linear-gradient(${c.angle}deg, ${c.colors.join(", ")})`;
    case "asset": return null;
  }
}

/** Huella de la imagen de una portada de archivo; `null` si no lo es. */
export function coverImageHash(cover: string | null | undefined): string | null {
  const c = parseCover(cover);
  return c?.kind === "asset" ? c.hash : null;
}

/** ¿La página tiene una portada que se pueda pintar? Texto vacío, desconocido o dañado = no. */
export const hasCover = (cover: string | null | undefined): boolean => parseCover(cover) !== null;

export const randomCover = (): string => `gradient:${COVER_NAMES[Math.floor(Math.random() * COVER_NAMES.length)]}`;
