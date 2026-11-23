// T-143, T-144 (prueba primero): ajustes de idioma, tema y atajos reasignables con aviso de conflicto (RF-20).
import { describe, it, expect, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithI18n } from "../../tests/renderWithI18n";
import { ThemeProvider, MemoryPreferences } from "../theme/theme";
import { SettingsView } from "./SettingsView";
import { loadBindings } from "./bindingsStore";
import { choose } from "../../tests/dropdown";

beforeEach(() => document.documentElement.removeAttribute("data-theme"));

async function setup(prefs = new MemoryPreferences()) {
  const user = userEvent.setup();
  const r = await renderWithI18n(<ThemeProvider preferences={prefs}><SettingsView preferences={prefs} /></ThemeProvider>);
  return { user, prefs, ...r };
}

describe("ajustes de tema e idioma (T-144)", () => {
  it("cambia el tema y lo aplica", async () => {
    const { user, prefs } = await setup();
    await user.click(screen.getByRole("radio", { name: "Oscuro" }));
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(prefs.get("theme")).toBe("dark");
  });
  it("cambia el idioma a inglés, la interfaz se traduce y se recuerda", async () => {
    const { user, prefs } = await setup();
    await choose(user, screen.getByLabelText("Idioma"), "en");
    expect(await screen.findByRole("heading", { name: "Settings" })).toBeInTheDocument();
    expect(prefs.get("language")).toBe("en");
  });
});

describe("atajos (T-143)", () => {
  it("lista cada acción con su atajo actual", async () => {
    await setup();
    const row = screen.getByRole("row", { name: /Abrir la paleta de comandos/ });
    expect(row).toHaveTextContent("Ctrl+K");
  });
  it("reasigna un atajo pulsando la nueva combinación y lo guarda", async () => {
    const { user, prefs } = await setup();
    await user.click(screen.getByRole("button", { name: "Cambiar atajo de Crear página" }));
    await user.keyboard("{Control>}{Alt>}j{/Alt}{/Control}");
    await waitFor(() => expect(loadBindings(prefs)["page.new"]).toBe("Mod+Alt+J"));
    expect(screen.getByRole("row", { name: /Crear página/ })).toHaveTextContent("Ctrl+Alt+J");
  });
  it("avisa si choca y deja elegir quién conserva el atajo", async () => {
    const { user, prefs } = await setup();
    await user.click(screen.getByRole("button", { name: "Cambiar atajo de Crear página" }));
    await user.keyboard("{Control>}k{/Control}");
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Abrir la paleta de comandos");
    expect(loadBindings(prefs)["page.new"]).not.toBe("Mod+K"); // aún no se cambió nada
    await user.click(screen.getByRole("button", { name: "Usar aquí" }));
    await waitFor(() => expect(loadBindings(prefs)["page.new"]).toBe("Mod+K"));
    expect(loadBindings(prefs)["palette.open"]).toBeNull();
  });
  it("«Conservar el otro» cancela el cambio", async () => {
    const { user, prefs } = await setup();
    await user.click(screen.getByRole("button", { name: "Cambiar atajo de Crear página" }));
    await user.keyboard("{Control>}k{/Control}");
    await user.click(await screen.findByRole("button", { name: "Conservar el otro" }));
    expect(loadBindings(prefs)["palette.open"]).toBe("Mod+K");
    expect(screen.queryByRole("alert")).toBeNull();
  });
  it("«Restablecer» devuelve los atajos de fábrica", async () => {
    const { user, prefs } = await setup();
    await user.click(screen.getByRole("button", { name: "Cambiar atajo de Crear página" }));
    await user.keyboard("{Control>}{Alt>}j{/Alt}{/Control}");
    await user.click(await screen.findByRole("button", { name: "Restablecer atajos" }));
    expect(loadBindings(prefs)["page.new"]).toBe("Mod+Alt+N");
  });
});
