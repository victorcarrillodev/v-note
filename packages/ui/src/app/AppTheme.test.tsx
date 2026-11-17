// Spec 006 (T-043, T-044, T-047): «Cambiar tema» desde cualquiera de los 13 valores y arranque con una preferencia guardada.
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nextProvider } from "react-i18next";
import { FakeClock, WorkspaceManager } from "@vnote/core";
import { MemoryConfigStore, MemoryWorkspaceStorage } from "../../../core/tests/support/memoryPorts";
import { createI18n } from "../i18n";
import { MemoryPreferences } from "../theme/theme";
import { THEMES, variantOf } from "../design/themes";
import { App } from "./App";

async function mount(theme: string | null) {
  const clock = new FakeClock(Date.UTC(2026, 9, 30, 14, 0));
  const workspaces = new WorkspaceManager(new MemoryConfigStore(), new MemoryWorkspaceStorage(), clock);
  await workspaces.create({ name: "Personal" });
  const i18n = await createI18n();
  const prefs = new MemoryPreferences();
  if (theme) prefs.set("theme", theme);
  render(<I18nextProvider i18n={i18n}><App services={{ workspaces, clock }} preferences={prefs} /></I18nextProvider>);
  await screen.findByRole("button", { name: "Nueva página" });
  return { user: userEvent.setup(), prefs };
}
const root = document.documentElement;
beforeEach(() => {
  root.removeAttribute("data-theme"); root.removeAttribute("data-palette");
  (window as unknown as { matchMedia: unknown }).matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
});

const VALUES = [["system", "light"], ["light", "light"], ["dark", "dark"], ...THEMES.map((t) => [t.id, t.variant] as const)] as const;

describe("tema en la aplicación", () => {
  it.each(VALUES)("con «%s» (variante %s) la preferencia guardada deja los atributos correctos al abrir", async (value, variant) => {
    await mount(value);
    expect(root.getAttribute("data-theme")).toBe(variant);
    const isColor = THEMES.some((t) => t.id === value);
    expect(root.getAttribute("data-palette")).toBe(isColor ? value : null);
  });
  it("con la preferencia «ambar» guardada a mano, la aplicación abre con data-theme=dark y data-palette=ambar", async () => {
    await mount("ambar");
    expect(root.getAttribute("data-theme")).toBe("dark");
    expect(root.getAttribute("data-palette")).toBe("ambar");
  });
  it.each(VALUES)("«Cambiar tema» desde «%s» (variante %s) pasa a la variante contraria y quita el tema de color", async (value, variant) => {
    const { user, prefs } = await mount(value);
    await user.keyboard("{Control>}k{/Control}");
    await user.click(await screen.findByRole("option", { name: "Cambiar tema" }));
    const expected = variant === "dark" ? "light" : "dark";
    expect(root.getAttribute("data-theme")).toBe(expected);
    expect(root.hasAttribute("data-palette")).toBe(false);
    expect(prefs.get("theme")).toBe(expected);
    expect(variantOf(expected)).toBe(expected);
  });
});
