// U-099 a U-105 (RF-10.1 a RF-10.5, RF-16, CL-18): ajustes de apariencia del dispositivo.
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithI18n } from "../../tests/renderWithI18n";
import { MemoryPreferences, type PreferenceStore } from "../theme/theme";
import { loadAppearance, saveAppearance, applyAppearance, useStorageSync } from "./appearance";
import { AppearancePanel } from "../settings/AppearancePanel";

afterEach(() => { for (const a of ["data-font", "data-density", "data-theme"]) document.documentElement.removeAttribute(a); });

describe("preferencias de apariencia (RF-10.1, RF-10.2)", () => {
  it("valores por defecto: sans y cómoda", () => {
    expect(loadAppearance(new MemoryPreferences())).toEqual({ font: "sans", density: "comfortable" });
  });
  it("guarda y lee tipografía y densidad en las preferencias del dispositivo", () => {
    const p = new MemoryPreferences();
    expect(saveAppearance(p, { font: "serif", density: "compact" })).toBe(true);
    expect(p.get("font")).toBe("serif");
    expect(p.get("density")).toBe("compact");
    expect(loadAppearance(p)).toEqual({ font: "serif", density: "compact" });
  });
  it("valores inválidos se ignoran", () => {
    const p = new MemoryPreferences(); p.set("font", "comic"); p.set("density", "x");
    expect(loadAppearance(p)).toEqual({ font: "sans", density: "comfortable" });
  });
  it("aplica los atributos al documento", () => {
    applyAppearance(document.documentElement, { font: "mono", density: "compact" });
    expect(document.documentElement.getAttribute("data-font")).toBe("mono");
    expect(document.documentElement.getAttribute("data-density")).toBe("compact");
  });
  it("no forman parte del respaldo (son del dispositivo): el respaldo no contiene sus claves", async () => {
    const { createNodeSqliteStore } = await import("../../../core/tests/support/nodeSqliteStore");
    const { migrate, migrations, serializeWorkspace } = await import("@vnote/core");
    const { MemoryAssetStore } = await import("@vnote/core");
    const db = await createNodeSqliteStore(":memory:");
    await migrate(db, migrations);
    const out = await serializeWorkspace({ store: db, assets: new MemoryAssetStore() }, { id: "w", name: "P" });
    const all = [...out.files.values()].map((b) => new TextDecoder().decode(b)).join("\n");
    expect(all).not.toMatch(/"density"|"font"|vnote:density|vnote:font/);
  });
});

describe("pantalla Apariencia (RF-10.1, RF-10.2, RF-10.5)", () => {
  it("ofrece tipografía y densidad, y al cambiar se aplica al instante y se guarda", async () => {
    const p = new MemoryPreferences();
    await renderWithI18n(<AppearancePanel preferences={p} />);
    await userEvent.click(screen.getByRole("radio", { name: "Serif" }));
    expect(document.documentElement.getAttribute("data-font")).toBe("serif");
    expect(p.get("font")).toBe("serif");
    await userEvent.click(screen.getByRole("radio", { name: "Compacta" }));
    expect(document.documentElement.getAttribute("data-density")).toBe("compact");
    expect(p.get("density")).toBe("compact");
  });
  it("al reiniciar, los ajustes guardados se conservan", async () => {
    const p = new MemoryPreferences(); saveAppearance(p, { font: "mono", density: "compact" });
    await renderWithI18n(<AppearancePanel preferences={p} />);
    expect(screen.getByRole("radio", { name: "Mono" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "Compacta" })).toHaveAttribute("aria-checked", "true");
  });
  it("la vista previa refleja la tipografía y la densidad elegidas", async () => {
    await renderWithI18n(<AppearancePanel preferences={new MemoryPreferences()} />);
    const preview = screen.getByTestId("appearance-preview");
    expect(preview).toHaveAttribute("data-font", "sans");
    await userEvent.click(screen.getByRole("radio", { name: "Mono" }));
    expect(screen.getByTestId("appearance-preview")).toHaveAttribute("data-font", "mono");
    await userEvent.click(screen.getByRole("radio", { name: "Compacta" }));
    expect(screen.getByTestId("appearance-preview")).toHaveAttribute("data-density", "compact");
  });
  it("si guardar falla: se aplica en la sesión, se avisa y «Reintentar» vuelve a guardar", async () => {
    let fail = true;
    const backing = new MemoryPreferences();
    const p: PreferenceStore = { get: (k) => backing.get(k), set: (k, v) => { if (fail) return false; backing.set(k, v); return true; } };
    await renderWithI18n(<AppearancePanel preferences={p} />);
    await userEvent.click(screen.getByRole("radio", { name: "Serif" }));
    expect(document.documentElement.getAttribute("data-font")).toBe("serif"); // se aplicó en la sesión
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/no se pudo conservar/i);
    expect(backing.get("font")).toBeNull();
    fail = false;
    await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(backing.get("font")).toBe("serif");
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("propagación a otras ventanas (RF-10.2, RF-16)", () => {
  function Sync({ p }: { p: PreferenceStore }) { useStorageSync(p); return null; }
  it("un cambio guardado desde otra ventana (evento storage) se aplica sin recargar", () => {
    const p = new MemoryPreferences();
    render(<Sync p={p} />);
    p.set("font", "serif"); p.set("density", "compact");
    act(() => { window.dispatchEvent(new StorageEvent("storage", { key: "vnote:font", newValue: "serif" })); });
    expect(document.documentElement.getAttribute("data-font")).toBe("serif");
    act(() => { window.dispatchEvent(new StorageEvent("storage", { key: "vnote:density", newValue: "compact" })); });
    expect(document.documentElement.getAttribute("data-density")).toBe("compact");
  });
  it("también el tema", () => {
    const p = new MemoryPreferences(); p.set("theme", "dark");
    render(<Sync p={p} />);
    act(() => { window.dispatchEvent(new StorageEvent("storage", { key: "vnote:theme", newValue: "dark" })); });
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });
  it("ignora claves ajenas y quita el oyente al desmontar", () => {
    const p = new MemoryPreferences();
    const spy = vi.spyOn(window, "removeEventListener");
    const { unmount } = render(<Sync p={p} />);
    act(() => { window.dispatchEvent(new StorageEvent("storage", { key: "otra", newValue: "x" })); });
    expect(document.documentElement.hasAttribute("data-font")).toBe(false);
    unmount();
    expect(spy).toHaveBeenCalledWith("storage", expect.any(Function));
    spy.mockRestore();
  });
});

describe("ventanas secundarias (U-105)", () => {
  it("SyncedAppearance aplica los ajustes guardados al abrir y reacciona a cambios de otra ventana", async () => {
    const { SyncedAppearance } = await import("./SyncedAppearance");
    const p = new MemoryPreferences(); p.set("font", "serif"); p.set("density", "compact"); p.set("theme", "dark");
    render(<SyncedAppearance preferences={p}><p>contenido</p></SyncedAppearance>);
    expect(screen.getByText("contenido")).toBeInTheDocument();
    expect(document.documentElement.getAttribute("data-font")).toBe("serif");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    p.set("font", "mono");
    act(() => { window.dispatchEvent(new StorageEvent("storage", { key: "vnote:font", newValue: "mono" })); });
    expect(document.documentElement.getAttribute("data-font")).toBe("mono");
  });
});
