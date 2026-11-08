// G-133 (prueba primero): el aviso de contraste compara el color del texto con el relleno VISIBLE (mezclado con su opacidad sobre el lienzo).
import { describe, it, expect } from "vitest";
import { resolveDiagramHex, visibleFill, textContrast, hasLowContrast, LOW_CONTRAST } from "./diagramContrast";
import { blockColors, colors } from "../design/tokens";

describe("color final de cada valor guardado", () => {
  it("un hexadecimal se respeta igual en ambos temas", () => {
    expect(resolveDiagramHex("#ff8800", "fill", "light")).toBe("#ff8800"); expect(resolveDiagramHex("#ff8800", "fill", "dark")).toBe("#ff8800");
    expect(resolveDiagramHex("#abc", "text", "dark")).toBe("#aabbcc");
  });
  it("un color de paleta cambia con el tema: relleno = fondo del color de bloque; texto = su tono fuerte", () => {
    expect(resolveDiagramHex("palette:green", "fill", "light")).toBe(blockColors.green!.light.bg);
    expect(resolveDiagramHex("palette:green", "fill", "dark")).toBe(blockColors.green!.dark.bg);
    expect(resolveDiagramHex("palette:green", "text", "light")).toBe(blockColors.green!.light.text);
    expect(resolveDiagramHex("palette:ink", "text", "dark")).toBe(colors.text.dark);
    expect(resolveDiagramHex("palette:white", "fill", "light")).toBe(colors.card.light);
  });
  it("sin relleno es el lienzo", () => { expect(resolveDiagramHex("none", "fill", "dark")).toBe(colors.canvas.dark); });
  it("un valor ilegible cae a la tinta, sin lanzar", () => { expect(resolveDiagramHex("rojo", "text", "light")).toBe(colors.text.light); });
});

describe("relleno visible", () => {
  it("con opacidad completa es el relleno; con 0 % es el lienzo; a medias, la mezcla", () => {
    expect(visibleFill("#000000", 1, "light")).toBe("#000000");
    expect(visibleFill("#000000", 0, "light").toLowerCase()).toBe(colors.canvas.light.toLowerCase());
    const half = visibleFill("#000000", 0.5, "light");
    expect(half).not.toBe("#000000"); expect(half).not.toBe(colors.canvas.light);
  });
});

describe("contraste del texto", () => {
  it("tinta sobre el azul de paleta es legible en ambos temas", () => {
    for (const th of ["light", "dark"] as const) expect(hasLowContrast("palette:ink", "palette:blue", 1, th), th).toBe(false);
  });
  it("texto casi igual al relleno avisa", () => {
    expect(hasLowContrast("#fefefe", "#ffffff", 1, "light")).toBe(true);
    expect(textContrast("#fefefe", "#ffffff", 1, "light")).toBeLessThan(LOW_CONTRAST);
  });
  it("la opacidad cuenta: texto blanco sobre un relleno oscuro al 0 % se lee sobre el lienzo claro mal; al 100 % bien", () => {
    expect(hasLowContrast("#ffffff", "#000000", 1, "light")).toBe(false);
    expect(hasLowContrast("#ffffff", "#000000", 0, "light")).toBe(true);
  });
  it("el umbral es 4,5:1", () => { expect(LOW_CONTRAST).toBe(4.5); });
});
