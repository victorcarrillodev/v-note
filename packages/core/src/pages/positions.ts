import { generateKeyBetween } from "fractional-indexing";

/** Posición (clave fraccionaria) estrictamente entre `before` y `after`; null = extremo (plan D-27). */
export const positionBetween = (before: string | null, after: string | null): string => generateKeyBetween(before, after);
