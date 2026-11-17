// U-012, U-019 a U-021, U-023: la hoja de tokens coincide con el catálogo y trae las reglas globales de foco, movimiento reducido y contraste forzado.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { colors, typography, spacing, radii, motion, layers, elevation, themes, sizes } from "./tokens";

const css = readFileSync(resolve(__dirname, "tokens.css"), "utf8");
const block = (selector: string) => {
  const i = css.indexOf(selector);
  expect(i, `falta ${selector}`).toBeGreaterThanOrEqual(0);
  return css.slice(css.indexOf("{", i) + 1, css.indexOf("\n}", i));
};
const kebab = (s: string) => s.replace(/[A-Z]/g, (m) => "-" + m.toLowerCase());
const norm = (s: string) => s.trim().toLowerCase();
const read = (b: string, name: string) => new RegExp(`--${name}:\\s*([^;]+);`).exec(b)?.[1];

describe("variables de color de la hoja (RF-1.1, RF-2.1)", () => {
  for (const t of themes) {
    const sel = t === "light" ? ':root, [data-theme="light"] {' : ':root[data-theme="dark"], [data-theme="dark"] {';
    it(`${t}: cada token de color coincide con el catálogo`, () => {
      const b = block(sel);
      for (const [name, v] of Object.entries(colors)) expect(norm(read(b, `c-${kebab(name)}`) ?? "FALTA"), name).toBe(norm(v[t]));
    });
  }
  it("paridad: todo token existe en ambos temas (RF-2.5)", () => {
    const light = block(':root, [data-theme="light"] {'), dark = block(':root[data-theme="dark"], [data-theme="dark"] {');
    const names = (b: string) => [...b.matchAll(/--(c-[a-z-]+):/g)].map((m) => m[1]).sort();
    expect(names(dark)).toEqual(names(light));
  });
  it("el tema claro es el predeterminado y declara color-scheme", () => {
    expect(block(':root, [data-theme="light"] {')).toContain("color-scheme: light");
    expect(block(':root[data-theme="dark"], [data-theme="dark"] {')).toContain("color-scheme: dark");
  });
});

describe("variables de tipografía, espaciado, radios, movimiento y capas", () => {
  const root = block(':root, [data-theme="light"] {');
  it("cada nivel tipográfico tiene tamaño, interlineado y peso", () => {
    for (const [n, l] of Object.entries(typography)) {
      expect(norm(read(root, `text-${kebab(n)}-size`) ?? ""), n).toBe(`${l.size}px`);
      expect(norm(read(root, `text-${kebab(n)}-line`) ?? ""), n).toBe(`${l.line}px`);
      expect(norm(read(root, `text-${kebab(n)}-weight`) ?? ""), n).toBe(String(l.weight));
    }
  });
  it("espaciado de base 4", () => { for (const s of spacing) expect(read(root, `space-${s / 4}`), `space-${s / 4}`).toBe(`${s}px`); });
  it("radios cerrados", () => { for (const [n, r] of Object.entries(radii)) expect(read(root, `radius-${kebab(n)}`), n).toBe(`${r}px`); });
  it("movimiento", () => { for (const [n, ms] of Object.entries(motion)) expect(read(root, `motion-${kebab(n)}`), n).toBe(`${ms}ms`); });
  it("tamaños estructurales", () => { for (const [n, v] of Object.entries(sizes)) expect(read(root, `size-${kebab(n)}`), n).toBe(`${v}px`); });
  it("capas", () => { for (const [n, z] of Object.entries(layers)) expect(read(root, `z-${kebab(n)}`), n).toBe(String(z)); });
  it("elevación oscura sin sombra difusa", () => {
    const dark = block(':root[data-theme="dark"], [data-theme="dark"] {');
    for (const l of [1, 2, 3, 4]) expect(norm(read(dark, `elevation-${l}`) ?? ""), `nivel ${l}`).toBe(elevation.dark[l as 1]!.shadow);
  });
});

describe("densidad compacta (RF-10.4)", () => {
  const compact = block(':root[data-density="compact"] {');
  it("reduce el espaciado vertical (−4 px) y baja la lectura solo a 15/22, nunca por debajo del mínimo", () => {
    expect(compact).toContain("--density-pad: -4px");
    expect(read(compact, "text-reading-size")).toBe("15px");
    expect(read(compact, "text-reading-line")).toBe("22px");
    expect(parseInt(read(compact, "text-reading-size") ?? "0")).toBeGreaterThanOrEqual(15);
  });
  it("no toca los tamaños de la interfaz (siguen ≥ 12 px)", () => {
    for (const k of ["ui-size", "ui-small-size", "note-size"]) expect(compact).not.toContain(`--text-${k}`);
  });
});

describe("reglas globales", () => {
  it("anillo de foco doble: 2 px de acento más 2 px de separación (RF-14.3)", () => {
    expect(css).toMatch(/:focus-visible\s*\{[^}]*outline:\s*2px solid var\(--c-accent\)[^}]*outline-offset:\s*2px/s);
    expect(css).toContain("box-shadow: 0 0 0 2px var(--c-canvas)");
  });
  it("«reducir movimiento» elimina animaciones y transiciones largas (RF-14.8)", () => {
    const m = /@media \(prefers-reduced-motion: reduce\)\s*\{([\s\S]*?)\n\}/.exec(css)?.[1] ?? "";
    expect(m).toContain("animation-duration");
    expect(m).toContain("transition-duration");
    expect(m).toMatch(/scroll-behavior:\s*auto/);
  });
  it("contraste forzado: bordes y foco con colores del sistema (RF-14.11)", () => {
    const m = /@media \(forced-colors: active\)\s*\{([\s\S]*?)\n\}/.exec(css)?.[1] ?? "";
    expect(m).toContain("CanvasText");
    expect(m).toContain("Highlight");
  });
  it("el cambio de tema anima solo color de fondo y texto, 150 ms (RF-1.7, RF-2.3)", () => {
    expect(css).toMatch(/transition:\s*background-color var\(--motion-theme\)[^;]*,\s*color var\(--motion-theme\)[^;]*;/);
  });
});

// Spec 006, T-046 (RF-3.3): `color-scheme` sale de la variante; ningún bloque de tema lo redefine.
describe("color-scheme y temas de color", () => {
  it("solo aparece en los bloques claro y oscuro", () => {
    const css = readFileSync(resolve(__dirname, "tokens.css"), "utf8");
    const blocks = [...css.matchAll(/^([^\n{]*(?:data-theme|data-palette)[^\n{]*)\{([^}]*)\}/gm)];
    const withScheme = blocks.filter((b) => /color-scheme:/.test(b[2]!)).map((b) => b[1]!.trim());
    expect(withScheme).toEqual([':root, [data-theme="light"]', ':root[data-theme="dark"], [data-theme="dark"]']);
  });
});
