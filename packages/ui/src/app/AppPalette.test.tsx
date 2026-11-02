// La paleta de comandos en la aplicación (RF-5): atajo, apertura de páginas y acciones.
import { describe, it, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nextProvider } from "react-i18next";
import { FakeClock, WorkspaceManager } from "@vnote/core";
import { MemoryConfigStore, MemoryWorkspaceStorage } from "../../../core/tests/support/memoryPorts";
import { createI18n } from "../i18n";
import { MemoryPreferences } from "../theme/theme";
import { App } from "./App";

async function mount() {
  const clock = new FakeClock(Date.UTC(2026, 9, 30, 14, 0));
  const workspaces = new WorkspaceManager(new MemoryConfigStore(), new MemoryWorkspaceStorage(), clock);
  await workspaces.create({ name: "Personal" });
  const i18n = await createI18n();
  const user = userEvent.setup();
  const prefs = new MemoryPreferences();
  render(<I18nextProvider i18n={i18n}><App services={{ workspaces, clock }} preferences={prefs} /></I18nextProvider>);
  await screen.findByRole("button", { name: "Nueva página" });
  return { user, prefs };
}

describe("paleta en la aplicación", () => {
  it("Ctrl+K abre la paleta y Esc la cierra", async () => {
    const { user } = await mount();
    await user.keyboard("{Control>}k{/Control}");
    expect(await screen.findByRole("dialog", { name: "Paleta de comandos" })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
  it("la acción «Crear página» de la paleta crea una página", async () => {
    const { user } = await mount();
    await user.keyboard("{Control>}k{/Control}");
    await user.click(await screen.findByRole("option", { name: "Crear página" }));
    await waitFor(() => expect(screen.getAllByRole("treeitem")).toHaveLength(1));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
  it("la acción «Cambiar tema» de la paleta alterna el tema", async () => {
    const { user, prefs } = await mount();
    await user.keyboard("{Control>}k{/Control}");
    await user.click(await screen.findByRole("option", { name: "Cambiar tema" }));
    await waitFor(() => expect(prefs.get("theme")).toMatch(/^(light|dark)$/));
  });
  it("buscar y elegir una página la abre", async () => {
    const { user } = await mount();
    await user.click(screen.getByRole("button", { name: "Nueva página" }));
    await user.type(await screen.findByLabelText("Título de la página"), "Presupuesto{Enter}");
    await user.click(screen.getByRole("button", { name: "Nueva página" }));
    await waitFor(() => expect((screen.getByLabelText("Título de la página") as HTMLInputElement).value).toBe(""));
    await user.keyboard("{Control>}k{/Control}");
    await user.type(await screen.findByPlaceholderText(/Busca páginas/), "presu");
    await user.click(await screen.findByRole("option", { name: /Presupuesto/ }));
    await waitFor(() => expect((screen.getByLabelText("Título de la página") as HTMLInputElement).value).toBe("Presupuesto"));
  });
});
