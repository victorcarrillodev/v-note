import { classHighlighter, highlightTree } from "@lezer/highlight";
import { findLanguage, type CodeLanguage, type CodeParser, type RegexRules } from "./languages";

/** Tramo coloreado: `cls` es una clase `tok-*` (ver `code.css`). */
export interface Token { readonly from: number; readonly to: number; readonly cls: string }

const parsers = new Map<string, CodeParser>();
const pending = new Map<string, Promise<void>>();

/** ¿La gramática del lenguaje ya está cargada (o no necesita carga)? */
export function isReady(lang: CodeLanguage | undefined): boolean {
  return !lang || !lang.load || parsers.has(lang.value);
}

/** Carga la gramática del lenguaje una sola vez; falla en silencio (el bloque queda sin colores). */
export function ensureLanguage(name: string): Promise<void> {
  const lang = findLanguage(name);
  if (!lang?.load || parsers.has(lang.value)) return Promise.resolve();
  let p = pending.get(lang.value);
  if (!p) {
    p = lang.load().then((parser) => { parsers.set(lang.value, parser); }, () => {}).finally(() => { pending.delete(lang.value); });
    pending.set(lang.value, p);
  }
  return p;
}

/** Colorea con reglas regulares los lenguajes sin gramática Lezer (bash, SQL). */
function regexTokens(text: string, rules: RegexRules): Token[] {
  const list: Array<{ re: RegExp; cls: string }> = [
    { re: rules.comment, cls: "tok-comment" },
    { re: rules.string, cls: "tok-string" },
    ...(rules.extra ?? []),
    { re: rules.number, cls: "tok-number" },
    { re: rules.keyword, cls: "tok-keyword" },
  ];
  const out: Token[] = [];
  let i = 0;
  while (i < text.length) {
    let hit = false;
    for (const { re, cls } of list) {
      re.lastIndex = i;
      const m = re.exec(text);
      if (m && m.index === i && m[0].length > 0) {
        out.push({ from: i, to: i + m[0].length, cls });
        i += m[0].length;
        hit = true;
        break;
      }
    }
    if (!hit) i++;
  }
  return out;
}

/** Tramos con color del texto. Si la gramática aún no está cargada devuelve `[]` (llamar antes a `ensureLanguage`). */
export function tokenize(text: string, languageName: string): Token[] {
  const lang = findLanguage(languageName);
  if (!lang || text.length === 0) return [];
  if (lang.regex) return regexTokens(text, lang.regex);
  const parser = parsers.get(lang.value);
  if (!parser) return [];
  const tokens: Token[] = [];
  try {
    highlightTree(parser.parse(text), classHighlighter, (from, to, cls) => { tokens.push({ from, to, cls: cls.split(/\s+/).filter((c) => c.startsWith("tok-"))[0] ?? cls }); });
  } catch {
    return [];
  }
  return tokens;
}
