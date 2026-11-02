// T-141, T-142 (prueba primero): catálogo de acciones con atajos por defecto, reasignables, y detección de conflictos (RF-20).
import { describe, it, expect } from "vitest";
import { ACTIONS, defaultBindings, effectiveBindings, findConflicts, normalizeCombo, setBinding, comboFromEvent } from "./shortcuts";

describe("catálogo de acciones (T-141)", () => {
  it("cada acción tiene id único, texto de interfaz y un atajo por defecto válido", () => {
    const ids = ACTIONS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const a of ACTIONS) {
      expect(a.labelKey).toMatch(/^[a-z]+\.[A-Za-z]+/);
      expect(a.defaultCombo).toBe(normalizeCombo(a.defaultCombo));
    }
  });
  it("incluye las acciones mínimas: paleta, nueva página, captura rápida, buscar, cambiar tema", () => {
    const ids = ACTIONS.map((a) => a.id);
    for (const id of ["palette.open", "page.new", "capture.open", "theme.toggle", "sidebar.toggle"]) expect(ids).toContain(id);
  });
  it("los atajos por defecto no chocan entre sí", () => {
    expect(findConflicts(defaultBindings())).toEqual([]);
  });
});

describe("normalización", () => {
  it("ordena modificadores y unifica Cmd/Ctrl como Mod", () => {
    expect(normalizeCombo("k+ctrl")).toBe("Mod+K");
    expect(normalizeCombo("Shift+Cmd+n")).toBe("Mod+Shift+N");
    expect(normalizeCombo("alt+shift+ctrl+x")).toBe("Mod+Alt+Shift+X");
  });
  it("traduce un evento de teclado", () => {
    expect(comboFromEvent({ key: "k", ctrlKey: true, metaKey: false, altKey: false, shiftKey: false })).toBe("Mod+K");
    expect(comboFromEvent({ key: "N", ctrlKey: false, metaKey: true, altKey: false, shiftKey: true })).toBe("Mod+Shift+N");
    expect(comboFromEvent({ key: "Control", ctrlKey: true, metaKey: false, altKey: false, shiftKey: false })).toBeNull();
  });
});

describe("conflictos y reasignación (T-142)", () => {
  it("detecta dos acciones con el mismo atajo", () => {
    const b = { ...defaultBindings(), "page.new": "Mod+K" };
    const c = findConflicts(b);
    expect(c).toHaveLength(1);
    expect(c[0]!.combo).toBe("Mod+K");
    expect(c[0]!.actions.sort()).toEqual(["page.new", "palette.open"]);
  });
  it("setBinding rechaza el choque, indicando con qué acción, y no cambia nada", () => {
    const b = defaultBindings();
    const r = setBinding(b, "page.new", "ctrl+k");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.conflictsWith).toEqual(["palette.open"]);
    expect(b["page.new"]).toBe(defaultBindings()["page.new"]);
  });
  it("setBinding acepta un atajo libre y lo normaliza", () => {
    const r = setBinding(defaultBindings(), "page.new", "ctrl+alt+j");
    expect(r.ok && r.bindings["page.new"]).toBe("Mod+Alt+J");
  });
  it("con quitar la otra, el atajo pasa a la acción elegida y la otra queda sin atajo (RF-20)", () => {
    const r = setBinding(defaultBindings(), "page.new", "Mod+K", { takeFromOthers: true });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.bindings["page.new"]).toBe("Mod+K");
      expect(r.bindings["palette.open"]).toBeNull();
      expect(findConflicts(r.bindings)).toEqual([]);
    }
  });
  it("las acciones sin atajo no cuentan como conflicto entre sí", () => {
    expect(findConflicts({ ...defaultBindings(), "page.new": null, "palette.open": null })).toEqual([]);
  });
  it("incluye deshacer y rehacer", () => {
    const ids = ACTIONS.map((a) => a.id);
    expect(ids).toContain("edit.undo");
    expect(ids).toContain("edit.redo");
  });
  it("las personalizaciones guardadas se mezclan con las de fábrica e ignoran acciones desconocidas", () => {
    const e = effectiveBindings({ "page.new": "Mod+Alt+J", "no.existe": "Mod+Z" });
    expect(e["page.new"]).toBe("Mod+Alt+J");
    expect(e["palette.open"]).toBe(defaultBindings()["palette.open"]);
    expect("no.existe" in e).toBe(false);
  });
});
