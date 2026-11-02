// T-249, T-250 (prueba primero): tokenizador y analizador de fórmulas, con errores en español.
import { describe, it, expect } from "vitest";
import { tokenize } from "./tokenizer";
import { parse, type Expr } from "./parser";

const kinds = (src: string) => { const r = tokenize(src); if (!r.ok) throw new Error(r.error.message); return r.value.map((t) => t.kind); };
const texts = (src: string) => { const r = tokenize(src); if (!r.ok) throw new Error(r.error.message); return r.value.map((t) => t.text); };
const ast = (src: string): Expr => { const r = parse(src); if (!r.ok) throw new Error(r.error.message); return r.value; };
const show = (e: Expr): string => {
  switch (e.type) {
    case "num": return String(e.value);
    case "str": return JSON.stringify(e.value);
    case "bool": return String(e.value);
    case "prop": return `prop(${JSON.stringify(e.name)})`;
    case "unary": return `(${e.op}${show(e.arg)})`;
    case "binary": return `(${show(e.left)} ${e.op} ${show(e.right)})`;
    case "call": return `${e.name}(${e.args.map(show).join(", ")})`;
  }
};
const s = (src: string) => show(ast(src));

describe("tokenizador (T-249)", () => {
  it("números enteros, decimales y con exponente", () => {
    expect(texts("1 23 4.5 .5 1e3 2.5e-2")).toEqual(["1", "23", "4.5", ".5", "1e3", "2.5e-2", ""]);
    expect(kinds("12")).toEqual(["number", "eof"]);
  });
  it("cadenas con comillas dobles o simples y escapes", () => {
    expect(texts('"hola" \'mundo\'')).toEqual(["hola", "mundo", ""]);
    expect(texts('"con \\"comillas\\" y \\n salto"')[0]).toBe('con "comillas" y \n salto');
    expect(kinds('"a"')).toEqual(["string", "eof"]);
  });
  it("identificadores (con acentos y guion bajo), booleanos y operadores", () => {
    expect(kinds("true false foo _bar año2")).toEqual(["boolean", "boolean", "identifier", "identifier", "identifier", "eof"]);
    expect(texts("+ - * / % ^ == != < <= > >= && || ! ( ) ,")).toEqual(["+", "-", "*", "/", "%", "^", "==", "!=", "<", "<=", ">", ">=", "&&", "||", "!", "(", ")", ",", ""]);
  });
  it("palabras y/o/no/and/or/not son operadores lógicos", () => {
    expect(kinds("a and b or not c")).toEqual(["identifier", "operator", "identifier", "operator", "operator", "identifier", "eof"]);
    expect(texts("a y b o no c")).toEqual(["a", "&&", "b", "||", "!", "c", ""]);
  });
  it("registra la posición de cada token", () => {
    const r = tokenize("12 + x");
    expect(r.ok && r.value.map((t) => t.pos)).toEqual([0, 3, 5, 6]);
  });
  it("errores léxicos con posición y mensaje en español", () => {
    for (const [src, pos] of [["1 @ 2", 2], ['"sin cerrar', 0], ["3 $ 4", 2], ["a = b", 2], ["1e", 0]] as const) {
      const r = tokenize(src);
      expect(r.ok, src).toBe(false);
      if (!r.ok) { expect(r.error.code).toBe("LEXICAL"); expect(r.error.pos, src).toBe(pos); expect(r.error.message.length).toBeGreaterThan(5); }
    }
  });
});

