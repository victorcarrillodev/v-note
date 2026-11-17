// Spec 006 (T-048 a T-050, RNF-6): los textos de los temas existen en español e inglés y coinciden con la sección 6.3 del plan.
import { describe, it, expect } from "vitest";
import { resources } from "./index";
import { findMissingKeys } from "./keys";
import { PALETTE_IDS } from "../design/themes";

const es = (resources["es-MX"].translation as { theme: Record<string, string> }).theme;
const en = (resources.en.translation as { theme: Record<string, string> }).theme;

describe("textos de los temas de color", () => {
  it("el grupo theme tiene las mismas claves en los dos idiomas", () => {
    expect(findMissingKeys(es, en)).toEqual({ missingInB: [], missingInA: [] });
  });
  it("hay un nombre por cada tema del catálogo", () => {
    for (const id of PALETTE_IDS) { expect(es[id], id).toBeTypeOf("string"); expect(en[id], id).toBeTypeOf("string"); }
  });
  it("los nombres en español coinciden con el plan", () => {
    expect(PALETTE_IDS.map((id) => es[id])).toEqual(["Océano", "Bosque", "Atardecer", "Lavanda", "Blanco y negro", "Medianoche", "Esmeralda", "Rosa nocturna", "Ámbar", "Grafito"]);
    expect([es.groupSystem, es.groupLight, es.groupDark, es.variantLight, es.variantDark]).toEqual(["Sistema", "Temas claros", "Temas oscuros", "claro", "oscuro"]);
    expect(es.option).toBe("{{name}}, {{variant}}");
  });
  it("los nombres en inglés coinciden con el plan y no hay español", () => {
    expect(PALETTE_IDS.map((id) => en[id])).toEqual(["Ocean", "Forest", "Sunset", "Lavender", "Black & White", "Midnight", "Emerald", "Night rose", "Amber", "Graphite"]);
    expect([en.groupSystem, en.groupLight, en.groupDark, en.variantLight, en.variantDark]).toEqual(["System", "Light themes", "Dark themes", "light", "dark"]);
    for (const v of Object.values(en)) expect(v, v).not.toMatch(/[áéíóúñ¿¡]/i);
  });
});
