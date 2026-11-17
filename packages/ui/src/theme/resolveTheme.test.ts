// U-033 (RF-2.1): resolución del tema a partir de la preferencia y del sistema.
import { describe, it, expect } from "vitest";
import { resolveTheme, resolvePalette, parseThemeMode } from "./resolveTheme";
import { THEMES, PALETTE_IDS } from "../design/themes";

describe("resolveTheme", () => {
  it.each([
    ["light", false, "light"], ["light", true, "light"],
    ["dark", false, "dark"], ["dark", true, "dark"],
    ["system", false, "light"], ["system", true, "dark"],
  ] as const)("modo %s con sistema oscuro=%s → %s", (mode, sysDark, expected) => {
    expect(resolveTheme(mode, sysDark)).toBe(expected);
  });
  it("una preferencia desconocida se trata como «sistema»", () => {
    expect(resolveTheme("raro" as never, true)).toBe("dark");
    expect(resolveTheme(null as never, false)).toBe("light");
  });
});

describe("temas de color (spec 006)", () => {
  it.each(THEMES.map((th) => [th.id, th.variant] as const))("%s → variante %s con el sistema claro u oscuro", (id, variant) => {
    expect(resolveTheme(id, false)).toBe(variant);
    expect(resolveTheme(id, true)).toBe(variant);
  });
  it("valores nulos o inválidos", () => {
    expect(resolveTheme(undefined, true)).toBe("dark");
    expect(resolveTheme("arcoiris", false)).toBe("light");
  });
  it("resolvePalette devuelve el id solo en los temas de color", () => {
    for (const id of PALETTE_IDS) expect(resolvePalette(id)).toBe(id);
    for (const v of ["light", "dark", "system", "arcoiris", null, undefined]) expect(resolvePalette(v)).toBeNull();
  });
  it("parseThemeMode: válidos tal cual; cualquier otro, «system»", () => {
    for (const v of ["system", "light", "dark", ...PALETTE_IDS]) expect(parseThemeMode(v)).toBe(v);
    for (const v of ["arcoiris", "", null, undefined, "Oceano"]) expect(parseThemeMode(v)).toBe("system");
  });
});
