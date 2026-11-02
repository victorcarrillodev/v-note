// Bases de datos y tableros dentro de la aplicación (RF-8, RF-22): crear desde la barra lateral y abrir según el tipo de página.
import { describe, it, expect } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nextProvider } from "react-i18next";
import { FakeClock, WorkspaceManager } from "@vnote/core";
import { MemoryConfigStore, MemoryWorkspaceStorage } from "../../../core/tests/support/memoryPorts";
import { createI18n } from "../i18n";
import { MemoryPreferences } from "../theme/theme";
import { App } from "./App";

async function mount() {
  const clock = new FakeClock(Date.UTC(2026, 2, 5, 12));
  const workspaces = new WorkspaceManager(new MemoryConfigStore(), new MemoryWorkspaceStorage(), clock);
  await workspaces.create({ name: "Personal" });
  const i18n = await createI18n();
  const user = userEvent.setup();
  render(<I18nextProvider i18n={i18n}><App services={{ workspaces, clock }} preferences={new MemoryPreferences()} renderPageBody={(id) => <div data-testid="editor">{id}</div>} /></I18nextProvider>);
  await screen.findByRole("button", { name: "Nueva página" });
  return { user };
}

describe("bases de datos en la aplicación", () => {
  it("«Nueva base de datos» crea una página de base de datos y la abre con su tabla", async () => {
    const { user } = await mount();
    await user.click(screen.getByRole("button", { name: "Nueva base de datos" }));
    expect(await screen.findByRole("button", { name: "Nueva fila" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Tabla", selected: true })).toBeInTheDocument();
    expect(screen.queryByTestId("editor")).toBeNull(); // la página de una base no usa el editor de texto
  });
  it("una fila de la base se abre como página completa con el editor", async () => {
    const { user } = await mount();
    await user.click(screen.getByRole("button", { name: "Nueva base de datos" }));
    await user.click(await screen.findByRole("button", { name: "Nueva fila" }));
    await user.click(await screen.findByRole("button", { name: /^Abrir / }));
    expect(await screen.findByTestId("editor")).toBeInTheDocument();
  });
  it("«Nuevo tablero» crea un tablero con sus tres columnas", async () => {
    const { user } = await mount();
    await user.click(screen.getByRole("button", { name: "Nuevo tablero" }));
    for (const n of ["Por hacer", "En curso", "Hecho"]) expect(await screen.findByRole("group", { name: n })).toBeInTheDocument();
  });
  it("crear una tarjeta y abrirla muestra su página con el editor completo (T-286)", async () => {
    const { user } = await mount();
    await user.click(screen.getByRole("button", { name: "Nuevo tablero" }));
    const col = await screen.findByRole("group", { name: "Por hacer" });
    await user.click(within(col).getByRole("button", { name: "Nueva tarjeta" }));
    await user.type(within(col).getByLabelText("Título de la nueva tarjeta"), "Mi tarjeta{Enter}");
    await user.click(await screen.findByRole("button", { name: "Abrir Mi tarjeta" }));
    expect(await screen.findByTestId("editor")).toBeInTheDocument();
    expect(screen.getByLabelText("Título de la página")).toHaveValue("Mi tarjeta");
  });
  it("las bases aparecen en el árbol y al volver a seleccionarlas se reabren", async () => {
    const { user } = await mount();
    await user.click(screen.getByRole("button", { name: "Nueva base de datos" }));
    await screen.findByRole("button", { name: "Nueva fila" });
    await user.click(screen.getByRole("button", { name: "Nueva página" }));
    await waitFor(() => expect(screen.getByTestId("editor")).toBeInTheDocument());
    const items = screen.getAllByRole("treeitem");
    await user.click(items[0]!);
    expect(await screen.findByRole("button", { name: "Nueva fila" })).toBeInTheDocument();
  });
});
