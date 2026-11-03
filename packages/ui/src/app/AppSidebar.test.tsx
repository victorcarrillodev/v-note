// U-083, U-085, U-086 (RF-4.1, RF-4.4, RF-4.5, RF-10.6, RF-16.3): la barra lateral de la aplicación completa.
import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nextProvider } from "react-i18next";
import { FakeClock, WorkspaceManager } from "@vnote/core";
import { MemoryConfigStore, MemoryWorkspaceStorage } from "../../../core/tests/support/memoryPorts";
import { createI18n } from "../i18n";
import { MemoryPreferences } from "../theme/theme";
import { App } from "./App";

async function mount(backup = false) {
  const clock = new FakeClock(Date.UTC(2026, 9, 30, 14, 0));
  const workspaces = new WorkspaceManager(new MemoryConfigStore(), new MemoryWorkspaceStorage(), clock);
  await workspaces.create({ name: "Personal" });
  const i18n = await createI18n();
  render(<I18nextProvider i18n={i18n}><App services={{ workspaces, clock }} preferences={new MemoryPreferences()} /></I18nextProvider>);
  await screen.findByRole("button", { name: "Nueva página" });
  void backup;
}

describe("barra lateral de la aplicación", () => {
  it("muestra el campo «Buscar» con el atajo y los accesos secundarios agrupados", async () => {
    await mount();
    const side = screen.getByRole("complementary", { name: /barra lateral/i });
    expect(within(side).getByRole("button", { name: /Buscar/ })).toHaveTextContent(/Ctrl\+K|⌘K/);
    for (const n of ["Captura rápida", "Grafo", "Ajustes", "Papelera"]) expect(within(side).getByRole("button", { name: n }), n).toBeInTheDocument();
    expect(within(side).getAllByRole("group").length).toBeGreaterThan(0);
  });
  it("el campo «Buscar» abre la paleta", async () => {
    await mount();
    await userEvent.click(screen.getByRole("button", { name: /Buscar/ }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });
  it("no hay funciones colaborativas: nada de Invitar miembros, Actualizaciones, Compartir, permisos ni cuentas", async () => {
    await mount();
    expect(document.body.textContent).not.toMatch(/invitar miembros|actualizaciones|compartir|permisos|membres[ií]as|colabor/i);
  });
  it("Ajustes no ofrece membresías ni permisos (RF-10.6)", async () => {
    await mount();
    await userEvent.click(screen.getByRole("button", { name: "Ajustes" }));
    await screen.findByRole("heading", { name: "Ajustes" });
    expect(document.body.textContent).not.toMatch(/miembros|permisos|roles|membres/i);
  });
});
