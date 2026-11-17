// U-034, U-035, U-036, U-037 (RF-2.3, RF-2.4): el tema se aplica antes del primer pintado y reacciona al sistema sin recargar.
import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { themeBootScript, themeBootPlugin } from "./bootPlugin";
import { applyTheme } from "./applyTheme";
import { THEMES } from "../design/themes";

const run = (store: Record<string, string>, systemDark: boolean) => {
  document.documentElement.removeAttribute("data-theme");
  document.documentElement.removeAttribute("data-palette");
  document.documentElement.removeAttribute("data-density");
  document.documentElement.removeAttribute("data-font");
  const fake = { getItem: (k: string) => store[k] ?? null };
  const mm = () => ({ matches: systemDark });
  new Function("localStorage", "matchMedia", themeBootScript)(fake, mm);
};
beforeEach(() => { document.documentElement.removeAttribute("data-theme"); });

describe("script de arranque del tema", () => {
  it("con preferencia oscura aplica data-theme=dark antes de montar nada", () => {
    run({ "vnote:theme": "dark" }, false);
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });
  it("con «sistema» sigue al sistema", () => {
    run({ "vnote:theme": "system" }, true);
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    run({}, false);
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });
  it("aplica también la densidad y la tipografía guardadas", () => {
    run({ "vnote:density": "compact", "vnote:font": "serif" }, false);
    expect(document.documentElement.getAttribute("data-density")).toBe("compact");
    expect(document.documentElement.getAttribute("data-font")).toBe("serif");
  });
  it("valores inválidos se ignoran sin romper", () => {
    run({ "vnote:theme": "morado", "vnote:density": "x", "vnote:font": "y" }, false);
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    expect(document.documentElement.hasAttribute("data-density")).toBe(false);
  });
  it("si localStorage lanza (modo privado) usa el sistema y no falla", () => {
    document.documentElement.removeAttribute("data-theme");
    const bad = { getItem: () => { throw new Error("bloqueado"); } };
    new Function("localStorage", "matchMedia", themeBootScript)(bad, () => ({ matches: true }));
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });
});

describe("plugin de arranque para las aplicaciones", () => {
  it("inyecta el script al principio del <head> de forma síncrona (antes del primer pintado)", () => {
    const tags = themeBootPlugin().transformIndexHtml() as { tag: string; children: string; injectTo: string; attrs?: Record<string, unknown> }[];
    expect(tags).toHaveLength(1);
    expect(tags[0]).toMatchObject({ tag: "script", injectTo: "head-prepend", children: themeBootScript });
    expect(tags[0]!.attrs?.defer).toBeUndefined();
    expect(tags[0]!.attrs?.type).toBeUndefined();
  });
  it("las dos aplicaciones lo usan en su configuración de build", () => {
    for (const app of ["web", "desktop"]) {
      expect(readFileSync(resolve(__dirname, `../../../../apps/${app}/vite.config.ts`), "utf8"), app).toContain("themeBootPlugin");
    }
  });
});

describe("arranque con temas de color (spec 006, T-038 a T-040)", () => {
  const attrs = () => [document.documentElement.getAttribute("data-theme"), document.documentElement.getAttribute("data-palette")];
  it("el script se construye desde el catálogo: contiene los diez ids con su variante", () => {
    for (const t of THEMES) expect(themeBootScript).toContain(`"${t.id}":"${t.variant}"`);
  });
  it.each(["system", "light", "dark", ...THEMES.map((t) => t.id), "arcoiris", "", "__proto__", "constructor"])("paridad con applyTheme para «%s» (sistema oscuro y claro)", (value) => {
    for (const systemDark of [true, false]) {
      run(value === "" ? {} : { "vnote:theme": value }, systemDark);
      const fromScript = attrs();
      document.documentElement.removeAttribute("data-theme"); document.documentElement.removeAttribute("data-palette");
      applyTheme(document.documentElement, value, systemDark);
      expect(fromScript, `${value} / sistema oscuro=${systemDark}`).toEqual(attrs());
    }
  });
  it("sin tema válido no deja data-palette de antes", () => {
    document.documentElement.setAttribute("data-palette", "ambar");
    run({ "vnote:theme": "dark" }, false);
    expect(document.documentElement.hasAttribute("data-palette")).toBe(false);
  });
  it("con localStorage que lanza error usa el sistema y no pone tema de color", () => {
    document.documentElement.removeAttribute("data-palette");
    const bad = { getItem: () => { throw new Error("bloqueado"); } };
    new Function("localStorage", "matchMedia", themeBootScript)(bad, () => ({ matches: false }));
    expect(attrs()).toEqual(["light", null]);
  });
  it("el HTML de las dos aplicaciones lleva el script primero en <head> y contiene «grafito»", async () => {
    const { transformIndexHtml } = themeBootPlugin();
    const [tag] = transformIndexHtml() as { children: string; injectTo: string }[];
    expect(tag!.injectTo).toBe("head-prepend");
    expect(tag!.children).toContain('"grafito"');
  });
});
