/**
 * Cierre automático de pares y sangrado inteligente del bloque de código. Funciones puras sobre el texto del bloque:
 * devuelven la edición a aplicar (`from`–`to` se reemplaza por `text`; `cursor` es la posición final) o `null` si no hay nada que hacer.
 */
export interface Edit { readonly from: number; readonly to: number; readonly text: string; readonly cursor: number }

const OPEN: Record<string, string> = { "(": ")", "[": "]", "{": "}", '"': '"', "'": "'", "`": "`" };
const CLOSERS = new Set(Object.values(OPEN));
const QUOTES = new Set(['"', "'", "`"]);
const INDENT = "  ";
const WORD = /[\p{L}\p{N}_]/u;

/** En texto plano no se cierra nada; en Markdown las comillas se dejan en paz (apóstrofos, citas). */
function enabled(lang: string, ch: string): boolean {
  if (lang === "text") return false;
  return !(lang === "markdown" && QUOTES.has(ch) && ch !== "`");
}

/** Edición al teclear `ch`: cierra el par, salta sobre el cierre ya escrito o envuelve la selección. */
export function typedEdit(text: string, from: number, to: number, ch: string, lang: string): Edit | null {
  if (ch.length !== 1 || !enabled(lang, ch)) return null;
  const prev = text[from - 1] ?? "";
  const next = text[to] ?? "";
  if (from === to && CLOSERS.has(ch) && next === ch && (!QUOTES.has(ch) || !WORD.test(prev))) {
    return { from, to: to + 1, text: ch, cursor: from + 1 };
  }
  const close = OPEN[ch];
  if (close === undefined) return null;
  if (from !== to) return { from, to, text: ch + text.slice(from, to) + close, cursor: to + 1 };
  // Una comilla pegada a una letra es un apóstrofo o un cierre, no una apertura.
  if (QUOTES.has(ch) && (WORD.test(prev) || prev === ch)) return null;
  if (WORD.test(next)) return null;
  return { from, to, text: ch + close, cursor: from + 1 };
}

/** Borrar con el cursor dentro de un par vacío (`(|)`) quita los dos caracteres. */
export function backspaceEdit(text: string, cursor: number, lang: string): Edit | null {
  const a = text[cursor - 1];
  const b = text[cursor];
  if (a === undefined || b === undefined || OPEN[a] !== b || !enabled(lang, a)) return null;
  return { from: cursor - 1, to: cursor + 1, text: "", cursor: cursor - 1 };
}

/** Enter conserva la sangría de la línea; tras `{`, `[` o `(` la aumenta y, entre un par, baja el cierre a su propia línea. */
export function enterEdit(text: string, cursor: number, lang: string): Edit | null {
  if (lang === "text") return null;
  const lineStart = text.lastIndexOf("\n", cursor - 1) + 1;
  const indent = /^[ \t]*/.exec(text.slice(lineStart, cursor))?.[0] ?? "";
  const a = text[cursor - 1];
  const b = text[cursor];
  const bracket = a === "{" || a === "[" || a === "(";
  if (bracket && b !== undefined && OPEN[a] === b) {
    const inner = `\n${indent}${INDENT}`;
    return { from: cursor, to: cursor, text: `${inner}\n${indent}`, cursor: cursor + inner.length };
  }
  const opens = bracket || (a === ":" && (lang === "python" || lang === "yaml"));
  const extra = opens ? INDENT : "";
  if (indent === "" && extra === "") return null;
  const ins = `\n${indent}${extra}`;
  return { from: cursor, to: cursor, text: ins, cursor: cursor + ins.length };
}
