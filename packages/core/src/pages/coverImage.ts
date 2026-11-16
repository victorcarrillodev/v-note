// Imagen de portada (plan 005, §5.1 y DP-4): el núcleo valida y decide dimensiones; decodificar y codificar es de la
// interfaz (necesita Canvas). TypeScript puro.

export type ImageFormat = "png" | "jpeg" | "webp";

const startsWith = (b: Uint8Array, sig: number[], at = 0) => b.length >= at + sig.length && sig.every((x, i) => b[at + i] === x);

/** Formato real por sus bytes iniciales (no por la extensión del archivo). */
export function sniffImage(b: Uint8Array): ImageFormat | null {
  if (startsWith(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "png";
  if (startsWith(b, [0xff, 0xd8, 0xff])) return "jpeg";
  if (startsWith(b, [0x52, 0x49, 0x46, 0x46]) && startsWith(b, [0x57, 0x45, 0x42, 0x50], 8)) return "webp"; // «RIFF....WEBP»
  return null;
}

/** Tamaño máximo del archivo de entrada (RF-2.2). */
export const MAX_COVER_INPUT_BYTES = 20 * 1024 * 1024;

export type CoverInputError = "empty" | "tooLarge" | "unsupported";

/** Comprueba tamaño y formato antes de decodificar. `size` es el del archivo (puede llegar antes que los bytes completos). */
export function validateCoverInput(head: Uint8Array, size: number): { ok: true; format: ImageFormat } | { ok: false; error: CoverInputError } {
  if (size <= 0 || head.length === 0) return { ok: false, error: "empty" };
  if (size > MAX_COVER_INPUT_BYTES) return { ok: false, error: "tooLarge" };
  const format = sniffImage(head);
  return format ? { ok: true, format } : { ok: false, error: "unsupported" };
}

/** Ancho máximo de una portada guardada (RF-2.2). */
export const MAX_COVER_WIDTH = 2560;
/** Por debajo de este ancho se avisa que puede verse borrosa (CL-1). */
export const LOW_RES_WIDTH = 1200;

/** Dimensiones de salida: ancho ≤ 2560 px, sin agrandar y con la misma proporción. */
export function coverOutputSize(width: number, height: number): { width: number; height: number } {
  if (width <= MAX_COVER_WIDTH) return { width, height };
  return { width: MAX_COVER_WIDTH, height: Math.round((height * MAX_COVER_WIDTH) / width) };
}

export const isLowResolution = (width: number): boolean => width < LOW_RES_WIDTH;
