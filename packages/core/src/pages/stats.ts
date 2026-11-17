// Estadísticas de la página (plan 005, §7.3, RF-8.3): palabras, caracteres y tiempo de lectura. TypeScript puro.
import type { Block } from "../blocks/types";
import { blocksToPlainText } from "../search/plainText";

/** Velocidad de lectura de referencia (plan 005, §7.3). */
export const WORDS_PER_MINUTE = 200;

export type PageStats = { words: number; characters: number; readingMinutes: number };

const words = new Intl.Segmenter("es", { granularity: "word" });
const graphemes = new Intl.Segmenter("es", { granularity: "grapheme" });

/** Cuenta sobre el mismo texto que indexa el buscador (incluye código, tablas, gráficos y bloques hijos). */
export function pageStats(blocks: Block[]): PageStats {
  const text = blocksToPlainText(blocks);
  let w = 0;
  for (const s of words.segment(text)) if (s.isWordLike) w++;
  let c = 0;
  for (const g of graphemes.segment(text)) if (g.segment !== "\n" && g.segment !== "\r\n") c++;
  return { words: w, characters: c, readingMinutes: w === 0 ? 0 : Math.max(1, Math.ceil(w / WORDS_PER_MINUTE)) };
}
