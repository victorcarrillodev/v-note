// U-111 (RF-16.2): lo que solo existe en escritorio no aparece como control muerto en la web.
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nextProvider } from "react-i18next";
import { FakeClock, WorkspaceManager } from "@vnote/core";
import { MemoryConfigStore, MemoryWorkspaceStorage } from "../../../core/tests/support/memoryPorts";
import { createI18n } from "../i18n";
import { MemoryPreferences } from "../theme/theme";
import { App } from "./App";

async function mount(extra: Record<string, unknown>) {
  const clock = new FakeClock(1);
  const workspaces = new WorkspaceManager(new MemoryConfigStore(), new MemoryWorkspaceStorage(), clock);
  await workspaces.create({ name: "Personal" });
  const i18n = await createI18n();
  render(<I18nextProvider i18n={i18n}><App services={{ workspaces, clock, ...extra } as never} preferences={new MemoryPreferences()} /></I18nextProvider>);
  await screen.findByRole("button", { name: "Nueva página" });
}

describe("web (sin servicios de escritorio)", () => {
  it("no hay atajo global, abrir carpeta ni elegir carpeta", async () => {
    await mount({});
    await userEvent.click(screen.getByRole("button", { name: "Ajustes" }));
    await screen.findByRole("heading", { name: "Ajustes" });
    expect(screen.queryByRole("region", { name: /atajo global/i })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /Espacio activo/ }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Gestionar espacios" }));
    await screen.findByRole("button", { name: /Abrir Personal/ });
    expect(screen.queryByRole("button", { name: /Abrir carpeta/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Elegir carpeta/ })).toBeNull();
  });
});

describe("escritorio (con sus servicios)", () => {
  it("ofrece abrir la carpeta y elegir una al crear", async () => {
    await mount({ revealLocation: vi.fn(), pickFolder: vi.fn(async () => null) });
    await userEvent.click(screen.getByRole("button", { name: /Espacio activo/ }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Gestionar espacios" }));
    expect(await screen.findByRole("button", { name: /Abrir carpeta/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Elegir carpeta/ })).toBeInTheDocument();
  });
});
