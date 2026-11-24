// Icono de página: gramática del campo `pages.icon`. TypeScript puro.
//   icon := "asset:" sha256   (imagen subida; mismo almacén que las portadas)
//         | texto             (un emoji o hasta unos pocos caracteres, como hasta ahora)
import { isValidHash } from "../assets/hash";

export type PageIcon = { kind: "emoji"; text: string } | { kind: "image"; hash: string };

/** Lee el campo `icon`. Vacío o con un `asset:` mal formado da `null` (se trata como «sin icono»). */
export function parseIcon(text: string | null | undefined): PageIcon | null {
  if (!text) return null;
  if (text.startsWith("asset:")) { const hash = text.slice("asset:".length); return isValidHash(hash) ? { kind: "image", hash } : null; }
  return { kind: "emoji", text };
}

/** Valor del campo `icon` para una imagen ya guardada en el almacén. */
export const formatIconImage = (hash: string): string => `asset:${hash}`;
