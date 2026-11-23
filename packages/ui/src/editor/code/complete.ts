import { findLanguage } from "./languages";

export interface Completion {
  readonly label: string;
  /** `word`: palabra del lenguaje; `local`: identificador ya escrito en el bloque. */
  readonly kind: "word" | "local";
  /** Cuántos caracteres antes del cursor reemplaza la sugerencia al aceptarla. */
  readonly replace: number;
}

const MAX = 8;
const SHORT = /[\p{L}\p{N}_$@!-]*$/u;
const DOTTED = /[\p{L}\p{N}_$@!.:-]*$/u;

/** Palabra que se está escribiendo justo antes del cursor (sin el objeto: en `a.b` es `b`). */
export function prefixAt(text: string, cursor: number): string {
  return SHORT.exec(text.slice(0, cursor))?.[0] ?? "";
}

function identifiers(text: string): string[] {
  return [...new Set(text.match(/[\p{L}_$][\p{L}\p{N}_$]{2,}/gu) ?? [])];
}

function suggest(language: string, before: string, after: string, prefix: string): Completion[] {
  const lower = prefix.toLowerCase();
  const lang = findLanguage(language)?.words ?? [];
  const isWord = new Set(lang);
  const out: Completion[] = [];
  for (const id of identifiers(before + " " + after)) {
    if (id.toLowerCase().startsWith(lower) && id !== prefix && !isWord.has(id)) out.push({ label: id, kind: "local", replace: prefix.length });
  }
  out.sort((a, b) => a.label.length - b.label.length || a.label.localeCompare(b.label));
  const words = lang
    .filter((w) => w.toLowerCase().startsWith(lower) && w !== prefix)
    .sort((a, b) => a.length - b.length || a.localeCompare(b));
  for (const w of words) out.push({ label: w, kind: "word", replace: prefix.length });
  return out.slice(0, MAX);
}

/**
 * Sugerencias para lo escrito antes del cursor: nombres ya usados en el bloque (primero) y palabras del lenguaje.
 * Prueba primero con la ruta completa (`console.l`) y, si no hay coincidencias, con la última palabra.
 * `explicit` (Ctrl+Espacio) permite prefijos de un solo carácter.
 */
export function completionsFor(language: string, text: string, cursor: number, explicit = false): Completion[] {
  const head = text.slice(0, cursor);
  const min = explicit ? 1 : 2;
  const dotted = DOTTED.exec(head)?.[0].replace(/^[.:-]+/, "") ?? "";
  const short = prefixAt(text, cursor);
  const after = text.slice(cursor);
  for (const prefix of dotted !== short ? [dotted, short] : [short]) {
    if (prefix.length < min) continue;
    const r = suggest(language, head.slice(0, head.length - prefix.length), after, prefix);
    if (r.length > 0) return r;
  }
  return [];
}
