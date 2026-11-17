// E-181 (RNF-7): la interfaz en inglés no tiene textos en español en lo que añadió la spec 005.
import { describe, it, expect } from "vitest";
import { resources } from "./index";

const leaves = (o: unknown, path = ""): [string, string][] =>
  typeof o === "string" ? [[path, o]] : o && typeof o === "object" ? Object.entries(o).flatMap(([k, v]) => leaves(v, path ? `${path}.${k}` : k)) : [];
const SPANISH_CHARS = /[áéíóúñ¿¡]/i;
const SPANISH_WORDS = /\b(página|páginas|portada|foto|fotos|clave|texto|título|títulos|índice|descripción|guardar|borrar|cambiar|quitar|añadir|agrega|elegir|colores|esquinas|altura|ancho|bloquear|restablecer|predeterminado|usar|como|para|con|sin|del|las|los|una|uno|tu|tus|de|la|el|en|por|que|se)\b/i;
// Palabras iguales en los dos idiomas que no cuentan como español.
const ALLOWED = new Set(["Unsplash", "Normal", "Hasta H1", "Hasta H2", "Hasta H3", "—"]);

describe("textos en inglés de la spec 005 (E-181)", () => {
  it("el detector reconoce el español (prueba de la prueba)", () => {
    expect(SPANISH_WORDS.test("Cambiar portada")).toBe(true);
    expect(SPANISH_CHARS.test("Descripción")).toBe(true);
    expect(SPANISH_WORDS.test("Change cover")).toBe(false);
  });
  const en = resources.en.translation as Record<string, unknown>;
  for (const group of ["cover", "pageHeader", "pageOptions", "unsplash", "toc"]) {
    it(`«${group}» no tiene español`, () => {
      const bad = leaves(en[group], group).filter(([, v]) => !ALLOWED.has(v) && (SPANISH_CHARS.test(v) || SPANISH_WORDS.test(v.replace(/\{\{[^}]+\}\}/g, ""))));
      expect(bad).toEqual([]);
    });
  }
});
