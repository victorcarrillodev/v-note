// Spec 006, Fase 1 (T-011 a T-026): catálogo de temas de color, hoja generada y contrastes. Las pruebas salen del catálogo (`it.each`): un tema nuevo queda cubierto solo.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { THEMES, PALETTE_IDS, variantOf, isPaletteId, type ThemeDef } from "./themes";
import { paletteColors, colors } from "./tokens";
import { contrastRatio } from "./contrast";
import { checkTheme } from "./themeContrast";

const css = readFileSync(resolve(__dirname, "tokens.css"), "utf8");
const COLOR_KEYS = ["canvas", "sidebar", "card", "raised", "border", "borderControl", "text", "textMuted", "textPlaceholder", "textDisabled", "accent", "onAccent", "success", "warning", "danger"];
const kebab = (s: string) => s.replace(/[A-Z]/g, (m) => "-" + m.toLowerCase());

describe("catálogo", () => {
  it("hay exactamente los diez ids, cinco claros y luego cinco oscuros", () => {
    expect([...PALETTE_IDS]).toEqual(["oceano", "bosque", "atardecer", "lavanda", "blanco-y-negro", "medianoche", "esmeralda", "rosa-nocturna", "ambar", "grafito"]);
    expect(THEMES.map((t) => t.variant)).toEqual(["light", "light", "light", "light", "light", "dark", "dark", "dark", "dark", "dark"]);
  });
  it.each(THEMES.map((t) => [t.id, t] as const))("%s: 15 colores #RRGGBB", (_id, t) => {
    expect(Object.keys(t.colors).sort()).toEqual([...COLOR_KEYS].sort());
    for (const v of Object.values(t.colors)) expect(v).toMatch(/^#[0-9A-F]{6}$/);
  });
  it("variantOf e isPaletteId", () => {
    for (const t of THEMES) expect(variantOf(t.id)).toBe(t.variant);
    expect(variantOf("light")).toBe("light");
    expect(variantOf("dark")).toBe("dark");
    expect(isPaletteId("arcoiris")).toBe(false);
    expect(isPaletteId("ambar")).toBe(true);
    expect(isPaletteId("dark")).toBe(false);
    expect(isPaletteId(null)).toBe(false);
  });
});

describe("hoja tokens.css", () => {
  const block = (id: string) => new RegExp(`:root\\[data-palette="${id}"\\]\\s*\\{([^}]*)\\}`).exec(css)?.[1] ?? "";
  it.each(THEMES.map((t) => [t.id, t] as const))("%s: un bloque con solo los 15 tokens --c-*", (_id, t) => {
    const vars = [...block(t.id).matchAll(/(--[\w-]+):\s*([^;]+);/g)];
    expect(vars.map((m) => m[1]).sort()).toEqual(COLOR_KEYS.map((k) => `--c-${kebab(k)}`).sort());
    for (const [, name, value] of vars) expect(value).toBe((t.colors as Record<string, string>)[name!.replace("--c-", "").replace(/-([a-z])/g, (_m, c: string) => c.toUpperCase())]);
  });
  it("los bloques de tema van después del oscuro y `color-scheme` solo está en los bloques claro y oscuro", () => {
    const dark = css.indexOf(':root[data-theme="dark"]');
    expect(css.indexOf(`:root[data-palette="${PALETTE_IDS[0]}"]`)).toBeGreaterThan(dark);
    for (const id of PALETTE_IDS) expect(block(id)).not.toMatch(/color-scheme/);
  });
  it("los bloques claro y oscuro no cambian: siguen con sus colores base", () => {
    expect(css).toMatch(new RegExp(`:root, \\[data-theme="light"\\] \\{[^}]*--c-canvas: ${colors.canvas.light};`));
    expect(css).toMatch(new RegExp(`:root\\[data-theme="dark"\\], \\[data-theme="dark"\\] \\{[^}]*--c-canvas: ${colors.canvas.dark};`));
  });
  it("paletteColors es la fuente de los bloques", () => {
    for (const id of PALETTE_IDS) expect(block(id)).toContain(`--c-canvas: ${paletteColors[id].canvas};`);
  });
});

describe("contraste por tema", () => {
  it("checkTheme devuelve el par que falla", () => {
    const bad: ThemeDef = { id: "oceano", variant: "light", colors: { ...paletteColors.oceano, text: "#CCCCCC", canvas: "#FFFFFF" } };
    expect(checkTheme(bad).map((f) => f.pair)).toContain("text/canvas");
  });
  it.each(THEMES.map((t) => [t.id, t] as const))("%s cumple todos los mínimos (texto 4,5:1, bordes de control 3:1, bloques, acentos de página, llamadas)", (_id, t) => {
    expect(checkTheme(t)).toEqual([]);
  });
  it("Blanco y negro: texto y acento sobre el lienzo en 21:1", () => {
    const c = paletteColors["blanco-y-negro"];
    expect(contrastRatio(c.text, c.canvas)).toBeCloseTo(21, 5);
    expect(contrastRatio(c.accent, c.canvas)).toBeCloseTo(21, 5);
  });
});
