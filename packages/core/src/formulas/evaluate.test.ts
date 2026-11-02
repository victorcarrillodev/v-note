// T-251…T-255 (prueba primero): evaluador con tipos y errores controlados, y las funciones de texto, números, fechas y lógica.
import { describe, it, expect } from "vitest";
import { evaluateFormula, type FormulaValue } from "./evaluate";

const NOW = Date.UTC(2026, 2, 5, 14, 30); // 2026-03-05 14:30 UTC
const props: Record<string, FormulaValue> = {
  Costo: 100, Nombre: "Mole", Hecho: true, Vacio: null, Cant: 3,
  Entrega: { kind: "date", iso: "2026-03-10" }, Inicio: { kind: "date", iso: "2026-03-01T09:00" },
};
const run = (src: string) => evaluateFormula(src, { prop: (n) => (n in props ? props[n] : undefined), now: () => NOW });
const val = (src: string): FormulaValue => { const r = run(src); if (!r.ok) throw new Error(`${src}: ${r.error.code} ${r.error.message}`); return r.value; };
const code = (src: string) => { const r = run(src); if (r.ok) throw new Error(`${src}: debía fallar, dio ${JSON.stringify(r.value)}`); return r.error; };
const d = (iso: string): FormulaValue => ({ kind: "date", iso });

describe("evaluador (T-251)", () => {
  it("literales y aritmética con precedencia", () => {
    expect(val("1 + 2 * 3")).toBe(7);
    expect(val("(1 + 2) * 3")).toBe(9);
    expect(val("10 / 4")).toBe(2.5);
    expect(val("10 % 4")).toBe(2);
    expect(val("2 ^ 10")).toBe(1024);
    expect(val("-3 + 5")).toBe(2);
    expect(val("2 ^ -1")).toBe(0.5);
  });
  it("referencias a propiedades", () => {
    expect(val('prop("Costo") * 2')).toBe(200);
    expect(val('prop("Nombre")')).toBe("Mole");
    expect(val('prop("Hecho")')).toBe(true);
  });
  it("una propiedad vacía vale 0 en cuentas, «» en textos y falso en lógica", () => {
    expect(val('prop("Vacio") + 5')).toBe(5);
    expect(val('"x" + prop("Vacio")')).toBe("x");
    expect(val('si(prop("Vacio"), 1, 2)')).toBe(2);
    expect(val('prop("Vacio")')).toBeNull();
  });
  it("+ concatena si alguno es texto (convirtiendo números y booleanos)", () => {
    expect(val('"a" + "b"')).toBe("ab");
    expect(val('"total: " + 5')).toBe("total: 5");
    expect(val('"ok: " + true')).toBe("ok: verdadero");
    expect(val('1.5 + "x"')).toBe("1.5x");
  });
  it("comparaciones entre números, textos y fechas", () => {
    expect(val("3 > 2")).toBe(true);
    expect(val("3 <= 2")).toBe(false);
    expect(val('"a" < "b"')).toBe(true);
    expect(val('prop("Entrega") > prop("Inicio")')).toBe(true);
    expect(val("2 == 2")).toBe(true);
    expect(val('"a" == "A"')).toBe(false);
    expect(val("1 != 2")).toBe(true);
    expect(val('1 == "1"')).toBe(false); // tipos distintos: no son iguales, sin error
    expect(val('prop("Vacio") == ""')).toBe(true);
  });
  it("lógica con cortocircuito: la rama que no se evalúa no puede dar error", () => {
    expect(val("true || 1 / 0 > 1")).toBe(true);
    expect(val("false && 1 / 0 > 1")).toBe(false);
    expect(val("si(true, 1, 1 / 0)")).toBe(1);
    expect(val("!false")).toBe(true);
    expect(val("true && false || true")).toBe(true);
  });
  it("dividir entre cero da un error controlado, no una excepción ni Infinity", () => {
    expect(code("1 / 0")).toMatchObject({ code: "DIV_ZERO" });
    expect(code("5 % 0")).toMatchObject({ code: "DIV_ZERO" });
    expect(code('prop("Costo") / (prop("Cant") - 3)')).toMatchObject({ code: "DIV_ZERO" });
    expect(code("1 / 0").message).toMatch(/cero/i);
  });
  it("resultados no numéricos (0^-1, raíz de negativo, desbordamiento) son errores de dominio", () => {
    expect(code("0 ^ -1")).toMatchObject({ code: "DOMAIN" });
    expect(code("10 ^ 1000")).toMatchObject({ code: "DOMAIN" });
  });
  it("errores de tipo con mensaje en español", () => {
    expect(code('"a" * 2')).toMatchObject({ code: "TYPE" });
    expect(code("true + 1")).toMatchObject({ code: "TYPE" });
    expect(code('"a" < 1')).toMatchObject({ code: "TYPE" });
    expect(code("1 && true")).toMatchObject({ code: "TYPE" });
    expect(code('-"x"')).toMatchObject({ code: "TYPE" });
    expect(code('"a" * 2').message).toMatch(/texto|número/i);
  });
  it("propiedad inexistente y función desconocida", () => {
    expect(code('prop("Nada")')).toMatchObject({ code: "UNKNOWN_PROPERTY" });
    expect(code('prop("Nada")').message).toContain("Nada");
    expect(code("inventada(1)")).toMatchObject({ code: "UNKNOWN_FUNCTION" });
  });
  it("aridad incorrecta", () => {
    expect(code("abs()")).toMatchObject({ code: "ARITY" });
    expect(code("abs(1, 2)")).toMatchObject({ code: "ARITY" });
    expect(code("si(true, 1)")).toMatchObject({ code: "ARITY" });
  });
  it("los errores de sintaxis salen como resultado, con posición", () => {
    expect(code("1 +")).toMatchObject({ code: "SYNTAX" });
    expect(code("1 @ 2")).toMatchObject({ code: "LEXICAL" });
  });
  it("un error dentro de una función anidada se propaga", () => {
    expect(code("abs(1 / 0)")).toMatchObject({ code: "DIV_ZERO" });
    expect(code("max(1, 2, 1 / 0)")).toMatchObject({ code: "DIV_ZERO" });
  });
});

