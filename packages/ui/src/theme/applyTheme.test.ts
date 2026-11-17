// Spec 006 (T-031): applyTheme pone data-theme y data-palette, y quita este último cuando no aplica.
import { describe, it, expect, beforeEach } from "vitest";
import { applyTheme } from "./applyTheme";
import { THEMES } from "../design/themes";

const root = document.documentElement;
beforeEach(() => { root.removeAttribute("data-theme"); root.removeAttribute("data-palette"); });

describe("applyTheme", () => {
  it.each(THEMES.map((t) => [t.id, t.variant] as const))("%s deja data-palette y la variante %s", (id, variant) => {
    applyTheme(root, id, !(variant === "dark"));
    expect(root.getAttribute("data-palette")).toBe(id);
    expect(root.getAttribute("data-theme")).toBe(variant);
  });
  it("pasar de Océano a Oscuro quita data-palette", () => {
    applyTheme(root, "oceano", false);
    applyTheme(root, "dark", false);
    expect(root.hasAttribute("data-palette")).toBe(false);
    expect(root.getAttribute("data-theme")).toBe("dark");
  });
  it("Claro, Oscuro, Sistema y un valor inválido no ponen data-palette", () => {
    for (const m of ["light", "dark", "system", "arcoiris", null]) {
      applyTheme(root, "ambar", false);
      applyTheme(root, m, true);
      expect(root.hasAttribute("data-palette"), String(m)).toBe(false);
    }
    applyTheme(root, "system", true);
    expect(root.getAttribute("data-theme")).toBe("dark");
  });
});
