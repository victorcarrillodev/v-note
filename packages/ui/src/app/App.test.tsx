// T-104/T-105 (prueba primero): la aplicación compuesta funciona de punta a punta con puertos en memoria.
import { describe, it, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nextProvider } from "react-i18next";
import { FakeClock, WorkspaceManager } from "@vnote/core";
import { MemoryConfigStore, MemoryWorkspaceStorage } from "../../../core/tests/support/memoryPorts";
import { createI18n } from "../i18n";
import { MemoryPreferences } from "../theme/theme";
import { App } from "./App";

async function mount(opts: { existing?: string[]; lng?: string } = {}) {
  const clock = new FakeClock(1_000);
  const workspaces = new WorkspaceManager(new MemoryConfigStore(), new MemoryWorkspaceStorage(), clock);
  for (const n of opts.existing ?? []) await workspaces.create({ name: n });
  const i18n = await createI18n(opts.lng);
  const user = userEvent.setup();
  render(
    <I18nextProvider i18n={i18n}>
      <App services={{ workspaces, clock }} preferences={new MemoryPreferences()} renderPageBody={(id) => <p data-testid="body">cuerpo de {id.slice(0, 4)}</p>} />
    </I18nextProvider>,
  );
  return { workspaces, user, clock };
}

describe("App", () => {
  it("primer inicio sin espacios: ofrece crear el primero", async () => {
    const { user } = await mount();
    // La pantalla de bienvenida (spec 002, RF-12.2) sustituye al gestor de espacios en el primer inicio.
    expect(await screen.findByRole("heading", { name: "Tu cuaderno de notas, solo tuyo" })).toBeInTheDocument();
    await user.type(screen.getByRole("textbox", { name: "Nombre del espacio" }), "Personal");
    await user.click(screen.getByRole("button", { name: "Crear espacio" }));
    // al crear el primero se abre solo: aparece la barra lateral con su mensaje de vacío
    expect(await screen.findByText(/aún no hay páginas/i)).toBeInTheDocument();
  });
  it("con un espacio existente lo abre directamente", async () => {
    await mount({ existing: ["Personal"] });
    expect(await screen.findByRole("complementary", { name: "Barra lateral" })).toBeInTheDocument();
    expect(await screen.findByText(/aún no hay páginas/i)).toBeInTheDocument();
  });
  it("crear una página abre su encabezado y el cuerpo inyectado por el cascarón", async () => {
    const { user } = await mount({ existing: ["Personal"] });
    await user.click(await screen.findByRole("button", { name: "Nueva página" }));
    expect(await screen.findByRole("textbox", { name: "Título de la página" })).toBeInTheDocument();
    expect(await screen.findByTestId("body")).toHaveTextContent(/cuerpo de/);
  });
  it("sin página abierta el área principal queda vacía de contenido", async () => {
    await mount({ existing: ["Personal"] });
    await screen.findByText(/aún no hay páginas/i);
    expect(screen.queryByRole("textbox", { name: "Título de la página" })).toBeNull();
  });
  it("sin página abierta el área principal invita a elegir o crear una página, y su botón crea y abre una", async () => {
    const { user } = await mount({ existing: ["Personal"] });
    expect(await screen.findByRole("heading", { name: "Ninguna página abierta" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Crear página" }));
    expect(await screen.findByRole("textbox", { name: "Título de la página" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Ninguna página abierta" })).toBeNull();
  });
  it("navega a la papelera y de vuelta", async () => {
    const { user } = await mount({ existing: ["Personal"] });
    await user.click(await screen.findByRole("button", { name: "Papelera" }));
    expect(await screen.findByText("La papelera está vacía.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Nueva página" }));
    expect(await screen.findByRole("textbox", { name: "Título de la página" })).toBeInTheDocument();
  });
  it("un botón lleva a la gestión de espacios y se puede cambiar de espacio", async () => {
    const { user } = await mount({ existing: ["Personal", "Trabajo"] });
    await user.click(await screen.findByRole("button", { name: /Espacio activo/ }));
    await user.click(await screen.findByRole("menuitem", { name: "Gestionar espacios" }));
    await user.click(await screen.findByRole("button", { name: "Abrir Trabajo" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Espacio activo: Trabajo" })).toBeInTheDocument());
  });
  it("si un espacio no se puede abrir muestra el error sin quedarse en blanco", async () => {
    const clock = new FakeClock(1);
    const storage = new MemoryWorkspaceStorage();
    const workspaces = new WorkspaceManager(new MemoryConfigStore(), storage, clock);
    const w = await workspaces.create({ name: "Externo", location: "/mnt/usb/x" });
    storage.missing.add("/mnt/usb/x");
    const fresh = new WorkspaceManager((workspaces as unknown as { config: MemoryConfigStore }).config, storage, clock);
    const i18n = await createI18n();
    render(<I18nextProvider i18n={i18n}><App services={{ workspaces: fresh, clock }} preferences={new MemoryPreferences()} /></I18nextProvider>);
    expect(await screen.findByRole("alert")).toHaveTextContent("La ubicación de datos de este espacio no está disponible");
    expect(w.ok).toBe(true);
    expect(screen.getByRole("heading", { name: "Espacios de trabajo" })).toBeInTheDocument();
  });
});
