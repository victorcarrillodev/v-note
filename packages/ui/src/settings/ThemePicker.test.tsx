// Spec 006, Fase 3 (T-051 a T-060): selector de tema con vista previa, accesible por teclado y sin dependencias de color escritas a mano.
import { describe, it, expect, beforeEach } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderWithI18n } from "../../tests/renderWithI18n";
import { ThemeProvider, MemoryPreferences, type PreferenceStore } from "../theme/theme";
import { ThemePicker, ThemeSwatch } from "./ThemePicker";
import { THEMES, colorsOf } from "../design/themes";

const root = document.documentElement;
beforeEach(() => {
  root.removeAttribute("data-theme"); root.removeAttribute("data-palette");
  (window as unknown as { matchMedia: unknown }).matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
});
const setup = async (prefs: PreferenceStore = new MemoryPreferences(), lng?: string) => ({ user: userEvent.setup(), prefs, ...(await renderWithI18n(<ThemeProvider preferences={prefs}><ThemePicker /></ThemeProvider>, lng)) });

describe("miniaturas", () => {
  it("los estilos coinciden con los colores del catálogo", async () => {
    const c = colorsOf("esmeralda");
    const { container } = await renderWithI18n(<ThemeSwatch colors={c} />);
    const sw = container.querySelector("[data-swatch=full]") as HTMLElement;
    expect(sw).toHaveStyle({ backgroundColor: c.canvas });
    expect(container.querySelector("[data-part=sidebar]")).toHaveStyle({ backgroundColor: c.sidebar });
    expect(container.querySelector("[data-part=card]")).toHaveStyle({ backgroundColor: c.card });
    expect(container.querySelector("[data-part=accent]")).toHaveStyle({ backgroundColor: c.accent });
    expect(container.querySelector("[data-part=onAccent]")).toHaveStyle({ backgroundColor: c.onAccent });
    expect(container.querySelector("[data-part=text]")).toHaveStyle({ backgroundColor: c.text });
  });
  it("el componente no escribe colores a mano", () => {
    expect(readFileSync(resolve(__dirname, "ThemePicker.tsx"), "utf8")).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
  it("«Sistema» se parte entre las miniaturas de Claro y Oscuro", async () => {
    await setup();
    const system = screen.getByRole("radio", { name: "Seguir al sistema" }).closest("label")!;
    const left = system.querySelector("[data-swatch=left]") as HTMLElement, right = system.querySelector("[data-swatch=right]") as HTMLElement;
    expect(left).toHaveStyle({ backgroundColor: colorsOf("light").canvas });
    expect(right).toHaveStyle({ backgroundColor: colorsOf("dark").canvas });
    expect(left.style.clipPath).toContain("50%");
    expect(right.style.clipPath).toContain("50%");
  });
});

describe("estructura y nombres accesibles", () => {
  it("fieldset con legend y tres grupos: Sistema (1), Temas claros (6) y Temas oscuros (6), en el orden del plan", async () => {
    await setup();
    const fs = screen.getByRole("group", { name: "Tema" });
    expect(fs.tagName).toBe("FIELDSET");
    const g = (name: string) => within(screen.getByRole("group", { name })).getAllByRole("radio").map((r) => r.getAttribute("aria-label"));
    expect(g("Sistema")).toEqual(["Seguir al sistema"]);
    expect(g("Temas claros")).toEqual(["Claro", "Océano, claro", "Bosque, claro", "Atardecer, claro", "Lavanda, claro", "Blanco y negro, claro"]);
    expect(g("Temas oscuros")).toEqual(["Oscuro", "Medianoche, oscuro", "Esmeralda, oscuro", "Rosa nocturna, oscuro", "Ámbar, oscuro", "Grafito, oscuro"]);
    expect(screen.getAllByRole("radio")).toHaveLength(13);
    expect(new Set(screen.getAllByRole("radio").map((r) => r.getAttribute("name")))).toEqual(new Set(["theme"]));
  });
  it("la opción vigente aparece marcada", async () => {
    const prefs = new MemoryPreferences(); prefs.set("theme", "oceano");
    await setup(prefs);
    expect(screen.getByRole("radio", { name: "Océano, claro" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Bosque, claro" })).not.toBeChecked();
  });
  it("en inglés los nombres también salen traducidos", async () => {
    await setup(new MemoryPreferences(), "en");
    expect(screen.getByRole("radio", { name: "Ocean, light" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Black & White, light" })).toBeInTheDocument();
  });
});

describe("uso", () => {
  it("elegir un tema se aplica al instante y muestra la marca ✓ además del borde", async () => {
    const { user, prefs } = await setup();
    expect(within(screen.getByRole("radio", { name: "Seguir al sistema" }).closest("label")!).getByTestId("theme-check")).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: "Ámbar, oscuro" }));
    expect(root.getAttribute("data-palette")).toBe("ambar");
    expect(root.getAttribute("data-theme")).toBe("dark");
    expect(prefs.get("theme")).toBe("ambar");
    const label = screen.getByRole("radio", { name: "Ámbar, oscuro" }).closest("label")!;
    expect(within(label).getByTestId("theme-check")).toBeInTheDocument();
    expect(label.className).toContain("border-[var(--c-accent)]");
    expect(screen.getAllByTestId("theme-check")).toHaveLength(1);
  });
  it("teclado: Tab entra al grupo y la flecha abajo pasa a la opción siguiente y la aplica", async () => {
    const prefs = new MemoryPreferences(); prefs.set("theme", "oceano");
    const { user } = await setup(prefs);
    await user.tab();
    expect(screen.getByRole("radio", { name: "Océano, claro" })).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("radio", { name: "Bosque, claro" })).toHaveFocus();
    expect(root.getAttribute("data-palette")).toBe("bosque");
  });
  it("si el tema no se pudo guardar avisa, y el aviso desaparece cuando se guarda bien", async () => {
    let fail = true;
    const prefs: PreferenceStore = { get: () => null, set: () => !fail };
    const { user } = await setup(prefs);
    await user.click(screen.getByRole("radio", { name: "Océano, claro" }));
    expect(await screen.findByRole("status")).toHaveTextContent("El tema no se conservará");
    fail = false;
    await user.click(screen.getByRole("radio", { name: "Bosque, claro" }));
    expect(screen.queryByRole("status")).toBeNull();
  });
  it("pantalla estrecha: rejilla auto-fill de 140 px como mínimo y tarjetas de al menos 44 px", async () => {
    await setup();
    const grid = screen.getAllByRole("radio")[0]!.closest("label")!.parentElement as HTMLElement;
    expect(grid.style.gridTemplateColumns).toBe("repeat(auto-fill, minmax(140px, 1fr))");
    for (const r of screen.getAllByRole("radio")) expect(r.closest("label")!.className).toContain("min-h-11");
  });
});

describe("accesibilidad (axe)", () => {
  async function violations(el: Element) {
    const r = await axe.run(el, { rules: { "color-contrast": { enabled: false } }, runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] } });
    return r.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.html.slice(0, 120)) }));
  }
  it.each(["oceano", "esmeralda"])("sin infracciones graves con %s elegido", async (id) => {
    const prefs = new MemoryPreferences(); prefs.set("theme", id);
    const { container } = await setup(prefs);
    expect(await violations(container)).toEqual([]);
    expect(THEMES.some((t) => t.id === id)).toBe(true);
  });
});
