// E-075 (RNF-7): los textos de portada, ajustes y cabecera existen en español e inglés.
import { describe, it, expect } from "vitest";
import { resources } from "./index";
import { findMissingKeys } from "./keys";

const get = (o: Record<string, unknown>, path: string) => path.split(".").reduce<unknown>((acc, k) => (acc as Record<string, unknown> | undefined)?.[k], o);

describe("textos de la spec 005 (E-075)", () => {
  const es = resources["es-MX"].translation as Record<string, unknown>;
  const en = resources.en.translation as Record<string, unknown>;
  it("los grupos cover, pageHeader y pageOptions existen y no tienen claves de menos en ningún idioma", () => {
    for (const group of ["cover", "pageHeader", "pageOptions"]) {
      expect(get(es, group), group).toBeTypeOf("object");
      expect(findMissingKeys(get(es, group) as Record<string, unknown>, get(en, group) as Record<string, unknown>)).toEqual({ missingInB: [], missingInA: [] });
    }
  });
  it("cada texto tiene contenido y los dos idiomas no copian el mismo texto en las etiquetas principales", () => {
    for (const key of ["cover.change", "cover.tabUpload", "cover.reposition", "pageOptions.open", "pageOptions.sections.header"]) {
      expect(get(es, key), key).toBeTypeOf("string");
      expect(get(es, key)).not.toBe(get(en, key));
    }
  });
});
