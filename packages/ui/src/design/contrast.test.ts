// U-006: razón de contraste WCAG con casos conocidos.
import { describe, it, expect } from "vitest";
import { contrastRatio, relativeLuminance } from "./contrast";

describe("contraste WCAG", () => {
  it("negro sobre blanco es 21:1 y es simétrico", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 1);
    expect(contrastRatio("#FFFFFF", "#000000")).toBeCloseTo(21, 1);
  });
  it("un color contra sí mismo es 1:1", () => {
    expect(contrastRatio("#37352F", "#37352F")).toBeCloseTo(1, 5);
  });
  it("valores de referencia publicados: #767676 sobre blanco ≈ 4,54:1 y #777777 ≈ 4,48:1", () => {
    expect(contrastRatio("#767676", "#FFFFFF")).toBeCloseTo(4.54, 1);
    expect(contrastRatio("#777777", "#FFFFFF")).toBeCloseTo(4.48, 1);
  });
  it("acepta formato corto #RGB y minúsculas", () => {
    expect(contrastRatio("#fff", "#000")).toBeCloseTo(21, 1);
  });
  it("luminancia de blanco 1 y de negro 0", () => {
    expect(relativeLuminance("#ffffff")).toBeCloseTo(1, 5);
    expect(relativeLuminance("#000000")).toBeCloseTo(0, 5);
  });
  it("rechaza colores inválidos", () => {
    expect(() => contrastRatio("rojo", "#fff")).toThrow();
  });
});
