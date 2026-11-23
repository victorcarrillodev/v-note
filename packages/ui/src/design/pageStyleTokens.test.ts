// E-025 (spec 005, plan §4.1 y §7.2): tokens del estilo de página. Los valores viven aquí; el núcleo solo los nombra (cssVarsFor).
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pageStyle } from "./tokens";

const css = readFileSync(resolve(__dirname, "tokens.css"), "utf8");
const root = css.slice(css.indexOf(':root, [data-theme="light"] {'), css.indexOf("\n}"));
const read = (name: string) => new RegExp(`--${name}:\\s*([^;]+);`).exec(root)?.[1];

describe("tokens del estilo de página (E-025)", () => {
  it("valores del plan: anchos, tamaños, interlineados, separaciones y alturas de portada", () => {
    expect(pageStyle).toEqual({
      widths: { narrow: 800, normal: 960, wide: 1280 },
      textSizes: { small: 15, normal: 17, large: 19 },
      leadings: { compact: 1.45, normal: 1.625, relaxed: 1.85 },
      gaps: { compact: 0.5, normal: 0.75, relaxed: 1.1 },
      coverHeights: { low: 160, medium: 240, high: 340 },
    });
  });
  it("la hoja generada declara cada variable que nombra cssVarsFor", () => {
    for (const [k, v] of Object.entries(pageStyle.widths)) expect(read(`page-width-${k}`)).toBe(`${v}px`);
    for (const [k, v] of Object.entries(pageStyle.textSizes)) expect(read(`page-text-${k}`)).toBe(`${v}px`);
    for (const [k, v] of Object.entries(pageStyle.leadings)) expect(read(`page-leading-${k}`)).toBe(String(v));
    for (const [k, v] of Object.entries(pageStyle.gaps)) expect(read(`page-gap-${k}`)).toBe(`${v}em`);
    for (const [k, v] of Object.entries(pageStyle.coverHeights)) expect(read(`cover-height-${k}`)).toBe(`${v}px`);
  });
  it("el ancho «normal» coincide con el ancho de lectura actual", () => {
    expect(pageStyle.widths.normal).toBe(960);
    expect(read("size-reading-width")).toBe("960px");
  });
  it("los títulos usan por defecto la fuente del contenido", () => {
    expect(read("font-headings")).toBe("var(--font-content)");
  });
});
