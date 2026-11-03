// U-152 (RF-5.1, RF-2.5): seis degradados por tema y compatibilidad con portadas de color plano ya guardadas.
import { describe, it, expect } from "vitest";
import { COVER_NAMES, coverBackground, randomCover } from "./cover";
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
  it("un valor desconocido cae en el degradado neutro en vez de dejar la portada vacía", () => {
    expect(coverBackground("gradient:nope")).toBe("var(--cover-graphite)");
    expect(coverBackground("???")).toBe("var(--cover-graphite)");
  });
  it("una portada nueva siempre es un degradado válido", () => {
    for (let i = 0; i < 20; i++) expect(coverBackground(randomCover())).toMatch(/^var\(--cover-/);
  });
});
