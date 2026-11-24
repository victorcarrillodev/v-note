// U-076 (RF-4.1): selector de espacio con logotipo, nombre y menú (espacios, crear, gestionar).
import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FakeClock, WorkspaceManager } from "@vnote/core";
import { MemoryConfigStore, MemoryWorkspaceStorage } from "../../../core/tests/support/memoryPorts";
import { renderWithI18n } from "../../tests/renderWithI18n";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";

async function setup() {
  const manager = new WorkspaceManager(new MemoryConfigStore(), new MemoryWorkspaceStorage(), new FakeClock(1));
  const a = await manager.create({ name: "Personal" });
  await manager.create({ name: "Trabajo" });
  if (!a.ok) throw new Error("x");
  const onOpen = vi.fn(), onManage = vi.fn();
  await renderWithI18n(<WorkspaceSwitcher manager={manager} active={{ id: a.value.id, name: "Personal" }} onOpen={onOpen} onManage={onManage} />);
  return { onOpen, onManage, user: userEvent.setup() };
}

describe("WorkspaceSwitcher", () => {
  it("muestra la inicial y el nombre del espacio activo (sin el logotipo de la app)", async () => {
    await setup();
    const btn = screen.getByRole("button", { name: /Espacio activo: Personal/ });
    expect(btn).toHaveTextContent("Personal");
    expect(btn.querySelector("img[data-logo-symbol]")).toBeNull();
    const avatar = btn.querySelector("[data-workspace-avatar]");
    expect(avatar).not.toBeNull();
    expect(avatar).toHaveTextContent("P");
  });
  it("los espacios en el menú muestran su inicial con colores distintos sin repetición", async () => {
    const { user } = await setup();
    await user.click(screen.getByRole("button", { name: /Espacio activo/ }));
    const personal = await screen.findByRole("menuitem", { name: "Personal" });
    const trabajo = screen.getByRole("menuitem", { name: "Trabajo" });
    const pAvatar = personal.querySelector("[data-workspace-avatar]");
    const tAvatar = trabajo.querySelector("[data-workspace-avatar]");
    expect(pAvatar).toHaveTextContent("P");
    expect(tAvatar).toHaveTextContent("T");
    expect(pAvatar?.getAttribute("data-workspace-hue")).not.toBe(tAvatar?.getAttribute("data-workspace-hue"));
  });
  it("el menú lista todos los espacios, y «Gestionar espacios»", async () => {
    const { user } = await setup();
    await user.click(screen.getByRole("button", { name: /Espacio activo/ }));
    expect(await screen.findByRole("menuitem", { name: "Personal" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Trabajo" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Gestionar espacios" })).toBeInTheDocument();
  });
  it("elegir un espacio lo abre", async () => {
    const { user, onOpen } = await setup();
    await user.click(screen.getByRole("button", { name: /Espacio activo/ }));
    await user.click(await screen.findByRole("menuitem", { name: "Trabajo" }));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
  it("«Gestionar espacios» abre el gestor", async () => {
    const { user, onManage } = await setup();
    await user.click(screen.getByRole("button", { name: /Espacio activo/ }));
    await user.click(await screen.findByRole("menuitem", { name: "Gestionar espacios" }));
    expect(onManage).toHaveBeenCalled();
  });
  it("el espacio activo se marca con forma (marca de verificación), no solo con color", async () => {
    const { user } = await setup();
    await user.click(screen.getByRole("button", { name: /Espacio activo/ }));
    const item = await screen.findByRole("menuitem", { name: "Personal" });
    expect(item.querySelector("svg")).not.toBeNull();
  });
});
