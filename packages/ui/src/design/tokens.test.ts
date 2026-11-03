// U-007 a U-011, U-013 a U-018, U-021 (spec 002, plan 4): catálogo de tokens y sus contrastes, en ambos temas.
import { describe, it, expect } from "vitest";
import { contrastRatio } from "./contrast";
import { colors, chips, blockColors, typography, spacing, radii, elevation, motion, layers, themes, type Theme } from "./tokens";

const c = (t: Theme, k: keyof typeof colors) => colors[k][t];
const SURFACES = ["canvas", "sidebar", "card", "raised"] as const;

describe("catálogo de color (RF-1.1, RF-2.5)", () => {
  it("todo token de color tiene valor claro y oscuro en formato hexadecimal", () => {
    for (const [name, v] of Object.entries(colors)) {
      for (const t of themes) expect(v[t], `${name}/${t}`).toMatch(/^#[0-9A-Fa-f]{6}$|^rgba\(/);
    }
  });
  it("incluye todos los tokens semánticos de plan 4.1", () => {
    for (const k of ["canvas", "sidebar", "card", "raised", "border", "borderControl", "text", "textMuted", "textPlaceholder", "textDisabled", "accent", "onAccent", "success", "warning", "danger", "scrim"]) {
      expect(colors, k).toHaveProperty(k);
    }
  });
});

describe("contraste de texto sobre superficies (RF-14.1)", () => {
  for (const t of themes) {
    it(`texto principal y suave ≥ 4,5:1 sobre todas las superficies (${t})`, () => {
      for (const s of SURFACES) {
        expect(contrastRatio(c(t, "text"), c(t, s)), `text/${s}`).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(c(t, "textMuted"), c(t, s)), `textMuted/${s}`).toBeGreaterThanOrEqual(4.5);
      }
    });
    it(`acento y estados como texto ≥ 4,5:1 sobre el lienzo, el lateral y la tarjeta (${t})`, () => {
      for (const s of ["canvas", "sidebar", "card"] as const) {
        for (const k of ["accent", "success", "warning", "danger"] as const) {
          expect(contrastRatio(c(t, k), c(t, s)), `${k}/${s}`).toBeGreaterThanOrEqual(4.5);
        }
      }
    });
    it(`texto de ayuda ≥ 4,5:1 sobre lienzo y tarjeta (${t})`, () => {
      for (const s of ["canvas", "card"] as const) expect(contrastRatio(c(t, "textPlaceholder"), c(t, s))).toBeGreaterThanOrEqual(4.5);
    });
    it(`texto sobre el acento (botón principal) ≥ 4,5:1 (${t})`, () => {
      expect(contrastRatio(c(t, "onAccent"), c(t, "accent"))).toBeGreaterThanOrEqual(4.5);
    });
  }
});

describe("bordes de controles (RF-14.1, U-010)", () => {
  for (const t of themes) {
    it(`borde de control ≥ 3:1 sobre todas las superficies (${t})`, () => {
      for (const s of SURFACES) expect(contrastRatio(c(t, "borderControl"), c(t, s)), `borderControl/${s}`).toBeGreaterThanOrEqual(3);
    });
  }
});

describe("chips y avisos semánticos (U-009)", () => {
  for (const t of themes) {
    it(`las cuatro parejas texto/fondo ≥ 4,5:1 (${t})`, () => {
      for (const k of ["info", "success", "warning", "error"] as const) expect(contrastRatio(chips[k][t].fg, chips[k][t].bg), k).toBeGreaterThanOrEqual(4.5);
    });
  }
  it("hay exactamente cuatro tipos", () => { expect(Object.keys(chips).sort()).toEqual(["error", "info", "success", "warning"]); });
});

