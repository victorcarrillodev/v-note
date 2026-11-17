// E-105 (RNF-3, DP-16) y E-092 (CL-3): el oscurecido predeterminado se lee; por debajo de 55 se avisa.
import { describe, it, expect } from "vitest";
import { whiteTextContrast, shouldWarnOverlay, SAFE_OVERLAY } from "./contrast";

describe("contraste del título sobre la portada", () => {
  it("el oscurecido predeterminado (60) da 4,5:1 o más con texto blanco sobre una imagen blanca (E-105)", () => {
    expect(whiteTextContrast(60)).toBeGreaterThanOrEqual(4.5);
  });
  it("54 es el primer valor que cumple 4,5:1 (α ≥ 0,54 del plan); el umbral de aviso, 55, ya lo cumple", () => {
    expect(whiteTextContrast(53)).toBeLessThan(4.5);
    expect(whiteTextContrast(54)).toBeGreaterThanOrEqual(4.5);
    expect(whiteTextContrast(SAFE_OVERLAY)).toBeGreaterThanOrEqual(4.5);
    expect(whiteTextContrast(0)).toBeLessThan(2);
  });
  it("más oscurecido nunca baja el contraste", () => {
    for (let o = 0; o < 100; o++) expect(whiteTextContrast(o + 1)).toBeGreaterThanOrEqual(whiteTextContrast(o));
  });
  it("avisa en 54 y no en 55, y solo con el título sobre la portada (E-092)", () => {
    expect(shouldWarnOverlay(54, true)).toBe(true);
    expect(shouldWarnOverlay(55, true)).toBe(false);
    expect(shouldWarnOverlay(0, false)).toBe(false);
  });
});
