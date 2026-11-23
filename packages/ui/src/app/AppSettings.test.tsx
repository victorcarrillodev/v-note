// Ajustes y atajos globales en la aplicación (RF-20, T-143, T-144).
import { describe, it, expect } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nextProvider } from "react-i18next";
import { FakeClock, WorkspaceManager } from "@vnote/core";
import { MemoryConfigStore, MemoryWorkspaceStorage } from "../../../core/tests/support/memoryPorts";
import { createI18n } from "../i18n";
import { MemoryPreferences } from "../theme/theme";
import { saveBindings, loadBindings } from "../settings/bindingsStore";
import { App } from "./App";
import { choose } from "../../tests/dropdown";

async function mount(prefs = new MemoryPreferences()) {
  const clock = new FakeClock(Date.UTC(2026, 9, 30, 14, 0));
  const workspaces = new WorkspaceManager(new MemoryConfigStore(), new MemoryWorkspaceStorage(), clock);
  await workspaces.create({ name: "Personal" });
  const i18n = await createI18n();
  const user = userEvent.setup();
  render(<I18nextProvider i18n={i18n}><App services={{ workspaces, clock }} preferences={prefs} /></I18nextProvider>);
  await screen.findByRole("button", { name: "Nueva página" });
  return { user, prefs };
}

describe("ajustes en la aplicación", () => {
  it("la barra lateral abre los ajustes", async () => {
    const { user } = await mount();
    await user.click(screen.getByRole("button", { name: "Ajustes" }));
    expect(await screen.findByRole("heading", { name: "Ajustes" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Tema" })).toBeInTheDocument();
  });
  it("los ajustes se abren como barra lateral modal sobre la página y se cierran con Escape o con Cerrar", async () => {
    const { user } = await mount();
    const button = screen.getByRole("button", { name: "Ajustes" });
    await user.click(button);
    const panel = await screen.findByRole("dialog", { name: "Ajustes" });
    expect(panel).toHaveAttribute("data-drawer");
    expect(document.querySelector("[data-drawer-overlay]")).not.toBeNull();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Ajustes" })).toBeNull());
    expect(button).toHaveFocus();
    expect(screen.getByRole("button", { name: "Nueva página" })).toBeInTheDocument();
    await user.click(button);
    await user.click(within(await screen.findByRole("dialog", { name: "Ajustes" })).getByRole("button", { name: "Cerrar" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Ajustes" })).toBeNull());
  });
});

describe("cambio de idioma", () => {
  it("cambiar el idioma no saca de la pantalla de ajustes ni reabre el espacio", async () => {
    const { user } = await mount();
    await user.click(screen.getByRole("button", { name: "Ajustes" }));
    await choose(user, await screen.findByLabelText("Idioma"), "en");
    expect(await screen.findByRole("heading", { name: "Settings" })).toBeInTheDocument();
    await new Promise((r) => setTimeout(r, 200));
    expect(screen.getByRole("heading", { name: "Settings" })).toBeInTheDocument();
  });
});

describe("atajos globales", () => {
  it("el atajo de «Crear página» crea una página", async () => {
    const { user } = await mount();
    expect(screen.queryAllByRole("treeitem")).toHaveLength(0);
    await user.keyboard("{Control>}{Alt>}n{/Alt}{/Control}");
    await waitFor(() => expect(screen.getAllByRole("treeitem")).toHaveLength(1));
  });
  it("respeta un atajo reasignado", async () => {
    const prefs = new MemoryPreferences();
    saveBindings(prefs, { ...loadBindings(prefs), "page.new": "Mod+Alt+J" });
    const { user } = await mount(prefs);
    await user.keyboard("{Control>}{Alt>}n{/Alt}{/Control}");
    expect(screen.queryAllByRole("treeitem")).toHaveLength(0);
    await user.keyboard("{Control>}{Alt>}j{/Alt}{/Control}");
    await waitFor(() => expect(screen.getAllByRole("treeitem")).toHaveLength(1));
  });
  it("el atajo de tema alterna claro/oscuro", async () => {
    const { user, prefs } = await mount();
    await user.keyboard("{Control>}{Alt>}t{/Alt}{/Control}");
    await waitFor(() => expect(prefs.get("theme")).toMatch(/^(light|dark)$/));
  });
  it("no se dispara mientras se reasigna un atajo en ajustes", async () => {
    const { user } = await mount();
    await user.click(screen.getByRole("button", { name: "Ajustes" }));
    await user.click(await screen.findByRole("button", { name: "Cambiar atajo de Crear página" }));
    await user.keyboard("{Control>}{Alt>}t{/Alt}{/Control}");
    expect(screen.queryAllByRole("treeitem")).toHaveLength(0);
  });
});
