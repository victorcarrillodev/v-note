import { describe, it, expect } from "vitest";
import { backspaceEdit, enterEdit, typedEdit, type Edit } from "./pairs";

const run = (text: string, e: Edit | null) => e && { out: text.slice(0, e.from) + e.text + text.slice(e.to), cursor: e.cursor };

describe("cierre de pares", () => {
  it("cierra paréntesis, corchetes, llaves y comillas dejando el cursor dentro", () => {
    for (const [o, c] of [["(", ")"], ["[", "]"], ["{", "}"], ['"', '"'], ["`", "`"]] as const) {
      expect(run("x ", typedEdit("x ", 2, 2, o, "javascript"))).toEqual({ out: `x ${o}${c}`, cursor: 3 });
    }
  });
  it("salta sobre el cierre ya escrito", () => {
    expect(run("f()", typedEdit("f()", 2, 2, ")", "javascript"))).toEqual({ out: "f()", cursor: 3 });
  });
  it("envuelve la selección", () => {
    expect(run("abc", typedEdit("abc", 0, 3, "(", "javascript"))).toEqual({ out: "(abc)", cursor: 4 });
  });
  it("no cierra una comilla pegada a una letra (apóstrofo) ni un paréntesis antes de una palabra", () => {
    expect(typedEdit("don", 3, 3, "'", "javascript")).toBeNull();
    expect(typedEdit("x = foo", 4, 4, "(", "javascript")).toBeNull();
  });
  it("no hace nada en texto plano ni con comillas en Markdown", () => {
    expect(typedEdit("", 0, 0, "(", "text")).toBeNull();
    expect(typedEdit("", 0, 0, '"', "markdown")).toBeNull();
    expect(typedEdit("", 0, 0, "(", "markdown")).not.toBeNull();
  });
  it("Backspace dentro de un par vacío borra ambos", () => {
    expect(run("a()", backspaceEdit("a()", 2, "javascript"))).toEqual({ out: "a", cursor: 1 });
    expect(backspaceEdit("a(x)", 3, "javascript")).toBeNull();
  });
});

describe("sangrado con Enter", () => {
  it("conserva la sangría de la línea", () => {
    expect(run("  a", enterEdit("  a", 3, "javascript"))).toEqual({ out: "  a\n  ", cursor: 6 });
  });
  it("entre llaves abre una línea sangrada y baja el cierre", () => {
    expect(run("if (x) {}", enterEdit("if (x) {}", 8, "javascript"))).toEqual({ out: "if (x) {\n  \n}", cursor: 11 });
  });
  it("tras ':' en Python aumenta la sangría", () => {
    expect(run("def f():", enterEdit("def f():", 8, "python"))).toEqual({ out: "def f():\n  ", cursor: 11 });
  });
  it("sin sangría ni apertura deja el Enter normal", () => {
    expect(enterEdit("abc", 3, "javascript")).toBeNull();
  });
});
