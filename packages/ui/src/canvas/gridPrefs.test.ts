// R-045 (prueba primero): preferencias de cuadrícula del dispositivo, compartidas por diagrama y mapa (plan 004, DP-9, §7.4).
import { describe, it, expect, beforeEach, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { GRID_PREFS_KEY, loadGridPrefs, saveGridPrefs, useGridPrefs } from "./gridPrefs";

beforeEach(() => { localStorage.clear(); });

describe("loadGridPrefs", () => {
  it("valores iniciales: mostrar y acomodar", () => { expect(loadGridPrefs()).toEqual({ show: true, snap: true }); });
  it("lee lo guardado", () => {
    localStorage.setItem(GRID_PREFS_KEY, JSON.stringify({ show: false, snap: true }));
    expect(loadGridPrefs()).toEqual({ show: false, snap: true });
  });
  it("lo dañado o incompleto cae a los valores iniciales campo por campo", () => {
    localStorage.setItem(GRID_PREFS_KEY, "no es json");
    expect(loadGridPrefs()).toEqual({ show: true, snap: true });
    localStorage.setItem(GRID_PREFS_KEY, JSON.stringify({ show: "sí", snap: false }));
    expect(loadGridPrefs()).toEqual({ show: true, snap: false });
  });
  it("sin almacenamiento disponible sigue funcionando", () => {
    const get = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("bloqueado"); });
    expect(loadGridPrefs()).toEqual({ show: true, snap: true });
    get.mockRestore();
  });
});

describe("saveGridPrefs", () => {
  it("guarda y se puede volver a leer", () => {
    saveGridPrefs({ show: false, snap: false });
    expect(loadGridPrefs()).toEqual({ show: false, snap: false });
  });
  it("si el almacenamiento falla no lanza", () => {
    const set = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("lleno"); });
    expect(() => saveGridPrefs({ show: false, snap: true })).not.toThrow();
    set.mockRestore();
  });
});

describe("useGridPrefs", () => {
  it("cambia una preferencia, la guarda y avisa a otros componentes", () => {
    const a = renderHook(() => useGridPrefs()), b = renderHook(() => useGridPrefs());
    expect(a.result.current[0]).toEqual({ show: true, snap: true });
    act(() => a.result.current[1]({ snap: false }));
    expect(a.result.current[0]).toEqual({ show: true, snap: false });
    expect(b.result.current[0]).toEqual({ show: true, snap: false });
    expect(loadGridPrefs()).toEqual({ show: true, snap: false });
  });
});
