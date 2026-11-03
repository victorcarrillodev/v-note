// U-070, U-072, U-073 (RF-3.4): la cabecera del marco muestra la ruta de la página abierta y el estado de guardado.
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, act, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nextProvider } from "react-i18next";
import { FakeClock, WorkspaceManager } from "@vnote/core";
import { MemoryConfigStore, MemoryWorkspaceStorage } from "../../../core/tests/support/memoryPorts";
import { createI18n } from "../i18n";
import { MemoryPreferences } from "../theme/theme";
import { saveStatusStore } from "../layout/saveStatusStore";
import { App } from "./App";

async function mount() {
  const clock = new FakeClock(Date.UTC(2026, 9, 30, 14, 0));
  const workspaces = new WorkspaceManager(new MemoryConfigStore(), new MemoryWorkspaceStorage(), clock);
  await workspaces.create({ name: "Personal" });
  const i18n = await createI18n();
  const user = userEvent.setup();
  render(<I18nextProvider i18n={i18n}><App services={{ workspaces, clock }} preferences={new MemoryPreferences()} /></I18nextProvider>);
  await user.click(await screen.findByRole("button", { name: "Nueva página" }));
  await screen.findByRole("textbox", { name: "Título de la página" });
  return { user };
}
afterEach(() => saveStatusStore.reset());

describe("cabecera del marco", () => {
  it("muestra la ruta con la página actual (con un padre si es subpágina)", async () => {
    const { user } = await mount();
    await user.type(screen.getByRole("textbox", { name: "Título de la página" }), "Proyectos{Enter}");
    await user.click(screen.getByRole("button", { name: "Nueva subpágina" }));
    await user.type(await screen.findByRole("textbox", { name: "Título de la página" }), "Ideas{Enter}");
    const banner = screen.getByRole("banner");
    const nav = within(banner).getByRole("navigation", { name: "Ruta de la página" });
    expect(within(nav).getByRole("button", { name: "Proyectos" })).toBeInTheDocument();
    expect(within(nav).getByText("Ideas")).toHaveAttribute("aria-current", "page");
  });
  it("muestra el estado «Guardado» y reacciona a los eventos de guardado", async () => {
    await mount();
    const banner = screen.getByRole("banner");
    expect(within(banner).getByRole("status")).toHaveTextContent("Guardado");
    act(() => saveStatusStore.dispatch({ type: "edit" }));
    expect(within(banner).getByRole("status")).toHaveTextContent("Guardando…");
    act(() => saveStatusStore.dispatch({ type: "failed", message: "disco lleno" }));
    expect(within(banner).getByRole("alert")).toHaveTextContent("No se guardó");
  });
  it("«Reintentar» invoca el reintento registrado", async () => {
    const { user } = await mount();
    const retry = vi.fn();
    saveStatusStore.setRetry(retry);
    act(() => saveStatusStore.dispatch({ type: "failed", message: "x" }));
    await user.click(within(screen.getByRole("banner")).getByRole("button", { name: "Reintentar" }));
    expect(retry).toHaveBeenCalled();
  });
});

describe("el marco no cambia de lugar entre pantallas (RF-3.2, RF-3.5)", () => {
  it("al navegar a Ajustes, Papelera y de vuelta a la página, la barra lateral y la cabecera son los mismos elementos y no se mueven", async () => {
    const { user } = await mount();
    const side = screen.getByRole("complementary", { name: /barra lateral/i });
    const banner = screen.getByRole("banner");
    const rects = () => [side.className, banner.className];
    const before = rects();
    for (const name of ["Ajustes", "Papelera", "Grafo"]) {
      await user.click(screen.getByRole("button", { name }));
      expect(screen.getByRole("complementary", { name: /barra lateral/i })).toBe(side);
      expect(screen.getByRole("banner")).toBe(banner);
      expect(rects()).toEqual(before);
    }
  });
  it("el contenido de una página usa el ancho de lectura de 720 px centrado", async () => {
    await mount();
    const article = screen.getByRole("textbox", { name: "Título de la página" }).closest("article")!;
    expect(article.className).toContain("max-w-[var(--size-reading-width)]");
    expect(article.className).toContain("mx-auto");
  });
});
