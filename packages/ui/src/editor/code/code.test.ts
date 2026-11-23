import { describe, it, expect } from "vitest";
import { completionsFor, prefixAt } from "./complete";
import { ensureLanguage, tokenize } from "./tokenize";
import { findLanguage, CODE_LANGUAGES } from "./languages";

describe("lenguajes", () => {
  it("resuelve alias y mayúsculas", () => {
    expect(findLanguage("TS")?.value).toBe("typescript");
    expect(findLanguage("py")?.value).toBe("python");
    expect(findLanguage("cobol")).toBeUndefined();
  });
  it("hay al menos 17 lenguajes y valores únicos", () => {
    expect(CODE_LANGUAGES.length).toBeGreaterThanOrEqual(17);
    expect(new Set(CODE_LANGUAGES.map((l) => l.value)).size).toBe(CODE_LANGUAGES.length);
  });
});

describe("resaltado", () => {
  it("colorea palabras reservadas, cadenas y números con gramática Lezer", async () => {
    await ensureLanguage("javascript");
    const src = 'const x = "hi" + 42;';
    const cls = (s: string) => tokenize(src, "javascript").find((t) => src.slice(t.from, t.to) === s)?.cls;
    expect(cls("const")).toBe("tok-keyword");
    expect(cls('"hi"')).toBe("tok-string");
    expect(cls("42")).toBe("tok-number");
  });
  it("carga cada gramática y no lanza", async () => {
    const samples: Record<string, string> = { typescript: "let a: number = 1", python: "def f(): return 1", json: '{"a": [1, true]}', html: "<div class='a'>x</div>", css: "a { color: red }", markdown: "# t\n**b**", yaml: "a: 1", xml: "<a b='1'/>", rust: "fn main() {}", go: "package main", java: "class A {}", cpp: "int main() {}", php: "<?php echo 1;" };
    for (const [lang, src] of Object.entries(samples)) {
      await ensureLanguage(lang);
      expect(tokenize(src, lang).length, lang).toBeGreaterThan(0);
    }
  });
  it("bash y SQL se colorean sin gramática", () => {
    expect(tokenize("# nota\necho $HOME", "bash").map((t) => t.cls)).toEqual(["tok-comment", "tok-keyword", "tok-variableName"]);
    expect(tokenize("SELECT 'a', 1 FROM t -- x", "sql").map((t) => t.cls)).toEqual(["tok-keyword", "tok-string", "tok-number", "tok-keyword", "tok-comment"]);
  });
  it("un lenguaje desconocido o vacío no produce tramos", () => {
    expect(tokenize("x", "cobol")).toEqual([]);
    expect(tokenize("", "bash")).toEqual([]);
  });
});

describe("autocompletado", () => {
  it("toma el prefijo antes del cursor", () => {
    expect(prefixAt("let con", 7)).toBe("con");
    expect(prefixAt("a.b", 3)).toBe("b");
  });
  it("sugiere palabras del lenguaje y nombres del bloque, sin repetir lo ya completo", () => {
    const text = "const contador = 1;\ncon";
    const r = completionsFor("javascript", text, text.length).map((c) => c.label);
    expect(r[0]).toBe("contador");
    expect(completionsFor("javascript", "console.l", 9).map((c) => c.label)).toContain("console.log");
    expect(r).toContain("const");
    expect(r).toContain("continue");
    expect(completionsFor("javascript", "const", 5)).not.toContainEqual({ label: "const", kind: "word", replace: 5 });
  });
  it("exige 2 caracteres salvo que se pida con Ctrl+Espacio", () => {
    expect(completionsFor("javascript", "c", 1)).toEqual([]);
    expect(completionsFor("javascript", "c", 1, true).length).toBeGreaterThan(0);
  });
  it("texto plano solo sugiere nombres del bloque", () => {
    expect(completionsFor("text", "banana ban", 10).map((c) => c.label)).toEqual(["banana"]);
  });
});
