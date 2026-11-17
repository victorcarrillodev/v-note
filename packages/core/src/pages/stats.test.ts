// Estadísticas de la página (plan 005, §7.3, RF-8.3). Tareas E-051 a E-053.
import { describe, it, expect } from "vitest";
import { para } from "../../tests/support/builders";
import { pageStats } from "./stats";
import type { Block, Inline } from "../blocks/types";

const t = (text: string): Inline => ({ type: "text", text, styles: {} }) as Inline;

describe("palabras (E-051)", () => {
  it("cuenta palabras en español con acentos, signos y números", () => {
    expect(pageStats([para("¿Qué es la programación orientada a objetos? Él aprendió 3 lenguajes.")]).words).toBe(11);
  });
  it("los emojis y la puntuación suelta no cuentan como palabras", () => {
    expect(pageStats([para("Listo 🚀 — ¡vamos! ...")]).words).toBe(2);
  });
  it("incluye el código y los bloques hijos", () => {
    const code = para("const total = suma(a, b);", "codeBlock");
    const parent = para("Lista", "bulletListItem", { children: [para("uno"), para("dos")] });
    expect(pageStats([code, parent]).words).toBe(5 + 3);
  });
});

describe("caracteres (E-052)", () => {
  it("cuenta grafemas: un emoji compuesto o una letra con acento es un carácter", () => {
    expect(pageStats([para("Año 👩‍💻")]).characters).toBe(5); // A ñ o espacio 👩‍💻
  });
  it("no cuenta los saltos entre bloques e incluye las celdas de las tablas", () => {
    const table: Block = { id: "t", type: "table", props: {}, content: { type: "table", rows: [[[t("ab")], [t("cd")]], [[t("e")], []]] }, children: [] } as unknown as Block;
    expect(pageStats([para("uno"), para("dos"), table]).characters).toBe(3 + 3 + "ab cd".length + 1);
  });
});

describe("tiempo de lectura (E-053)", () => {
  const n = (k: number) => pageStats(k === 0 ? [] : [para(Array.from({ length: k }, (_, i) => `p${i}`).join(" "))]).readingMinutes;
  it("0 en una página vacía, mínimo 1 y redondeo hacia arriba a 200 palabras por minuto", () => {
    expect(n(0)).toBe(0);
    expect(n(1)).toBe(1);
    expect(n(200)).toBe(1);
    expect(n(201)).toBe(2);
  });
});