describe("funciones de texto (T-252)", () => {
  it("unir / concat", () => { expect(val('unir("a", "b", 3)')).toBe("ab3"); expect(val('concat("x")')).toBe("x"); });
  it("largo / length", () => { expect(val('largo("hola")')).toBe(4); expect(val('length("")')).toBe(0); });
  it("mayusculas y minusculas", () => { expect(val('mayusculas("Mole")')).toBe("MOLE"); expect(val('minusculas("Mole")')).toBe("mole"); expect(val('upper("a")')).toBe("A"); expect(val('lower("A")')).toBe("a"); });
  it("recortar / trim", () => { expect(val('recortar("  hola  ")')).toBe("hola"); expect(val('trim(" x ")')).toBe("x"); });
  it("contiene / contains (sin distinguir mayúsculas)", () => { expect(val('contiene("Mole poblano", "POBLANO")')).toBe(true); expect(val('contains("abc", "z")')).toBe(false); });
  it("reemplazar / replace cambia todas las apariciones", () => { expect(val('reemplazar("a-b-c", "-", "+")')).toBe("a+b+c"); expect(val('replace("aaa", "a", "b")')).toBe("bbb"); });
  it("subcadena / substring (inicio base 0, fin opcional)", () => {
    expect(val('subcadena("abcdef", 2)')).toBe("cdef");
    expect(val('subcadena("abcdef", 1, 4)')).toBe("bcd");
    expect(val('substring("abc", 0, 99)')).toBe("abc");
  });
  it("texto / totext convierte cualquier valor", () => {
    expect(val("texto(5)")).toBe("5"); expect(val("texto(true)")).toBe("verdadero"); expect(val('totext(prop("Entrega"))')).toBe("2026-03-10");
  });
  it("tipos inválidos dan error", () => { expect(code("mayusculas(5)")).toMatchObject({ code: "TYPE" }); expect(code("largo(true)")).toMatchObject({ code: "TYPE" }); });
});

describe("funciones numéricas (T-253)", () => {
  it("abs", () => { expect(val("abs(-4.5)")).toBe(4.5); expect(val("abs(3)")).toBe(3); });
  it("redondear / round, con decimales opcionales", () => {
    expect(val("redondear(2.5)")).toBe(3); expect(val("redondear(-2.5)")).toBe(-3); expect(val("round(3.14159, 2)")).toBe(3.14); expect(val("redondear(1234.5, -2)")).toBe(1200);
  });
  it("piso y techo", () => { expect(val("piso(2.9)")).toBe(2); expect(val("piso(-2.1)")).toBe(-3); expect(val("techo(2.1)")).toBe(3); expect(val("floor(1.5)")).toBe(1); expect(val("ceil(1.5)")).toBe(2); });
  it("min y max con varios argumentos", () => { expect(val("min(3, 1, 2)")).toBe(1); expect(val("max(3, 1, 2)")).toBe(3); expect(val("max(5)")).toBe(5); });
  it("raiz / sqrt y raíz de negativo = error de dominio", () => { expect(val("raiz(16)")).toBe(4); expect(val("sqrt(2)")).toBeCloseTo(1.41421356); expect(code("raiz(-1)")).toMatchObject({ code: "DOMAIN" }); });
  it("potencia / pow", () => { expect(val("potencia(2, 8)")).toBe(256); expect(val("pow(9, 0.5)")).toBe(3); });
  it("residuo / mod (entre cero es error)", () => { expect(val("residuo(10, 3)")).toBe(1); expect(val("mod(7, 7)")).toBe(0); expect(code("residuo(1, 0)")).toMatchObject({ code: "DIV_ZERO" }); });
  it("suma / sum", () => { expect(val("suma(1, 2, 3)")).toBe(6); expect(val("sum(0.1, 0.2)")).toBeCloseTo(0.3); });
  it("numero / tonumber convierte texto numérico y rechaza el resto", () => {
    expect(val('numero("42")')).toBe(42); expect(val('tonumber(" 3.5 ")')).toBe(3.5); expect(val("numero(7)")).toBe(7);
    expect(code('numero("abc")')).toMatchObject({ code: "TYPE" });
  });
});

