// G-054, G-055, G-056, G-057 (prueba primero): tamaños y contraste de los símbolos del lienzo del diagrama (RF-15, RF-16, CL-10).
import { describe, it, expect } from "vitest";
import { ANCHOR_DOT, symbolScale, visiblePx, hitPx, hitRadiusFlow } from "./metrics";
import { contrastRatio } from "../design/contrast";
import { blockColors, colors, themes } from "../design/tokens";
import { PALETTE_IDS } from "../design/diagramPalette";

describe("tamaño de los símbolos al hacer zoom", () => {
  it("a zoom 1 miden lo que su tamaño base", () => {
    expect(symbolScale(1)).toBe(1);
    expect(visiblePx(1)).toBe(ANCHOR_DOT);
  });
  it("a zoom 4 se encogen en el lienzo para seguir midiendo lo mismo en pantalla", () => {
    expect(symbolScale(4)).toBe(0.25);
    expect(visiblePx(4)).toBe(ANCHOR_DOT);
  });
  it("a zoom 0,1 se agrandan en el lienzo hasta un tope, así que en pantalla siguen siendo visibles (≥ 9 px)", () => {
    expect(symbolScale(0.1)).toBe(8);
    expect(visiblePx(0.1)).toBeGreaterThanOrEqual(9);
    expect(symbolScale(0.01)).toBe(8); // el tope evita símbolos gigantes
  });
  it("un zoom no válido se trata como 1", () => { expect(symbolScale(0)).toBe(1); expect(symbolScale(NaN)).toBe(1); });
});

describe("área activa", () => {
  it("32 px con puntero fino y 44 px con puntero grueso", () => { expect(hitPx(false)).toBe(32); expect(hitPx(true)).toBe(44); });
  it("se conserva en pantalla a cualquier zoom: el radio en el lienzo es la mitad entre el zoom", () => {
    for (const z of [0.1, 0.5, 1, 4]) {
      expect(hitRadiusFlow(z, false) * 2 * z).toBeCloseTo(32, 9);
      expect(hitRadiusFlow(z, true) * 2 * z).toBeCloseTo(44, 9);
    }
  });
});

describe("anillo doble de los símbolos: relleno de tarjeta + trazo de acento", () => {
  const bgs = (th: "light" | "dark") => {
    const out: Record<string, string> = { canvas: colors.canvas[th], white: colors.card[th] };
    for (const id of PALETTE_IDS) if (id !== "ink" && id !== "white") out[id] = blockColors[id]![th].bg;
    return out;
  };
  for (const th of themes) {
    it(`${th}: el acento se distingue del relleno de tarjeta (≥ 3:1) y del lienzo y de todos los rellenos de la paleta (≥ 3:1)`, () => {
      expect(contrastRatio(colors.accent[th], colors.card[th])).toBeGreaterThanOrEqual(3);
      for (const [name, bg] of Object.entries(bgs(th))) expect(contrastRatio(colors.accent[th], bg), `${th} ${name}`).toBeGreaterThanOrEqual(3);
    });
    it(`${th}: el borde de selección (acento) contrasta ≥ 3:1 también con el lienzo`, () => {
      expect(contrastRatio(colors.accent[th], colors.canvas[th])).toBeGreaterThanOrEqual(3);
    });
  }
});
