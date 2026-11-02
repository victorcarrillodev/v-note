// T-412 (prueba primero): exportar desde la aplicación — botón en la página, diálogo y entrega por la plataforma.
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nextProvider } from "react-i18next";
import { FakeClock, MemoryAssetStore, WorkspaceManager } from "@vnote/core";
import { MemoryConfigStore, MemoryWorkspaceStorage } from "../../../core/tests/support/memoryPorts";
import { createI18n } from "../i18n";
import { MemoryPreferences } from "../theme/theme";
import { App } from "./App";

async function mount(withExporter = true) {
  const clock = new FakeClock(Date.UTC(2026, 9, 30, 14, 0));
  const workspaces = new WorkspaceManager(new MemoryConfigStore(), new MemoryWorkspaceStorage(), clock);
  await workspaces.create({ name: "Personal" });
  const i18n = await createI18n();
  const user = userEvent.setup();
  const runtime = { saveHtml: vi.fn(async () => {}), printHtml: vi.fn(async () => {}) };
  const assetsFor = vi.fn(() => new MemoryAssetStore());
  render(<I18nextProvider i18n={i18n}><App services={{ workspaces, clock, ...(withExporter ? { exporter: { assetsFor, runtime } } : {}) }} preferences={new MemoryPreferences()} /></I18nextProvider>);
  await user.click(await screen.findByRole("button", { name: "Nueva página" }));
  await screen.findByRole("textbox", { name: "Título de la página" });
  return { user, runtime, assetsFor };
}

describe("exportar desde la aplicación", () => {
  it("la página tiene un botón Exportar que abre el diálogo y entrega el HTML por la plataforma", async () => {
    const { user, runtime, assetsFor } = await mount();
    await user.type(screen.getByRole("textbox", { name: "Título de la página" }), "Mi informe{Enter}");
    await user.click(screen.getByRole("button", { name: "Exportar" }));
    const dlg = await screen.findByRole("alertdialog", { name: /exportar/i });
    expect(dlg).toBeInTheDocument();
    await user.click(screen.getAllByRole("button", { name: "Exportar" }).at(-1)!);
    await waitFor(() => expect(runtime.saveHtml).toHaveBeenCalled());
    expect((runtime.saveHtml as ReturnType<typeof vi.fn>).mock.calls[0]![0]).toBe("Mi informe.html");
    expect(assetsFor).toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
  });
  it("sin plataforma de exportación no se ofrece el botón", async () => {
    await mount(false);
    expect(screen.queryByRole("button", { name: "Exportar" })).toBeNull();
  });
});
