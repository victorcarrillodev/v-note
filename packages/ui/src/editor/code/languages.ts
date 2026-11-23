/**
 * Registro de lenguajes del bloque de código: nombre visible, gramática (Lezer, se carga a demanda)
 * y palabras para el autocompletado. Los lenguajes sin gramática Lezer (bash, sql) usan `tokenizer`.
 */
import type { Tree } from "@lezer/common";

/** Lo mínimo que se necesita de una gramática Lezer: convertir texto en árbol. */
export interface CodeParser { parse(input: string): Tree }

export interface CodeLanguage {
  readonly value: string;
  readonly label: string;
  /** Otros nombres con los que llega el lenguaje al importar (`ts`, `py`, `sh`…). */
  readonly aliases?: readonly string[];
  /** Carga la gramática; ausente si el lenguaje no tiene o usa `regex`. */
  readonly load?: () => Promise<CodeParser>;
  /** Tokenizador por expresiones regulares para lenguajes sin gramática. */
  readonly regex?: RegexRules;
  /** Palabras reservadas y funciones comunes para el autocompletado. */
  readonly words: readonly string[];
}

export interface RegexRules {
  readonly comment: RegExp;
  readonly string: RegExp;
  readonly number: RegExp;
  readonly keyword: RegExp;
  readonly extra?: ReadonlyArray<{ re: RegExp; cls: string }>;
}

const JS_WORDS = ["async", "await", "break", "case", "catch", "class", "const", "continue", "debugger", "default", "delete", "do", "else", "export", "extends", "false", "finally", "for", "function", "if", "import", "in", "instanceof", "let", "new", "null", "return", "super", "switch", "this", "throw", "true", "try", "typeof", "undefined", "var", "void", "while", "yield", "console.log", "Promise", "Array", "Object", "JSON", "Math", "Map", "Set", "setTimeout", "fetch", "document", "window", "require", "module", "forEach", "filter", "reduce", "includes", "push", "length"];
const TS_WORDS = [...JS_WORDS, "interface", "type", "enum", "implements", "namespace", "readonly", "private", "public", "protected", "abstract", "declare", "keyof", "never", "unknown", "any", "string", "number", "boolean", "Record", "Partial", "Readonly", "satisfies", "as"];