describe("funciones de fecha (T-254)", () => {
  it("ahora / now y hoy / today salen del reloj inyectado (determinista)", () => {
    expect(val("ahora()")).toEqual(d("2026-03-05T14:30")); expect(val("now()")).toEqual(d("2026-03-05T14:30"));
    expect(val("hoy()")).toEqual(d("2026-03-05")); expect(val("today()")).toEqual(d("2026-03-05"));
  });
  it("fecha / date convierte texto ISO y rechaza fechas inexistentes", () => {
    expect(val('fecha("2026-02-28")')).toEqual(d("2026-02-28")); expect(val('date("2028-02-29")')).toEqual(d("2028-02-29"));
    expect(code('fecha("2026-02-30")')).toMatchObject({ code: "TYPE" }); expect(code('fecha("ayer")')).toMatchObject({ code: "TYPE" });
  });
  it("sumarfecha / dateadd con días, semanas, meses, años, horas y minutos", () => {
    expect(val('sumarfecha(hoy(), 10, "dias")')).toEqual(d("2026-03-15"));
    expect(val('sumarfecha(hoy(), -5, "dias")')).toEqual(d("2026-02-28"));
    expect(val('sumarfecha(hoy(), 2, "semanas")')).toEqual(d("2026-03-19"));
    expect(val('dateadd(hoy(), 1, "meses")')).toEqual(d("2026-04-05"));
    expect(val('sumarfecha(fecha("2026-01-31"), 1, "meses")')).toEqual(d("2026-02-28")); // fin de mes
    expect(val('sumarfecha(fecha("2024-02-29"), 1, "anios")')).toEqual(d("2025-02-28"));
    expect(val('sumarfecha(ahora(), 3, "horas")')).toEqual(d("2026-03-05T17:30"));
    expect(val('sumarfecha(ahora(), 45, "minutos")')).toEqual(d("2026-03-05T15:15"));
    expect(code('sumarfecha(hoy(), 1, "lustros")')).toMatchObject({ code: "TYPE" });
  });
  it("diffecha / datediff: a - b en la unidad indicada, truncado", () => {
    expect(val('diffecha(prop("Entrega"), hoy(), "dias")')).toBe(5);
    expect(val('diffecha(hoy(), prop("Entrega"), "dias")')).toBe(-5);
    expect(val('datediff(fecha("2026-03-15"), fecha("2026-03-01"), "semanas")')).toBe(2);
    expect(val('diffecha(fecha("2026-05-31"), fecha("2026-03-01"), "meses")')).toBe(2);
    expect(val('diffecha(fecha("2028-03-01"), fecha("2026-03-01"), "anios")')).toBe(2);
    expect(val('diffecha(ahora(), prop("Inicio"), "horas")')).toBe(101);
  });
  it("ano, mes y dia", () => {
    expect(val('ano(prop("Entrega"))')).toBe(2026); expect(val('year(hoy())')).toBe(2026);
    expect(val('mes(prop("Entrega"))')).toBe(3); expect(val('month(hoy())')).toBe(3);
    expect(val('dia(prop("Entrega"))')).toBe(10); expect(val('day(hoy())')).toBe(5);
  });
  it("formatofecha / formatdate con YYYY, MM, DD, HH y mm", () => {
    expect(val('formatofecha(prop("Entrega"), "DD/MM/YYYY")')).toBe("10/03/2026");
    expect(val('formatdate(ahora(), "YYYY-MM-DD HH:mm")')).toBe("2026-03-05 14:30");
  });
  it("una fecha vacía en una resta de fechas da error claro", () => {
    expect(code('diffecha(prop("Vacio"), hoy(), "dias")')).toMatchObject({ code: "TYPE" });
  });
});

describe("funciones lógicas (T-255)", () => {
  it("si / if", () => { expect(val('si(prop("Costo") > 50, "caro", "barato")')).toBe("caro"); expect(val("if(false, 1, 2)")).toBe(2); expect(code("si(5, 1, 2)")).toMatchObject({ code: "TYPE" }); });
  it("y / and (varios argumentos)", () => { expect(val("y(true, true, true)")).toBe(true); expect(val("and(true, false)")).toBe(false); });
  it("o / or", () => { expect(val("o(false, false, true)")).toBe(true); expect(val("or(false, false)")).toBe(false); });
  it("no / not", () => { expect(val("no(true)")).toBe(false); expect(val("not(false)")).toBe(true); });
  it("vacio / empty detecta nulos, textos vacíos", () => {
    expect(val('vacio(prop("Vacio"))')).toBe(true); expect(val('vacio("")')).toBe(true); expect(val('empty(prop("Nombre"))')).toBe(false); expect(val("vacio(0)")).toBe(false);
  });
  it("las palabras y/o/no funcionan como operadores y como funciones a la vez", () => {
    expect(val("true y false o true")).toBe(true);
    expect(val("y(true, false) o o(true)")).toBe(true);
  });
});
