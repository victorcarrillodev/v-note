import type { Clip, StyleClip } from "@vnote/core";

/**
 * Portapapeles de los diagramas: memoria de esta ventana, solo dentro de la aplicación (DP-8). No usa el portapapeles del sistema ni escribe en disco,
 * así que puede pegarse entre diagramas y entre espacios mientras la ventana siga abierta.
 */
let shapes: Clip | null = null;
let pastes = 0;
let format: StyleClip | null = null;

export const diagramClipboard = {
  copyShapes(c: Clip) { shapes = c; pastes = 0; },
  /** El contenido copiado y cuántas veces se ha pegado ya (para desplazar cada pegado). */
  shapes: () => (shapes ? { clip: shapes, pastes } : null),
  countPaste() { pastes += 1; },
  copyFormat(f: StyleClip) { format = f; },
  format: () => format,
};
export function clearDiagramClipboard() { shapes = null; pastes = 0; format = null; }