describe("colores de bloque (RF-2.6, U-011)", () => {
  const names = ["gray", "brown", "red", "orange", "yellow", "green", "blue", "purple", "pink"];
  it("existen los nueve nombres", () => { expect(Object.keys(blockColors).sort()).toEqual([...names].sort()); });
  for (const t of themes) {
    it(`texto de color ≥ 4,5:1 sobre el lienzo y la tarjeta (${t})`, () => {
      for (const n of names) for (const s of ["canvas", "card"] as const) expect(contrastRatio(blockColors[n]![t].text, c(t, s)), `${n}/${s}`).toBeGreaterThanOrEqual(4.5);
    });
    it(`el texto principal es legible (≥ 4,5:1) sobre cada resaltado (${t})`, () => {
      for (const n of names) expect(contrastRatio(c(t, "text"), blockColors[n]![t].bg), n).toBeGreaterThanOrEqual(4.5);
    });
  }
});

describe("calidez de las superficies (RF-2.2, U-... calidez)", () => {
  it("el lienzo claro no es blanco puro y su matiz es cálido (rojo ≥ azul)", () => {
    const hex = colors.canvas.light;
    expect(hex.toUpperCase()).not.toBe("#FFFFFF");
    const [r, , b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    expect(r!).toBeGreaterThanOrEqual(b!);
  });
  it("el lienzo oscuro es carbón de baja luminancia (< 0,02)", async () => {
    const { relativeLuminance } = await import("./contrast");
    expect(relativeLuminance(colors.canvas.dark)).toBeLessThan(0.02);
  });
});

describe("tipografía (RF-1.2, RF-14.2)", () => {
  const levels = ["pageTitle", "h1", "h2", "h3", "reading", "dialogTitle", "component", "ui", "uiSmall", "note", "label"];
  it("define los once niveles con tamaño, interlineado y peso", () => {
    expect(Object.keys(typography).sort()).toEqual([...levels].sort());
    for (const [n, l] of Object.entries(typography)) {
      expect(l.size, n).toBeGreaterThan(0);
      expect(l.line, n).toBeGreaterThan(l.size);
      expect([400, 500, 600, 700]).toContain(l.weight);
    }
  });
  it("tamaños mínimos: interfaz ≥ 12 px, etiqueta ≥ 11 px, lectura ≥ 15 px", () => {
    for (const k of ["component", "ui", "uiSmall", "note"] as const) expect(typography[k].size, k).toBeGreaterThanOrEqual(12);
    expect(typography.label.size).toBeGreaterThanOrEqual(11);
    expect(typography.reading.size).toBeGreaterThanOrEqual(15);
  });
});

describe("espaciado, radios y elevación (RF-1.3 a RF-1.5)", () => {
  it("el espaciado son múltiplos de 4", () => { for (const s of spacing) expect(s % 4).toBe(0); });
  it("radios cerrados: 0, 2, 4, 6, 8 y circular", () => { expect(Object.values(radii)).toEqual([0, 2, 4, 6, 8, 9999]); });
  it("ningún nivel de elevación oscuro usa sombra difusa: se expresa con superficie y microborde", () => {
    for (const [lvl, v] of Object.entries(elevation.dark)) expect(v.shadow, `nivel ${lvl}`).toBe("none");
  });
  it("la elevación clara usa sombras cada vez más marcadas", () => {
    const blur = (s: string) => Number(/(\d+)px\s+(\d+)px\s+(\d+)px/.exec(s)?.[3] ?? 0);
    const light = [1, 2, 3, 4].map((l) => blur(elevation.light[l as 1]!.shadow));
    expect([...light].sort((a, b) => a - b)).toEqual(light);
  });
});

describe("movimiento y capas (RF-1.7)", () => {
  it("duraciones del estándar", () => {
    expect(motion).toMatchObject({ instant: 0, fast: 100, base: 150, slow: 220, exit: 120, theme: 150 });
  });
  it("el orden de capas es estricto", () => {
    expect(layers).toMatchObject({ content: 0, sticky: 10, sidebarOverlay: 30, menu: 40, tooltip: 50, scrim: 55, dialog: 60, toast: 70, skipLink: 100 });
    const v = Object.values(layers); expect([...v].sort((a, b) => a - b)).toEqual(v);
  });
});
