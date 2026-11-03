// U-151, U-160, U-167 (RF-5.4, RF-5.5, RF-5.7, RF-2.6): la interfaz del editor usa los mismos tokens que la aplicación.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { blockColors } from "../design/tokens";

const css = readFileSync(join(__dirname, "editor.css"), "utf8");
const decl = (name: string) => new RegExp(`${name.replace(/[-]/g, "\\-")}:\\s*([^;]+);`).exec(css)?.[1]?.trim();

describe("tema del editor", () => {
  it("menús, barra y asa comparten fondo, borde, radio y sombra con los menús de la app", () => {
    expect(decl("--bn-colors-menu-background")).toBe("var(--c-card)");
    expect(decl("--bn-colors-menu-text")).toBe("var(--c-text)");
    expect(decl("--bn-colors-border")).toBe("var(--c-border)");
    expect(decl("--bn-colors-hovered-background")).toBe("var(--c-raised)");
    expect(decl("--bn-border-radius")).toBe("var(--radius-md)");
    expect(decl("--bn-shadow-medium")).toBe("var(--elevation-3)");
    expect(decl("--bn-font-family")).toBe("var(--font-sans)");
  });
  it("no contiene valores de color sueltos", () => {
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(css).not.toMatch(/rgba?\(/);
  });
  it("los nueve colores de BlockNote se toman de los tokens por nombre", () => {
    for (const n of Object.keys(blockColors)) {
      expect(css, n).toContain(`--bn-colors-highlights-${n}-text: var(--block-${n}-text)`);
      expect(css, n).toContain(`--bn-colors-highlights-${n}-background: var(--block-${n}-bg)`);
    }
  });
});

describe("bloques con el estándar (U-162, U-164, U-165)", () => {
  const rule = (sel: string) => new RegExp(`${sel.replace(/[.\[\]()*^$|?+\\]/g, "\\$&")}[^{]*\\{([^}]*)\\}`).exec(css)?.[1] ?? "";
  it("las tablas usan borde y encabezado de los tokens", () => {
    const r = rule(".bn-container .bn-block-content[data-content-type=\"table\"] td");
    expect(r).toContain("var(--c-border)");
    expect(css).toMatch(/\[data-content-type="table"\] th \{\s*background: var\(--c-raised\)/);
  });
  it("la imagen se ajusta al ancho, tiene marco neutro y pie atenuado", () => {
    const img = rule(".bn-container .bn-visual-media");
    expect(img).toContain("max-width: 100%");
    expect(img).toContain("var(--c-border)");
    expect(img).toContain("var(--c-card)"); // fondo neutro: una imagen transparente no queda sobre negro puro en oscuro
    expect(rule(".bn-container .bn-file-caption")).toContain("var(--c-text-muted)");
  });
  it("la lista de verificación marcada se atenúa con el color del texto atenuado", () => {
    expect(rule(".bn-container [data-content-type=\"checkListItem\"][data-checked=\"true\"] .bn-inline-content")).toContain("var(--c-text-muted)");
  });
  it("el código usa la fuente monoespaciada y el fondo elevado", () => {
    const r = rule(".bn-container .bn-block-content[data-content-type=\"codeBlock\"]");
    expect(r).toContain("var(--font-mono)");
    expect(r).toContain("var(--c-raised)");
  });
});
