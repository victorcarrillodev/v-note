// T-107 y T-108 (prueba primero): i18n español de México (por defecto) e inglés, con claves idénticas.
import { describe, it, expect } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { I18nextProvider, useTranslation } from "react-i18next";
import { createI18n, resources, DEFAULT_LANGUAGE } from "./index";
import { findMissingKeys } from "./keys";

function Hello() {
  const { t } = useTranslation();
  return <p>{t("app.trash")}</p>;
}

describe("i18n (T-107)", () => {
  it("usa español de México por defecto", async () => {
    expect(DEFAULT_LANGUAGE).toBe("es-MX");
    const i18n = await createI18n();
    render(<I18nextProvider i18n={i18n}><Hello /></I18nextProvider>);
    expect(screen.getByText("Papelera")).toBeInTheDocument();
  });
  it("el texto cambia al cambiar de idioma", async () => {
    const i18n = await createI18n();
    render(<I18nextProvider i18n={i18n}><Hello /></I18nextProvider>);
    await act(async () => { await i18n.changeLanguage("en"); });
    expect(screen.getByText("Trash")).toBeInTheDocument();
  });
  it("una clave que falta en el idioma activo cae al español, nunca muestra la clave técnica", async () => {
    const i18n = await createI18n("en");
    i18n.addResource("es-MX", "translation", "solo.es", "Solo en español");
    expect(i18n.t("solo.es")).toBe("Solo en español");
  });
  it("interpola variables", async () => {
    const i18n = await createI18n();
    expect(i18n.t("trash.daysLeft", { count: 3 })).toContain("3");
  });
});

describe("claves de traducción (T-108)", () => {
  it("español e inglés tienen exactamente las mismas claves", () => {
    expect(findMissingKeys(resources["es-MX"].translation, resources.en.translation)).toEqual({ missingInB: [], missingInA: [] });
  });
  it("el comprobador detecta claves faltantes en cada sentido", () => {
    const a = { x: "1", y: { z: "2", w: "3" } };
    const b = { x: "1", y: { z: "2" }, extra: "4" };
    expect(findMissingKeys(a, b)).toEqual({ missingInB: ["y.w"], missingInA: ["extra"] });
  });
  it("ningún mensaje visible contiene códigos técnicos ni restos de valor sin definir (U-142, RF-11.7)", () => {
    const flat = (o: Record<string, unknown>, p = ""): [string, string][] =>
      Object.entries(o).flatMap(([k, v]) => (typeof v === "string" ? [[p + k, v] as [string, string]] : flat(v as Record<string, unknown>, p + k + ".")));
    const codigo = /\b[A-Z][A-Z0-9]*_[A-Z0-9_]+\b/;
    const bad = [...flat(resources["es-MX"].translation), ...flat(resources.en.translation)]
      .filter(([, v]) => codigo.test(v) || /\bundefined\b|\bnull\b/.test(v));
    expect(bad).toEqual([]);
  });
  it("ningún valor está vacío", () => {
    const empties = (o: Record<string, unknown>, p = ""): string[] =>
      Object.entries(o).flatMap(([k, v]) => (typeof v === "string" ? (v.trim() === "" ? [p + k] : []) : empties(v as Record<string, unknown>, p + k + ".")));
    expect(empties(resources["es-MX"].translation)).toEqual([]);
    expect(empties(resources.en.translation)).toEqual([]);
  });
});
