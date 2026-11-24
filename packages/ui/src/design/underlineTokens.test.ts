// Colores del subrayado con estilo: mismos nombres que el núcleo, en claro y oscuro, y sus variables CSS existen.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { UNDERLINE_COLORS, UNDERLINE_DARK_STRENGTH } from "@vnote/core";
import { underlineColors, underlineStrength } from "./tokens";

const css = readFileSync(join(__dirname, "tokens.css"), "utf8");
describe("colores del subrayado", () => {
  it("hay un color por cada nombre del núcleo, y solo esos", () => {
    expect(Object.keys(underlineColors).sort()).toEqual([...UNDERLINE_COLORS].sort());
  });
  it("cada color es hexadecimal de 6 cifras en claro y oscuro, y su variable está en tokens.css", () => {
    for (const [name, v] of Object.entries(underlineColors)) for (const t of ["light", "dark"] as const) {
      expect(v[t], `${name}/${t}`).toMatch(/^#[0-9a-f]{6}$/i);
      expect(css, `${name}/${t}`).toContain(`--underline-${name}: ${v[t]};`);
    }
  });
  it("en oscuro el relleno es más transparente que en claro, y las dos variables están en tokens.css", () => {
    expect(underlineStrength.light).toBe(1);
    expect(underlineStrength.dark).toBe(UNDERLINE_DARK_STRENGTH);
    expect(UNDERLINE_DARK_STRENGTH).toBeLessThan(1);
    expect(css).toContain("--underline-strength: 1;");
    expect(css).toContain(`--underline-strength: ${UNDERLINE_DARK_STRENGTH};`);
  });
});
