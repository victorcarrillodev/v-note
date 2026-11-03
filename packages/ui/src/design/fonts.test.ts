// U-038 a U-041 (RF-1.9, RF-10.1, CL-27): tipografías incluidas en la aplicación, sin red, con respaldo del sistema.
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync, statSync } from "node:fs";
import { resolve } from "node:path";

const dir = __dirname;
const fonts = readFileSync(resolve(dir, "fonts.css"), "utf8");
const tokens = readFileSync(resolve(dir, "tokens.css"), "utf8");
const families = [["Inter Variable", "inter-latin-wght-normal.woff2"], ["JetBrains Mono Variable", "jetbrains-mono-latin-wght-normal.woff2"], ["Source Serif 4 Variable", "source-serif-4-latin-wght-normal.woff2"]];

describe("tipografías incluidas", () => {
  it.each(families)("%s se declara con un archivo local que existe", (family, file) => {
    expect(fonts).toContain(`font-family: "${family}"`);
    expect(fonts).toContain(`./fonts/${file}`);
    expect(existsSync(resolve(dir, "fonts", file))).toBe(true);
  });
  it("ninguna dirección externa en la hoja de fuentes ni en la de tokens", () => {
    expect(fonts).not.toMatch(/https?:\/\//);
    expect(tokens).not.toMatch(/https?:\/\//);
  });
  it("font-display: swap en todas (el texto nunca queda invisible)", () => {
    expect((fonts.match(/font-display:\s*swap/g) ?? []).length).toBe(3);
  });
  it("las tres familias pesan menos que el tope acordado de 200 KB", () => {
    const total = families.reduce((s, [, f]) => s + statSync(resolve(dir, "fonts", f!)).size, 0);
    expect(total).toBeLessThan(200 * 1024);
  });
  it("cada pila trae respaldo del sistema (CL-27)", () => {
    expect(tokens).toMatch(/--font-sans:[^;]*system-ui/);
    expect(tokens).toMatch(/--font-serif:[^;]*Georgia/);
    expect(tokens).toMatch(/--font-mono:[^;]*ui-monospace/);
  });
  it("la tipografía del contenido es conmutable (sans, serif, mono) sin tocar la de la interfaz", () => {
    expect(tokens).toMatch(/:root\[data-font="serif"\]\s*\{\s*--font-content:\s*var\(--font-serif\)/);
    expect(tokens).toMatch(/:root\[data-font="mono"\]\s*\{\s*--font-content:\s*var\(--font-mono\)/);
    expect(tokens).not.toMatch(/data-font[^{]*\{[^}]*--font-sans/);
  });
  it("incluye las licencias de las tres fuentes", () => {
    for (const n of ["inter", "jetbrains-mono", "source-serif-4"]) expect(existsSync(resolve(dir, "fonts", `LICENSE-${n}.txt`))).toBe(true);
  });
});
