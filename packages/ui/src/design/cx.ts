/** Une nombres de clase ignorando valores vacíos. Sustituye a una biblioteca de variantes (art. 1: stack mínimo). */
export const cx = (...parts: (string | false | null | undefined)[]): string => parts.filter(Boolean).join(" ");
