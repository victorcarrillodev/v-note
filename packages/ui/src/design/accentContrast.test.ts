// E-123 (RF-8.2, D-21, RNF-3): cada color de acento, en tema claro y oscuro, se lee sobre los fondos de la página y admite texto encima.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ACCENT_IDS, cssVarsFor } from "@vnote/core";
import { blockColors, colors, themes } from "./tokens";
import { contrastRatio } from "./contrast";

describe("colores de acento", () => {
  for (const theme of themes) {
    for (const id of ACCENT_IDS) {
      const accent = blockColors[id]![theme].text;
      it(`${id} (${theme}): enlaces e índice ≥ 4,5:1 sobre el lienzo y la tarjeta; texto sobre el acento ≥ 4,5:1`, () => {
        expect(contrastRatio(accent, colors.canvas[theme]), "sobre el lienzo").toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(accent, colors.card[theme]), "sobre la tarjeta").toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(colors.onAccent[theme], accent), "texto sobre el acento").toBeGreaterThanOrEqual(4.5);
      });
    }
  }
  it("cada acento del núcleo existe como color del tema, así que cambia con el tema", () => {
    for (const id of ACCENT_IDS) {
      expect(blockColors[id], id).toBeDefined();
      expect(cssVarsFor({ accent: id })["--c-accent"]).toBe(`var(--block-${id}-text)`);
    }
  });
});

describe("el acento se aplica al contenido de la página (E-124)", () => {
  const css = readFileSync(resolve(__dirname, "../page/pageStyle.css"), "utf8");
  it("enlaces, casillas y selección siguen a --c-accent dentro del contenedor", () => {
    expect(css).toMatch(/\.page-scope\s*\{[^}]*accent-color:\s*var\(--c-accent\)/);
    expect(css).toMatch(/\.page-scope \.bn-editor a\s*\{[^}]*color:\s*var\(--c-accent\)/);
    expect(css).toMatch(/checkListItem[^{]*checkbox[^{]*\{[^}]*accent-color:\s*var\(--c-accent\)/);
  });
  it("el resaltado de selección y el borde de foco ya usan --c-accent, que el contenedor redeclara", () => {
    const tokens = readFileSync(resolve(__dirname, "tokens.css"), "utf8");
    expect(tokens).toMatch(/::selection\s*\{[^}]*var\(--c-accent\)/);
  });
});
