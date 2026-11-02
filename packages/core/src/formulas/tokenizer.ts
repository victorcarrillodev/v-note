export type FormulaError = { code: "LEXICAL" | "SYNTAX" | "UNKNOWN_FUNCTION" | "ARITY" | "TYPE" | "DIV_ZERO" | "UNKNOWN_PROPERTY" | "CYCLE" | "DOMAIN"; message: string; pos: number };
export type FResult<T> = { ok: true; value: T } | { ok: false; error: FormulaError };
export const fok = <T,>(value: T): FResult<T> => ({ ok: true, value });
export const ferr = (code: FormulaError["code"], message: string, pos = 0): FResult<never> => ({ ok: false, error: { code, message, pos } });

export type TokenKind = "number" | "string" | "boolean" | "identifier" | "operator" | "eof";
export type Token = { kind: TokenKind; text: string; pos: number };

const WORD_OPERATORS: Record<string, string> = { and: "&&", y: "&&", or: "||", o: "||", not: "!", no: "!" };
const BOOLEANS = new Set(["true", "verdadero", "false", "falso"]);
const isLetter = (c: string) => /[\p{L}_]/u.test(c);
const isIdent = (c: string) => /[\p{L}\p{N}_]/u.test(c);
const isDigit = (c: string) => c >= "0" && c <= "9";
const ESC: Record<string, string> = { n: "\n", t: "\t", r: "\r", "\\": "\\", '"': '"', "'": "'" };

/** Convierte el texto de una fórmula en tokens. Los errores llevan la posición del carácter y un mensaje en español. */
export function tokenize(src: string): FResult<Token[]> {
  const out: Token[] = [];
  let i = 0;
  const peekNonSpace = (from: number) => { let j = from; while (j < src.length && /\s/.test(src[j]!)) j++; return src[j]; };
  while (i < src.length) {
    const c = src[i]!;
    if (/\s/.test(c)) { i++; continue; }
    const start = i;
    if (isDigit(c) || (c === "." && isDigit(src[i + 1] ?? ""))) {
      while (isDigit(src[i] ?? "")) i++;
      if (src[i] === "." && isDigit(src[i + 1] ?? "")) { i++; while (isDigit(src[i] ?? "")) i++; }
      if (src[i] === "e" || src[i] === "E") {
        let j = i + 1;
        if (src[j] === "+" || src[j] === "-") j++;
        if (!isDigit(src[j] ?? "")) return ferr("LEXICAL", `El número «${src.slice(start, j)}» tiene un exponente incompleto`, start);
        while (isDigit(src[j] ?? "")) j++;
        i = j;
      }
      out.push({ kind: "number", text: src.slice(start, i), pos: start });
      continue;
    }
    if (c === '"' || c === "'") {
      i++;
      let text = "";
      for (;;) {
        if (i >= src.length) return ferr("LEXICAL", "Falta cerrar las comillas del texto", start);
        const ch = src[i]!;
        if (ch === c) { i++; break; }
        if (ch === "\\") { const n = src[i + 1]; if (n === undefined) return ferr("LEXICAL", "Falta cerrar las comillas del texto", start); text += ESC[n] ?? n; i += 2; continue; }
        text += ch; i++;
      }
      out.push({ kind: "string", text, pos: start });
      continue;
    }
    if (isLetter(c)) {
      while (i < src.length && isIdent(src[i]!)) i++;
      const word = src.slice(start, i);
      const lower = word.toLowerCase();
      if (BOOLEANS.has(lower)) out.push({ kind: "boolean", text: lower === "true" || lower === "verdadero" ? "true" : "false", pos: start });
      else if (WORD_OPERATORS[lower] && peekNonSpace(i) !== "(") out.push({ kind: "operator", text: WORD_OPERATORS[lower]!, pos: start });
      else out.push({ kind: "identifier", text: word, pos: start });
      continue;
    }
    const two = src.slice(i, i + 2);
    if (["==", "!=", "<=", ">=", "&&", "||"].includes(two)) { out.push({ kind: "operator", text: two, pos: start }); i += 2; continue; }
    if ("+-*/%^<>!(),".includes(c)) { out.push({ kind: "operator", text: c, pos: start }); i++; continue; }
    if (c === "=") return ferr("LEXICAL", "Para comparar usa «==»; «=» solo no se admite", start);
    return ferr("LEXICAL", `Carácter inesperado «${c}»`, start);
  }
  out.push({ kind: "eof", text: "", pos: src.length });
  return fok(out);
}
