// T-118 (prueba primero): crear, renombrar, cambiar y eliminar espacios (escribiendo el nombre).
import { describe, it, expect } from "vitest";
import { screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WorkspaceManager, FakeClock } from "@vnote/core";
import { MemoryConfigStore, MemoryWorkspaceStorage } from "../../../core/tests/support/memoryPorts";
import { renderWithI18n } from "../../tests/renderWithI18n";
import { WorkspaceManagerView } from "./WorkspaceManagerView";

async function setup(names: string[] = ["Personal"]) {
  const storage = new MemoryWorkspaceStorage();
  const manager = new WorkspaceManager(new MemoryConfigStore(), storage, new FakeClock(1_000));
  for (const n of names) await manager.create({ name: n });
  const opened: string[] = [];
  await renderWithI18n(<WorkspaceManagerView manager={manager} activeId={null} onOpen={(id) => opened.push(id)} />);
  return { manager, storage, opened, user: userEvent.setup() };
}

describe("WorkspaceManagerView", () => {
  it("lista los espacios existentes", async () => {
    await setup(["Personal", "Trabajo"]);
    expect(await screen.findByRole("button", { name: "Abrir Personal" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Abrir Trabajo" })).toBeInTheDocument();
  });
  it("crea un espacio y lo muestra", async () => {
    const { manager, user } = await setup([]);
    await user.type(await screen.findByRole("textbox", { name: "Nombre del espacio" }), "Casa");
    await user.click(screen.getByRole("button", { name: "Crear espacio" }));
    expect(await screen.findByRole("button", { name: "Abrir Casa" })).toBeInTheDocument();
    expect(((await manager.list()) as { value: { name: string }[] }).value.map((w) => w.name)).toEqual(["Casa"]);
  });
  it("no crea con el nombre vacío", async () => {
    const { manager, user } = await setup([]);
    await user.click(await screen.findByRole("button", { name: "Crear espacio" }));
    expect(((await manager.list()) as { value: unknown[] }).value).toEqual([]);
  });
  it("abrir un espacio avisa a quien lo usa", async () => {
    const { opened, user } = await setup(["Personal"]);
    await user.click(await screen.findByRole("button", { name: "Abrir Personal" }));
    expect(opened).toHaveLength(1);
  });
  it("renombra un espacio", async () => {
    const { user } = await setup(["Viejo"]);
    await user.click(await screen.findByRole("button", { name: "Renombrar Viejo" }));
    const input = screen.getByRole("textbox", { name: "Nuevo nombre de Viejo" });
    await user.clear(input); await user.type(input, "Nuevo{Enter}");
    expect(await screen.findByRole("button", { name: "Abrir Nuevo" })).toBeInTheDocument();
  });
  it("eliminar exige escribir el nombre exacto y avisa si no hay respaldo", async () => {
    const { manager, user } = await setup(["Mi Espacio"]);
    await user.click(await screen.findByRole("button", { name: "Eliminar espacio Mi Espacio" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(await within(dialog).findByText("Este espacio no tiene ningún respaldo exitoso.")).toBeInTheDocument();
    const confirm = within(dialog).getByRole("button", { name: "Eliminar" });
    expect(confirm).toBeDisabled();
    await user.type(within(dialog).getByRole("textbox"), "mi espacio");
    expect(confirm).toBeDisabled();
    await user.clear(within(dialog).getByRole("textbox"));
    await user.type(within(dialog).getByRole("textbox"), "Mi Espacio");
    expect(confirm).toBeEnabled();
    await user.click(confirm);
    await waitFor(async () => expect(((await manager.list()) as { value: unknown[] }).value).toEqual([]));
  });
  it("muestra la fecha del último respaldo cuando existe", async () => {
    const { manager, user } = await setup(["Con respaldo"]);
    const ws = ((await manager.list()) as { value: { id: string }[] }).value[0]!;
    const opened = await manager.open(ws.id);
    if (!opened.ok) throw new Error("no abrió");
    const store = opened.value.store;
    await store.exec("INSERT OR REPLACE INTO meta(key, value) VALUES ('last_backup_at', '1700000000000')");
    await user.click(await screen.findByRole("button", { name: "Eliminar espacio Con respaldo" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(await within(dialog).findByText(/Último respaldo:/)).toBeInTheDocument();
    expect(within(dialog).queryByText("Este espacio no tiene ningún respaldo exitoso.")).toBeNull();
  });
});

describe("ubicación de los datos (T-156, RF-25)", () => {
  it("con acceso al sistema de archivos muestra la ruta de cada espacio y un botón para abrirla", async () => {
    const { FakeClock, WorkspaceManager } = await import("@vnote/core");
    const { MemoryConfigStore, MemoryWorkspaceStorage } = await import("../../../core/tests/support/memoryPorts");
    const manager = new WorkspaceManager(new MemoryConfigStore(), new MemoryWorkspaceStorage(), new FakeClock(1));
    const w = await manager.create({ name: "Personal", location: "/home/yo/datos/personal" });
    if (!w.ok) throw new Error("x");
    const revealed: string[] = [];
    await renderWithI18n(<WorkspaceManagerView manager={manager} activeId={null} onOpen={() => {}} onRevealLocation={(l) => revealed.push(l)} />);
    expect(await screen.findByText("/home/yo/datos/personal")).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "Abrir carpeta de Personal" }));
    expect(revealed).toEqual(["/home/yo/datos/personal"]);
  });
  it("sin esa capacidad (navegador) no muestra rutas internas", async () => {
    await setup(["Personal"]);
    await screen.findByText("Personal");
    expect(screen.queryByText(/mem:\/\//)).toBeNull();
    expect(screen.queryByRole("button", { name: /Abrir carpeta/ })).toBeNull();
  });
  it("marca el espacio predeterminado para la captura rápida y permite cambiarlo (T-377)", async () => {
    const { manager, user } = await setup(["Personal", "Trabajo"]);
    expect(await screen.findByText("Predeterminado para captura rápida")).toBeInTheDocument();
    const personal = screen.getByRole("button", { name: "Usar Personal para la captura rápida" });
    const trabajo = screen.getByRole("button", { name: "Usar Trabajo para la captura rápida" });
    expect(personal).toHaveAttribute("aria-pressed", "true");
    expect(trabajo).toHaveAttribute("aria-pressed", "false");
    await user.click(trabajo);
    await waitFor(() => expect(screen.getByRole("button", { name: "Usar Trabajo para la captura rápida" })).toHaveAttribute("aria-pressed", "true"));
    expect(((await manager.captureDefault()) as { value: { name: string } }).value.name).toBe("Trabajo");
  });
});

describe("elegir carpeta al crear (T-157)", () => {
  async function withPicker(pick: () => Promise<string | null>) {
    const storage = new MemoryWorkspaceStorage();
    const manager = new WorkspaceManager(new MemoryConfigStore(), storage, new FakeClock(1_000));
    await renderWithI18n(<WorkspaceManagerView manager={manager} activeId={null} onOpen={() => {}} pickFolder={pick} />);
    return { manager, user: userEvent.setup() };
  }
  it("el espacio se crea en la carpeta elegida y se muestra cuál es", async () => {
    const { manager, user } = await withPicker(async () => "/discos/datos/casa");
    await user.type(await screen.findByRole("textbox", { name: "Nombre del espacio" }), "Casa");
    await user.click(screen.getByRole("button", { name: "Elegir carpeta…" }));
    expect(await screen.findByText("/discos/datos/casa")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Crear espacio" }));
    await screen.findByRole("button", { name: "Abrir Casa" });
    expect(((await manager.list()) as { value: { location: string }[] }).value[0]!.location).toBe("/discos/datos/casa");
  });
  it("si se cancela el diálogo, se usa la carpeta por defecto", async () => {
    const { manager, user } = await withPicker(async () => null);
    await user.type(await screen.findByRole("textbox", { name: "Nombre del espacio" }), "Casa");
    await user.click(screen.getByRole("button", { name: "Elegir carpeta…" }));
    await user.click(screen.getByRole("button", { name: "Crear espacio" }));
    await screen.findByRole("button", { name: "Abrir Casa" });
    expect(((await manager.list()) as { value: { location: string }[] }).value[0]!.location).not.toBe("");
    expect(((await manager.list()) as { value: { location: string }[] }).value[0]!.location).not.toContain("/discos");
  });
  it("sin selector (web) no se ofrece el botón", async () => {
    await setup([]);
    expect(screen.queryByRole("button", { name: "Elegir carpeta…" })).toBeNull();
  });
});
