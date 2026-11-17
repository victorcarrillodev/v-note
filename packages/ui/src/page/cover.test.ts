// U-152 (RF-5.1, RF-2.5): seis degradados por tema y compatibilidad con portadas de color plano ya guardadas.
import { describe, it, expect } from "vitest";
import { COVER_NAMES, coverBackground, coverImageHash, hasCover, randomCover } from "./cover";
import { coverGradients } from "../design/tokens";

describe("portadas", () => {
  it("hay exactamente seis degradados y coinciden con los del catálogo de tokens", () => {
    expect([...COVER_NAMES].sort()).toEqual(Object.keys(coverGradients).sort());
    expect(COVER_NAMES).toHaveLength(6);
  });
  it("un degradado se guarda por nombre y se pinta con la variable del tema", () => {
    expect(coverBackground("gradient:sage")).toBe("var(--cover-sage)");
  });
  it("una portada de color plano heredada se sigue viendo igual", () => {
    expect(coverBackground("color:#cfe8ff")).toBe("#cfe8ff");
  });
  it("un valor desconocido o dañado se trata como «sin portada», nunca falla (E-086, CL-14)", () => {
    for (const bad of ["gradient:nope", "???", "color:rojo", "lgrad:400:#fff,#000", "asset:corto", "", null, undefined]) {
      expect(coverBackground(bad)).toBeNull();
      expect(hasCover(bad)).toBe(false);
    }
  });
  it("pinta cualquier forma válida de `cover` (E-086)", () => {
    expect(coverBackground("lgrad:45:#112233,#445566")).toBe("linear-gradient(45deg, #112233, #445566)");
    expect(coverBackground("lgrad:0:#112233,#445566,#778899")).toBe("linear-gradient(0deg, #112233, #445566, #778899)");
    const h = "ab".repeat(32);
    expect(coverBackground(`asset:${h}`)).toBeNull(); // se pinta con una imagen
    expect(coverImageHash(`asset:${h}`)).toBe(h);
    expect(hasCover(`asset:${h}`)).toBe(true);
    expect(coverImageHash("gradient:sky")).toBeNull();
  });
  it("una portada nueva siempre es un degradado válido", () => {
    for (let i = 0; i < 20; i++) expect(coverBackground(randomCover())).toMatch(/^var\(--cover-/);
  });
});
