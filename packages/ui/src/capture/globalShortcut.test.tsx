// T-380, T-381, T-384 (prueba primero): registro del atajo global, aviso si no está disponible e instrucciones para un atajo del sistema.
import { describe, it, expect, vi } from "vitest";
import { renderHook, waitFor, act, screen } from "@testing-library/react";
import { ok, err, appError, type GlobalShortcutService } from "@vnote/core";
import { MemoryPreferences, ThemeProvider } from "../theme/theme";
import { loadBindings, saveBindings } from "../settings/bindingsStore";
import { SettingsView } from "../settings/SettingsView";
import { renderWithI18n } from "../../tests/renderWithI18n";
import { GlobalShortcutProvider, useGlobalShortcut } from "./globalShortcut";

const okService = () => { const set = vi.fn(async () => ok(undefined)); return { set } satisfies GlobalShortcutService; };

describe("registro del atajo global (T-380)", () => {
  it("registra el atajo de captura al arrancar, en formato nativo", async () => {
    const svc = okService();
    const { result } = renderHook(() => useGlobalShortcut(svc, new MemoryPreferences(), '"/opt/app" --capture'));
    await waitFor(() => expect(result.current?.status).toBe("active"));
    expect(svc.set).toHaveBeenCalledWith("CommandOrControl+Shift+Space");
  });
  it("vuelve a registrar al reasignar el atajo y lo quita si se deja sin atajo", async () => {
    const svc = okService();
    const prefs = new MemoryPreferences();
    const { result } = renderHook(() => useGlobalShortcut(svc, prefs, "x"));
    await waitFor(() => expect(result.current?.status).toBe("active"));
    act(() => saveBindings(prefs, { ...loadBindings(prefs), "capture.open": "Mod+Alt+C" }));
    await waitFor(() => expect(svc.set).toHaveBeenLastCalledWith("CommandOrControl+Alt+C"));
    act(() => saveBindings(prefs, { ...loadBindings(prefs), "capture.open": null }));
    await waitFor(() => expect(svc.set).toHaveBeenLastCalledWith(null));
    await waitFor(() => expect(result.current?.status).toBe("off"));
  });
  it("sin servicio (web) no hay estado", () => {
    const { result } = renderHook(() => useGlobalShortcut(undefined, new MemoryPreferences(), ""));
    expect(result.current).toBeNull();
  });
});

describe("atajo no disponible (T-381, T-384, CL-15)", () => {
  it("avisa con el motivo y conserva la orden para asignar un atajo del sistema", async () => {
    const svc: GlobalShortcutService = { set: async () => err(appError("STORAGE", "el sistema no permite registrar atajos globales")) };
    const { result } = renderHook(() => useGlobalShortcut(svc, new MemoryPreferences(), '"/opt/app" --capture'));
    await waitFor(() => expect(result.current?.status).toBe("unavailable"));
    expect(result.current).toMatchObject({ status: "unavailable", message: "el sistema no permite registrar atajos globales", command: '"/opt/app" --capture' });
  });
  it("Ajustes muestra el aviso y el texto con el comando", async () => {
    const prefs = new MemoryPreferences();
    await renderWithI18n(
      <ThemeProvider preferences={prefs}>
        <GlobalShortcutProvider value={{ status: "unavailable", message: "no permitido", command: '"/opt/app" --capture' }}>
          <SettingsView preferences={prefs} />
        </GlobalShortcutProvider>
      </ThemeProvider>,
    );
    const box = screen.getByRole("region", { name: "Atajo global de captura" });
    expect(box).toHaveTextContent("no está disponible");
    expect(box).toHaveTextContent('"/opt/app" --capture');
    expect(box).toHaveTextContent("la captura sigue disponible");
  });
  it("Ajustes muestra el atajo activo sin instrucciones", async () => {
    const prefs = new MemoryPreferences();
    await renderWithI18n(
      <ThemeProvider preferences={prefs}>
        <GlobalShortcutProvider value={{ status: "active", command: "x" }}><SettingsView preferences={prefs} /></GlobalShortcutProvider>
      </ThemeProvider>,
    );
    const box = screen.getByRole("region", { name: "Atajo global de captura" });
    expect(box).toHaveTextContent("activo");
    expect(box).not.toHaveTextContent("--capture");
  });
});