export const CODE_LANGUAGES: readonly CodeLanguage[] = [
  { value: "text", label: "Texto", aliases: ["plain", "plaintext", "txt"], words: [] },
  { value: "javascript", label: "JavaScript", aliases: ["js", "jsx", "mjs", "cjs"], load: async () => (await import("@lezer/javascript")).parser.configure({ dialect: "jsx" }), words: JS_WORDS },
  { value: "typescript", label: "TypeScript", aliases: ["ts", "tsx"], load: async () => (await import("@lezer/javascript")).parser.configure({ dialect: "ts jsx" }), words: TS_WORDS },
  { value: "python", label: "Python", aliases: ["py"], load: async () => (await import("@lezer/python")).parser, words: ["and", "as", "assert", "async", "await", "break", "class", "continue", "def", "del", "elif", "else", "except", "False", "finally", "for", "from", "global", "if", "import", "in", "is", "lambda", "None", "nonlocal", "not", "or", "pass", "raise", "return", "True", "try", "while", "with", "yield", "print", "len", "range", "enumerate", "isinstance", "self", "__init__", "dict", "list", "set", "tuple", "str", "int", "float", "open", "zip", "map", "sorted"] },
  {
    value: "bash", label: "Bash", aliases: ["sh", "shell", "zsh"],
    regex: { comment: /#.*/y, string: /"(?:\\.|[^"\\])*"|'[^']*'/y, number: /\b\d+\b/y, keyword: /\b(?:if|then|else|elif|fi|for|while|until|do|done|case|esac|in|function|return|exit|local|export|source|echo|cd|ls|cat|grep|sed|awk|sudo|git|npm|bun|cp|mv|rm|mkdir|chmod|curl|set|unset|read|test)\b/y, extra: [{ re: /\$\{?[A-Za-z_]\w*\}?/y, cls: "tok-variableName" }, { re: /(?<=\s)-{1,2}[A-Za-z][\w-]*/y, cls: "tok-attributeName" }] },
    words: ["if", "then", "else", "elif", "fi", "for", "while", "do", "done", "case", "esac", "function", "return", "exit", "export", "source", "echo", "cd", "ls", "cat", "grep", "sed", "awk", "sudo", "git", "chmod", "curl", "mkdir", "rm", "cp", "mv", "set -e"],
  },
  { value: "json", label: "JSON", load: async () => (await import("@lezer/json")).parser, words: ["true", "false", "null"] },
  { value: "html", label: "HTML", aliases: ["htm", "vue", "svelte"], load: async () => (await import("@lezer/html")).parser, words: ["div", "span", "section", "article", "header", "footer", "nav", "main", "button", "input", "form", "label", "table", "img", "href", "class", "id", "style", "script", "a", "ul", "li", "p", "h1", "h2", "h3"] },
  { value: "css", label: "CSS", aliases: ["scss", "less"], load: async () => (await import("@lezer/css")).parser, words: ["display", "flex", "grid", "position", "absolute", "relative", "fixed", "color", "background", "background-color", "border", "border-radius", "margin", "padding", "width", "height", "font-size", "font-family", "font-weight", "justify-content", "align-items", "gap", "overflow", "transition", "transform", "opacity", "z-index", "var", "calc", "@media", "!important"] },
  {
    value: "sql", label: "SQL", aliases: ["mysql", "postgres", "postgresql", "sqlite"],
    regex: { comment: /--.*|\/\*[\s\S]*?\*\//y, string: /'(?:''|[^'])*'|"(?:""|[^"])*"/y, number: /\b\d+(?:\.\d+)?\b/y, keyword: /\b(?:select|from|where|insert|into|values|update|set|delete|create|table|drop|alter|add|index|view|join|inner|left|right|full|outer|on|group|by|order|having|limit|offset|as|and|or|not|null|is|in|like|between|exists|distinct|union|all|case|when|then|else|end|primary|key|foreign|references|default|unique|count|sum|avg|min|max|asc|desc|with|begin|commit|rollback)\b/iy },
    words: ["SELECT", "FROM", "WHERE", "INSERT INTO", "VALUES", "UPDATE", "SET", "DELETE FROM", "CREATE TABLE", "DROP TABLE", "ALTER TABLE", "JOIN", "LEFT JOIN", "INNER JOIN", "GROUP BY", "ORDER BY", "HAVING", "LIMIT", "DISTINCT", "COUNT", "SUM", "AVG", "MIN", "MAX", "PRIMARY KEY", "FOREIGN KEY", "NOT NULL", "DEFAULT", "UNIQUE", "UNION", "EXISTS", "BETWEEN", "LIKE", "AND", "OR", "NULL"],
  },
  { value: "markdown", label: "Markdown", aliases: ["md"], load: async () => (await import("@lezer/markdown")).parser as unknown as CodeParser, words: [] },
  { value: "yaml", label: "YAML", aliases: ["yml"], load: async () => (await import("@lezer/yaml")).parser, words: ["true", "false", "null", "name", "version", "services", "image", "ports", "volumes", "environment", "on", "jobs", "steps", "run", "uses"] },
  { value: "xml", label: "XML", aliases: ["svg", "xhtml"], load: async () => (await import("@lezer/xml")).parser, words: [] },
  { value: "rust", label: "Rust", aliases: ["rs"], load: async () => (await import("@lezer/rust")).parser, words: ["as", "async", "await", "break", "const", "continue", "crate", "dyn", "else", "enum", "extern", "false", "fn", "for", "if", "impl", "in", "let", "loop", "match", "mod", "move", "mut", "pub", "ref", "return", "self", "Self", "static", "struct", "super", "trait", "true", "type", "unsafe", "use", "where", "while", "println!", "vec!", "Option", "Result", "Some", "None", "Ok", "Err", "String", "Vec", "Box"] },
  { value: "go", label: "Go", aliases: ["golang"], load: async () => (await import("@lezer/go")).parser, words: ["break", "case", "chan", "const", "continue", "default", "defer", "else", "fallthrough", "for", "func", "go", "goto", "if", "import", "interface", "map", "package", "range", "return", "select", "struct", "switch", "type", "var", "fmt.Println", "nil", "true", "false", "error", "string", "int", "bool", "make", "append", "len"] },
  { value: "java", label: "Java", load: async () => (await import("@lezer/java")).parser, words: ["abstract", "boolean", "break", "case", "catch", "class", "continue", "default", "do", "else", "enum", "extends", "final", "finally", "for", "if", "implements", "import", "instanceof", "interface", "new", "package", "private", "protected", "public", "return", "static", "super", "switch", "this", "throw", "throws", "try", "void", "while", "String", "System.out.println", "ArrayList", "HashMap", "List", "Map", "null", "true", "false"] },
  { value: "cpp", label: "C / C++", aliases: ["c", "c++", "h", "hpp", "cc"], load: async () => (await import("@lezer/cpp")).parser, words: ["auto", "bool", "break", "case", "catch", "char", "class", "const", "continue", "default", "delete", "do", "double", "else", "enum", "false", "float", "for", "if", "include", "int", "long", "namespace", "new", "nullptr", "private", "public", "return", "short", "sizeof", "static", "struct", "switch", "template", "this", "throw", "true", "try", "typedef", "typename", "unsigned", "using", "virtual", "void", "while", "std::string", "std::vector", "std::cout", "printf"] },
  { value: "php", label: "PHP", load: async () => (await import("@lezer/php")).parser, words: ["abstract", "array", "as", "break", "case", "catch", "class", "const", "continue", "echo", "else", "elseif", "extends", "false", "finally", "for", "foreach", "function", "if", "implements", "interface", "namespace", "new", "null", "private", "protected", "public", "return", "static", "switch", "this", "throw", "true", "try", "use", "while", "$this", "isset", "empty", "count", "strlen"] },
];

const BY_NAME = new Map<string, CodeLanguage>();
for (const l of CODE_LANGUAGES) {
  BY_NAME.set(l.value, l);
  for (const a of l.aliases ?? []) BY_NAME.set(a, l);
}

/** Busca un lenguaje por nombre o alias (sin importar mayúsculas); `undefined` si no se conoce. */
export function findLanguage(name: string | undefined | null): CodeLanguage | undefined {
  return name ? BY_NAME.get(name.trim().toLowerCase()) : undefined;
}
