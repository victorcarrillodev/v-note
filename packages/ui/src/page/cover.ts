import { coverGradients } from "../design/tokens";

export const COVER_NAMES = Object.keys(coverGradients);

/** Fondo CSS de una portada guardada: «gradient:nombre» (variable del tema) o «color:#hex» heredado de versiones anteriores. */
export function coverBackground(cover: string): string {
  if (cover.startsWith("gradient:")) {
    const name = cover.slice("gradient:".length);
    if (COVER_NAMES.includes(name)) return `var(--cover-${name})`;
  }
  if (cover.startsWith("color:")) return cover.slice("color:".length);
  return "var(--cover-graphite)";
}

export const randomCover = (): string => `gradient:${COVER_NAMES[Math.floor(Math.random() * COVER_NAMES.length)]}`;
