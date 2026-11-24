import { describe, it, expect } from "vitest";
import { EMOJIS, searchEmojis, randomEmoji, fold } from "./emojiData";

describe("datos de emoji", () => {
  it("no hay emojis repetidos y cada uno trae palabras para buscar", () => {
    const all = EMOJIS.flatMap((g) => g.entries);
    expect(new Set(all.map((e) => e.char)).size).toBe(all.length);
    for (const e of all) expect(e.words.length, e.char).toBeGreaterThan(0);
  });
  it("busca sin importar acentos, mayúsculas ni idioma", () => {
    expect(searchEmojis("CORAZÓN").map((e) => e.char)).toContain("❤️");
    expect(searchEmojis("heart").map((e) => e.char)).toContain("❤️");
    expect(searchEmojis("corazon azul").map((e) => e.char)).toEqual(["💙"]);
  });
  it("sin consulta o sin coincidencias devuelve vacío", () => {
    expect(searchEmojis("  ")).toEqual([]);
    expect(searchEmojis("zzzzqq")).toEqual([]);
  });
  it("el emoji al azar sale de la lista", () => {
    const all = new Set(EMOJIS.flatMap((g) => g.entries.map((e) => e.char)));
    expect(all.has(randomEmoji(() => 0))).toBe(true);
    expect(all.has(randomEmoji(() => 0.999999))).toBe(true);
    expect(fold("Árbol")).toBe("arbol");
  });
});
