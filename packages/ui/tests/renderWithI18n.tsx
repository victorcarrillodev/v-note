// Utilidad de PRUEBA: renderiza con i18n (español por defecto).
import type { ReactElement } from "react";
import { render, type RenderResult } from "@testing-library/react";
import type { i18n as I18n } from "i18next";
import { I18nextProvider } from "react-i18next";
import { createI18n } from "../src/i18n";

export async function renderWithI18n(ui: ReactElement, lng?: string): Promise<RenderResult & { i18n: I18n }> {
  const i18n = await createI18n(lng);
  return { i18n, ...render(<I18nextProvider i18n={i18n}>{ui}</I18nextProvider>) };
}
