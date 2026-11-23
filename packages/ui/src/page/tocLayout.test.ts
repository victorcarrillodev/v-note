// E-141 (RF-7.7, CL-17): el índice flotante solo se usa si cabe en el margen; si no, modo reducido.
import { describe, it, expect } from "vitest";
import { tocFits, contentWidthOf, TOC_NEEDED_MARGIN } from "./tocLayout";

describe("tocFits", () => {
  it("a 900 px (sin barra fija, contenido de 720) no cabe", () => { expect(tocFits(900, 720)).toBe(false); });
  it("a 360 px no cabe", () => { expect(tocFits(360, 720)).toBe(false); });
  it("en una pantalla muy ancha con el ancho normal cabe", () => { expect(tocFits(1800, 720)).toBe(true); });
  it("el margen es la mitad de lo que sobra tras la barra lateral y el contenido", () => {
    // 1 700 − 240 (barra) = 1 460; sobran 740 → 370 por lado
    expect(tocFits(1700, 720)).toBe(true);
    // justo en el límite: 2 × 248 + 720 + 240 = 1 456
    expect(tocFits(2 * TOC_NEEDED_MARGIN + 720 + 240, 720)).toBe(true);
    expect(tocFits(2 * TOC_NEEDED_MARGIN + 720 + 240 - 1, 720)).toBe(false);
  });
  it("un contenido más ancho necesita una pantalla más ancha; «completo» nunca deja margen", () => {
    expect(tocFits(1500, 720)).toBe(true);
    expect(tocFits(1500, 960)).toBe(false);
    expect(tocFits(5000, contentWidthOf("full"))).toBe(false);
  });
  it("el ancho de contenido sale de los tokens", () => {
    expect([contentWidthOf("narrow"), contentWidthOf(undefined), contentWidthOf("wide")]).toEqual([800, 960, 1280]);
  });
});