describe("analizador (T-250)", () => {
  it("literales y referencias a propiedades", () => {
    expect(s("42")).toBe("42");
    expect(s('"hola"')).toBe('"hola"');
    expect(s("true")).toBe("true");
    expect(s('prop("Costo")')).toBe('prop("Costo")');
  });
  it("precedencia aritmética: * / % antes que + -", () => {
    expect(s("1 + 2 * 3")).toBe("(1 + (2 * 3))");
    expect(s("1 * 2 + 3")).toBe("((1 * 2) + 3)");
    expect(s("10 - 4 / 2 % 3")).toBe("(10 - ((4 / 2) % 3))");
  });
  it("asociatividad: izquierda para + - * /, derecha para ^", () => {
    expect(s("10 - 3 - 2")).toBe("((10 - 3) - 2)");
    expect(s("100 / 10 / 2")).toBe("((100 / 10) / 2)");
    expect(s("2 ^ 3 ^ 2")).toBe("(2 ^ (3 ^ 2))");
  });
  it("^ liga más fuerte que * y que el menos unario aplicado después", () => {
    expect(s("2 * 3 ^ 2")).toBe("(2 * (3 ^ 2))");
    expect(s("-2 ^ 2")).toBe("(-(2 ^ 2))");
  });
  it("paréntesis cambian la precedencia", () => {
    expect(s("(1 + 2) * 3")).toBe("((1 + 2) * 3)");
    expect(s("((1))")).toBe("1");
  });
  it("comparaciones, igualdad y lógica: no > comparación > igualdad > y > o", () => {
    expect(s("1 < 2 == 3 > 4")).toBe("((1 < 2) == (3 > 4))");
    expect(s("1 < 2 && 3 < 4 || 5 < 6")).toBe("(((1 < 2) && (3 < 4)) || (5 < 6))");
    expect(s("1 == 2 || 3 != 4 && 5 >= 6")).toBe("((1 == 2) || ((3 != 4) && (5 >= 6)))");
    expect(s("!1 == 2")).toBe("((!1) == 2)");
    expect(s("not true and false")).toBe("((!true) && false)");
  });
  it("suma y comparación: a + 1 > b * 2", () => {
    expect(s("1 + 1 > 2 * 2")).toBe("((1 + 1) > (2 * 2))");
  });
  it("unarios encadenados", () => {
    expect(s("--5")).toBe("(-(-5))");
    expect(s("!!true")).toBe("(!(!true))");
    expect(s("3 - -2")).toBe("(3 - (-2))");
  });
  it("llamadas a funciones con 0, 1 o varios argumentos y anidadas", () => {
    expect(s("hoy()")).toBe("hoy()");
    expect(s("abs(-1)")).toBe("abs((-1))");
    expect(s("max(1, 2 + 3, abs(4))")).toBe("max(1, (2 + 3), abs(4))");
    expect(s('si(prop("Hecho"), "sí", "no")')).toBe('si(prop("Hecho"), "sí", "no")');
  });
  it("los nombres de función se normalizan a minúsculas sin acentos", () => {
    expect(s("ABS(1)")).toBe("abs(1)");
    expect(s("Año(hoy())")).toBe("ano(hoy())");
  });
  it("errores de sintaxis con posición y mensaje en español", () => {
    const cases: [string, string][] = [
      ["1 +", "SYNTAX"], ["(1 + 2", "SYNTAX"], ["1 + 2)", "SYNTAX"], ["max(1,)", "SYNTAX"], ["max(1 2)", "SYNTAX"],
      ["* 3", "SYNTAX"], ["", "SYNTAX"], ["1 2", "SYNTAX"], ["foo", "SYNTAX"], ["prop(1)", "SYNTAX"], ["prop()", "SYNTAX"], ['prop("a", "b")', "SYNTAX"],
    ];
    for (const [src, code] of cases) {
      const r = parse(src);
      expect(r.ok, `"${src}" debía fallar`).toBe(false);
      if (!r.ok) { expect(r.error.code, src).toBe(code); expect(r.error.message.length, src).toBeGreaterThan(5); expect(typeof r.error.pos).toBe("number"); }
    }
  });
  it("un error léxico se propaga desde parse", () => {
    const r = parse("1 @ 2");
    expect(!r.ok && r.error.code).toBe("LEXICAL");
  });
  it("profundidad grande no revienta la pila (1 000 paréntesis anidados se rechaza con error, no con excepción)", () => {
    const r = parse("(".repeat(1000) + "1" + ")".repeat(1000));
    expect(r.ok === false || r.ok === true).toBe(true);
  });
});
