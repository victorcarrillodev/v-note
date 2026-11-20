import { describe, it, expect } from "vitest";
import { GRADIENT_ACCENTS, PASTEL_ACCENTS, VIVID_ACCENTS, customAccentVars, onColor, parseCustomAccent } from "./accent";
import { applyStylePatch, cssVarsFor, parseStyle } from "./style";

describe("paletas de acento", () => {
  it("cada paleta tiene exactamente 66 colores válidos y distintos", () => {
    for (const list of [VIVID_ACCENTS, PASTEL_ACCENTS, GRADIENT_ACCENTS]) {
      expect(list.length).toBe(66);
      expect(new Set(list).size).toBe(list.length);
      for (const c of list) expect(parseCustomAccent(c)).toBe(c);
    }
    expect(GRADIENT_ACCENTS.every((g) => g.includes("~"))).toBe(true);
  });
  it("parseCustomAccent normaliza y rechaza lo inválido", () => {
    expect(parseCustomAccent("#ABCDEF")).toBe("#abcdef");
    expect(parseCustomAccent("#aaaaaa~#BBBBBB")).toBe("#aaaaaa~#bbbbbb");
    for (const bad of ["red", "#fff", "#aaaaaa~", "#aaaaaa~#bbbbbb~#cccccc", 3, null]) expect(parseCustomAccent(bad)).toBeUndefined();
  });
  it("onColor elige negro sobre claros y blanco sobre oscuros", () => {
    expect(onColor("#ffffff")).toBe("#000000");
    expect(onColor("#101030")).toBe("#ffffff");
  });
});

describe("acento propio en el estilo", () => {
  it("se conserva al leer, guardar y aplicar; lo inválido se descarta", () => {
    expect(parseStyle('{"accent":"#FF0000"}').accent).toBe("#ff0000");
    expect(parseStyle('{"accent":"nope"}').accent).toBeUndefined();
    expect(applyStylePatch({}, { accent: "#00ff00~#0000ff" }).accent).toBe("#00ff00~#0000ff");
  });
  it("declara color, texto legible, texto sobre acento y relleno de degradado", () => {
    expect(cssVarsFor({ accent: "#ff0000" })).toMatchObject({ "--c-accent": "#ff0000", "--c-on-accent": "#000000" });
    expect(cssVarsFor({ accent: "#ff0000" })["--c-accent-fill"]).toBeUndefined();
    expect(customAccentVars("#ff0000~#0000ff")["--c-accent-fill"]).toBe("linear-gradient(90deg, #ff0000, #0000ff)");
    expect(cssVarsFor({ accent: "blue" })["--c-accent"]).toBe("var(--block-blue-text)");
  });
});
