// U-038 a U-041 (RF-1.9, RF-10.1, CL-27): tipografías incluidas en la aplicación, sin red, con respaldo del sistema.
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { FONT_IDS } from "@vnote/core";
import { pageFonts } from "./tokens";

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
    expect((fonts.match(/font-display:\s*swap/g) ?? []).length).toBe(FONT_IDS.length);
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

describe("fuentes de página (E-115, E-116, RF-5.1, RNF-6, CL-16)", () => {
  const licenseOf = (file: string) => file.replace(/-latin-wght-normal\.woff2$/, "");
  it.each([...FONT_IDS])("«%s» tiene su @font-face, su archivo y su licencia", (id) => {
    const f = pageFonts[id]!;
    expect(f, `falta ${id} en pageFonts`).toBeDefined();
    expect(fonts).toContain(`font-family: "${f.family}"`);
    expect(fonts).toContain(`./fonts/${f.file}`);
    expect(existsSync(resolve(dir, "fonts", f.file))).toBe(true);
    const license = readFileSync(resolve(dir, "fonts", `LICENSE-${licenseOf(f.file)}.txt`), "utf8");
    expect(license).toMatch(/SIL Open Font License/);
  });
  it("cada fuente tiene su variable --font-<id> con pila de respaldo del sistema", () => {
    for (const id of FONT_IDS) expect(tokens, id).toMatch(new RegExp(`--font-${id}:\\s*"[^"]+",[^;]*(sans-serif|serif|monospace|cursive);`));
  });
  it("el catálogo no tiene fuentes de más ni de menos que los FontId del núcleo", () => {
    expect(Object.keys(pageFonts).sort()).toEqual([...FONT_IDS].sort());
  });
  it("las 7 fuentes nuevas pesan menos de 5 MB en total (E-116)", () => {
    const old = new Set(["inter", "source-serif", "jetbrains-mono"]);
    const total = FONT_IDS.filter((id) => !old.has(id)).reduce((n, id) => n + statSync(resolve(dir, "fonts", pageFonts[id]!.file)).size, 0);
    expect(FONT_IDS.filter((id) => !old.has(id))).toHaveLength(7);
    expect(total).toBeLessThan(5 * 1024 * 1024);
  });
  it("las fuentes siguen sin cargarse de la red", () => {
    expect(fonts).not.toMatch(/https?:\/\//);
  });
});
