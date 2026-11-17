// Spec 006 (T-072, T-075, CL-11): la paleta de exportación sale del catálogo y el documento resultante se lee.
import { describe, it, expect } from "vitest";
import { buildExportCss, type ExportPalette } from "@vnote/core";
import { exportPaletteFor } from "./exportPalette";
import { THEMES, colorsOf } from "./themes";
import { colors, blockColors, chips } from "./tokens";
import { contrastRatio } from "./contrast";

describe("exportPaletteFor", () => {
  it("Claro y Oscuro usan los colores base de la variante", () => {
    for (const v of ["light", "dark"] as const) {
      const p = exportPaletteFor(v, v === "light");
      expect(p.variant).toBe(v);
      expect(p.canvas).toBe(colors.canvas[v]);
      expect(p.text).toBe(colors.text[v]);
      expect(p.accent).toBe(colors.accent[v]);
    }
  });
  it.each(THEMES.map((t) => [t.id, t] as const))("%s usa los colores de su catálogo y los de llamadas y bloques de su variante", (id, t) => {
    const p = exportPaletteFor(id, t.variant === "light");
    expect(p.variant).toBe(t.variant);
    for (const k of ["canvas", "text", "textMuted", "border", "borderControl", "raised", "accent", "danger"] as const) expect(p[k]).toBe(t.colors[k]);
    expect(p.chips.error.bg).toBe(chips.error[t.variant].bg);
    expect(p.blocks.purple.text).toBe(blockColors.purple![t.variant].text);
  });
  it("«sistema» usa la variante que muestre el sistema ahora", () => {
    expect(exportPaletteFor("system", true)).toEqual(exportPaletteFor("dark", false));
    expect(exportPaletteFor("system", false)).toEqual(exportPaletteFor("light", true));
    expect(exportPaletteFor("arcoiris", true).variant).toBe("dark");
  });
  it("coincide con colorsOf para Claro y Oscuro", () => {
    expect(exportPaletteFor("dark", false).canvas).toBe(colorsOf("dark").canvas);
  });
});

/** Pares texto/fondo de la hoja con paleta: se extraen de la propia hoja y se miden. */
function pairs(css: string, p: ExportPalette): { name: string; fg: string; bg: string }[] {
  const out: { name: string; fg: string; bg: string }[] = [];
  const get = (sel: string, prop: string) => new RegExp(`(?:^|[}{])${sel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\{[^}]*?${prop}:(#[0-9a-fA-F]{6})`).exec(css)?.[1];
  const add = (name: string, fg: string | undefined, bg: string | undefined) => { if (fg && bg) out.push({ name, fg, bg }); else throw new Error(`par sin valores: ${name}`); };
  add("cuerpo", get("body", "color"), get("body", "background"));
  add("figcaption", get("figcaption", "color"), p.canvas);
  add("pre", p.text, get("pre", "background"));
  add("blockquote", get("blockquote", "color"), p.canvas);
  add("th", p.text, get("th", "background"));
  add("enlaces", get("a", "color"), p.canvas);
  add("menciones", get(".mention", "color"), p.canvas);
  add("faltante", get(".missing", "color"), p.canvas);
  add("when", get(".when", "color"), p.canvas);
  for (const k of ["info", "warning", "success", "error"] as const) add(`llamada ${k}`, p.text, p.chips[k].bg);
  for (const [k, v] of Object.entries(p.blocks)) { add(`c-${k}`, get(`.c-${k}`, "color"), p.canvas); add(`bg-${k}`, p.text, get(`.bg-${k}`, "background")); }
  return out;
}

describe("contraste del documento exportado (RF-6.3, RF-5.1)", () => {
  it.each<[string, string]>([["light", "light"], ["dark", "dark"], ...THEMES.map((t): [string, string] => [t.id, t.variant])])("%s: los pares texto/fondo de la hoja llegan a 4,5:1", (id, variant) => {
    const p = exportPaletteFor(id, variant === "dark");
    for (const pr of pairs(buildExportCss(p), p)) expect(contrastRatio(pr.fg, pr.bg), `${id}: ${pr.name}`).toBeGreaterThanOrEqual(4.5);
  });
});
