// Pulido posterior a la spec 004 (plan §17e): los controles nativos sin clase toman el aspecto del estándar desde la hoja global,
// dentro de `@layer base` para que cualquier clase de utilidad los siga pudiendo cambiar.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const css = readFileSync(resolve(__dirname, "tokens.css"), "utf8");
const start = css.indexOf("@layer base {");
const base = css.slice(start);

describe("capa base de controles nativos", () => {
  it("vive en @layer base (las utilidades de Tailwind siempre ganan)", () => {
    expect(start).toBeGreaterThanOrEqual(0);
  });
  it("los bordes sin color propio usan el borde suave del estándar (no el color del texto) y los controles no llevan borde", () => {
    expect(base).toMatch(/\*, ::before, ::after[^{]*\{\s*border-color: var\(--c-border\);/);
    expect(base).toMatch(/button, input, select, textarea[^{]*\{\s*border-width: 0;/);
  });
  it("un botón nativo sin clase es un botón secundario del estándar (sin borde, relleno, radio, 32 px, hover)", () => {
    const rule = /button:where\(:not\(\[class\]\)[^{]*\{([^}]*)\}/.exec(base)?.[1] ?? "";
    expect(rule).toContain("min-height: 32px");
    expect(rule).toContain("border: 0");
    expect(rule).toContain("background: var(--c-raised)");
    expect(rule).toContain("border-radius: var(--radius-base)");
    expect(base).toMatch(/button:where\(:not\(\[class\]\)[^{]*:hover:not\(:disabled\)[^{]*\{\s*background: var\(--c-border\)/);
  });
  it("no toca los botones con papel propio (pestañas, opciones de menú, interruptores, elementos del árbol)", () => {
    const sel = /button:where\(([^{]*)\) \{/.exec(base)?.[1] ?? "";
    for (const role of ["tab", "menuitem", "option", "switch", "treeitem"]) expect(sel).toContain(`:not([role="${role}"])`);
  });
  it("las reglas de estado y de variante solo alcanzan a los botones sin clase", () => {
    for (const m of base.matchAll(/\n\s*(button[^{\n]*(?::hover|:disabled|data-variant)[^{\n]*) \{/g)) expect(m[1]).toContain(":where(:not([class]))");
  });
  it("hay variantes primaria y de peligro por atributo, con los tokens de acento y peligro", () => {
    expect(base).toMatch(/\[data-variant="primary"\][^{]*\{[^}]*background: var\(--c-accent\);[^}]*color: var\(--c-on-accent\)/);
    expect(base).toMatch(/\[data-variant="danger"\][^{]*\{[^}]*color: var\(--c-danger\)/);
  });
  it("campos de texto y selectores sin clase: sin borde, relleno y 32 px", () => {
    const rule = /select:where\(:not\(\[class\]\)\)[^{]*\{([^}]*)\}/.exec(base)?.[1] ?? "";
    expect(rule).toContain("min-height: 32px");
    expect(rule).toContain("background: var(--c-raised)");
    expect(base).toContain('input:where(:not([class]):not([type="checkbox"]):not([type="radio"])');
  });
  it("con puntero grueso los controles miden al menos 44 px", () => {
    expect(base).toMatch(/@media \(pointer: coarse\) \{[^@]*min-height: 44px/);
  });
  it("casillas, botones de opción y deslizadores usan el color de acento", () => {
    expect(css).toMatch(/:root \{[^}]*accent-color: var\(--c-accent\)/);
  });
});
