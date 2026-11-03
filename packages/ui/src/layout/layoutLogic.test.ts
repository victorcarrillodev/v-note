// U-071, U-072, U-074, U-078, U-079, U-090, U-113 (RF-3.4, RF-15, RF-13.2, RF-16.3, CL-1, CL-7): lógica pura del marco, sin DOM.
import { describe, it, expect } from "vitest";
import { truncateBreadcrumbs } from "./breadcrumbs";
import { saveStatusReducer, type SaveStatus } from "./saveStatus";
import { layoutMode, sidebarMode } from "./layoutMode";
import { treeIndent } from "./treeIndent";
import { monogram } from "./monogram";
import { formatCombo, toAriaShortcut } from "./formatCombo";

describe("migas de pan con truncado desde el medio (CL-1)", () => {
  const items = (n: number) => Array.from({ length: n }, (_, i) => ({ id: String(i), title: `N${i}` }));
  it("si caben todas, no se truncan", () => {
    expect(truncateBreadcrumbs(items(3), 4).map((x) => x.kind)).toEqual(["item", "item", "item"]);
  });
  it("con 8 niveles y máximo 4 muestra inicio, «…» y los dos últimos", () => {
    const r = truncateBreadcrumbs(items(8), 4);
    expect(r.map((x) => (x.kind === "item" ? x.item.title : "…"))).toEqual(["N0", "…", "N6", "N7"]);
  });
  it("el «…» lleva las migas ocultas para ofrecerlas en un menú", () => {
    const r = truncateBreadcrumbs(items(8), 4);
    const gap = r.find((x) => x.kind === "gap");
    expect(gap && gap.kind === "gap" && gap.hidden.map((h) => h.title)).toEqual(["N1", "N2", "N3", "N4", "N5"]);
  });
  it("siempre conserva la página actual (la última)", () => {
    for (const n of [5, 12, 100]) { const r = truncateBreadcrumbs(items(n), 3); const last = r.at(-1)!; expect(last.kind === "item" && last.item.id).toBe(String(n - 1)); }
  });
  it("lista vacía o un solo elemento", () => {
    expect(truncateBreadcrumbs([], 4)).toEqual([]);
    expect(truncateBreadcrumbs(items(1), 1)).toHaveLength(1);
  });
});

describe("estado de guardado (RF-3.4)", () => {
  const step = (s: SaveStatus, ...events: Parameters<typeof saveStatusReducer>[1][]) => events.reduce(saveStatusReducer, s);
  it("editar pasa a «guardando» y al confirmar a «guardado»", () => {
    expect(step({ kind: "saved" }, { type: "edit" })).toEqual({ kind: "saving" });
    expect(step({ kind: "saved" }, { type: "edit" }, { type: "saved" })).toEqual({ kind: "saved" });
  });
  it("un fallo deja el error persistente con su mensaje", () => {
    expect(step({ kind: "saving" }, { type: "failed", message: "disco lleno" })).toEqual({ kind: "error", message: "disco lleno" });
  });
  it("seguir editando con error no lo oculta: sigue en error hasta que se guarde", () => {
    const s = step({ kind: "error", message: "x" }, { type: "edit" });
    expect(s.kind).toBe("error");
  });
  it("reintentar pasa a «guardando» y al guardar sale del error", () => {
    expect(step({ kind: "error", message: "x" }, { type: "retry" })).toEqual({ kind: "saving" });
    expect(step({ kind: "error", message: "x" }, { type: "retry" }, { type: "saved" })).toEqual({ kind: "saved" });
  });
  it("«saved» sin edición previa es idempotente", () => {
    expect(step({ kind: "saved" }, { type: "saved" })).toEqual({ kind: "saved" });
  });
});

describe("modos según el ancho de ventana (RF-15)", () => {
  it.each([[1600, "wide"], [1280, "wide"], [1279, "normal"], [1040, "normal"], [1039, "narrow"], [900, "narrow"], [899, "scroll"], [320, "scroll"]] as const)("%i px → %s", (w, m) => { expect(layoutMode(w)).toBe(m); });
  it("la barra lateral se pliega sola por debajo de 1 040 px y se superpone", () => {
    expect(sidebarMode(1100)).toBe("docked");
    expect(sidebarMode(1039)).toBe("overlay");
    expect(sidebarMode(700)).toBe("overlay");
  });
  it("no existen puntos de corte por debajo de 900 px (sin diseño de teléfono)", () => {
    expect(layoutMode(500)).toBe("scroll");
    expect(layoutMode(300)).toBe("scroll");
  });
});

describe("sangría del árbol con tope (CL-7)", () => {
  it("16 px por nivel hasta 6 niveles", () => {
    expect([0, 1, 3, 6].map(treeIndent)).toEqual([0, 16, 48, 96]);
  });
  it("10 niveles sangran como 6", () => { expect(treeIndent(10)).toBe(treeIndent(6)); expect(treeIndent(1000)).toBe(96); });
});

describe("monograma del nombre (RF-13.2, CL-26)", () => {
  it("toma la inicial en mayúscula del nombre configurado", () => {
    expect(monogram("libreta-x")).toBe("L");
    expect(monogram("  atelier")).toBe("A");
  });
  it("respeta caracteres de varios bytes y no rompe con vacío", () => {
    expect(monogram("ñandú")).toBe("Ñ");
    expect(monogram("🌿 verde")).toBe("🌿");
    expect(monogram("")).toBe("•");
  });
  it("cambiar el nombre cambia el monograma", () => { expect(monogram("Uno")).not.toBe(monogram("Zeta")); });
});

describe("atajos según la plataforma (RF-16.3)", () => {
  it("en macOS Mod se muestra como ⌘ y Alt como ⌥", () => {
    expect(formatCombo("Mod+K", "mac")).toBe("⌘K");
    expect(formatCombo("Mod+Alt+N", "mac")).toBe("⌘⌥N");
    expect(formatCombo("Mod+Shift+Space", "mac")).toBe("⌘⇧Espacio");
  });
  it("en el resto Mod se muestra como Ctrl", () => {
    expect(formatCombo("Mod+K", "other")).toBe("Ctrl+K");
    expect(formatCombo("Mod+Shift+F", "other")).toBe("Ctrl+Mayús+F");
  });
  it("sin atajo devuelve vacío", () => { expect(formatCombo(null, "mac")).toBe(""); });
});

describe("atajos para tecnologías de apoyo (aria-keyshortcuts)", () => {
  it("usa los nombres de modificadores de ARIA: Control, Alt, Shift, Meta", () => {
    expect(toAriaShortcut("Mod+Alt+N", "other")).toBe("Control+Alt+N");
    expect(toAriaShortcut("Mod+Shift+Space", "other")).toBe("Control+Shift+Space");
    expect(toAriaShortcut("Mod+K", "mac")).toBe("Meta+K");
  });
  it("sin atajo devuelve vacío", () => { expect(toAriaShortcut(null, "other")).toBe(""); });
});
