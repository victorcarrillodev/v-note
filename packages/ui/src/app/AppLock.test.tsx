// T-151 (prueba primero): si otra ventana ya edita el espacio, esta avisa y no permite editar; se puede reintentar (CL-22).
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nextProvider } from "react-i18next";
import { FakeClock, WorkspaceManager, type InstanceLock, type InstanceLockHandle } from "@vnote/core";
import { MemoryConfigStore, MemoryWorkspaceStorage } from "../../../core/tests/support/memoryPorts";
import { createI18n } from "../i18n";
import { MemoryPreferences } from "../theme/theme";
import { App } from "./App";

class FakeLock implements InstanceLock {
  held = new Set<string>();
  externallyHeld = new Set<string>();
  async acquire(name: string): Promise<InstanceLockHandle | null> {
    if (this.externallyHeld.has(name) || this.held.has(name)) return null;
    this.held.add(name);
    return { release: async () => { this.held.delete(name); } };
  }
}

async function mount(lock: FakeLock, locked: boolean) {
  const clock = new FakeClock(1_000);
  const workspaces = new WorkspaceManager(new MemoryConfigStore(), new MemoryWorkspaceStorage(), clock);
  const w = await workspaces.create({ name: "Personal" });
  if (!w.ok) throw new Error("x");
  if (locked) lock.externallyHeld.add(`workspace:${w.value.id}`);
  const i18n = await createI18n();
  render(<I18nextProvider i18n={i18n}><App services={{ workspaces, clock, instanceLock: lock }} preferences={new MemoryPreferences()} /></I18nextProvider>);
  return { user: userEvent.setup(), id: w.value.id };
}

describe("un solo editor por espacio (T-151, CL-22)", () => {
  it("si nadie más lo tiene, se abre y se puede editar", async () => {
    const lock = new FakeLock();
    await mount(lock, false);
    expect(await screen.findByRole("button", { name: "Nueva página" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });
  it("si otra ventana lo está editando, avisa y no ofrece editar", async () => {
    await mount(new FakeLock(), true);
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/otra ventana/i);
    expect(alert.querySelector("svg")).not.toBeNull(); // U-139: aviso unificado con ícono de gravedad
    expect(screen.queryByRole("button", { name: "Nueva página" })).toBeNull();
  });
  it("«Reintentar» abre el espacio cuando la otra ventana lo libera", async () => {
    const lock = new FakeLock();
    const { user, id } = await mount(lock, true);
    await screen.findByRole("alert");
    lock.externallyHeld.delete(`workspace:${id}`);
    await user.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByRole("button", { name: "Nueva página" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });
  it("sin bloqueo disponible (escritorio) abre normalmente", async () => {
    const clock = new FakeClock(1_000);
    const workspaces = new WorkspaceManager(new MemoryConfigStore(), new MemoryWorkspaceStorage(), clock);
    await workspaces.create({ name: "Personal" });
    const i18n = await createI18n();
    render(<I18nextProvider i18n={i18n}><App services={{ workspaces, clock }} preferences={new MemoryPreferences()} /></I18nextProvider>);
    expect(await screen.findByRole("button", { name: "Nueva página" })).toBeInTheDocument();
  });
});
