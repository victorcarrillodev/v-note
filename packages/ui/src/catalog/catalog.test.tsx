// U-060 a U-064 (RF-17.1 a RF-17.3, RF-14, RNF-3): catálogo de componentes consultable y guía de estilo.
import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import axe from "axe-core";
import { renderWithI18n } from "../../tests/renderWithI18n";
import { Catalog } from "./Catalog";
import { colors, typography, radii, motion, layers, sizes } from "../design/tokens";
import { iconMap } from "../design/iconMap";

const root = resolve(__dirname, "../../../..");

describe("catálogo (RF-17.2)", () => {
  it("muestra cada token de color con su valor claro y oscuro", async () => {
    await renderWithI18n(<Catalog />);
    const sec = screen.getByRole("region", { name: "Colores" });
    for (const [name, v] of Object.entries(colors)) {
      expect(within(sec).getAllByText(name).length, name).toBeGreaterThan(0);
      expect(within(sec).getAllByText(v.light).length, `${name} claro`).toBeGreaterThan(0);
    }
  });
  it("muestra la escala tipográfica completa", async () => {
    await renderWithI18n(<Catalog />);
    const sec = screen.getByRole("region", { name: "Tipografía" });
    for (const n of Object.keys(typography)) expect(within(sec).getByText(n)).toBeInTheDocument();
  });
  it("muestra radios, movimiento, capas y tamaños", async () => {
    await renderWithI18n(<Catalog />);
    const sec = screen.getByRole("region", { name: "Espaciado, radios y capas" });
    for (const n of [...Object.keys(radii), ...Object.keys(motion), ...Object.keys(layers), ...Object.keys(sizes)]) expect(within(sec).getAllByText(n).length, n).toBeGreaterThan(0);
  });
  it("muestra todos los íconos con su significado", async () => {
    await renderWithI18n(<Catalog />);
    const sec = screen.getByRole("region", { name: "Íconos" });
    for (const n of Object.keys(iconMap)) expect(within(sec).getByText(n)).toBeInTheDocument();
  });
  it("muestra cada componente base en sus estados, en claro y en oscuro", async () => {
    const { container } = await renderWithI18n(<Catalog />);
    const sec = screen.getByRole("region", { name: "Componentes" });
    for (const comp of ["Botón", "Botón de ícono", "Campo de texto", "Área de texto", "Selector", "Casilla", "Interruptor", "Control segmentado", "Etiqueta", "Pestañas", "Tarjeta", "Progreso", "Fila de lista", "Esqueleto", "Aviso en línea", "Menú", "Popover", "Modal", "Confirmación destructiva", "Panel lateral"]) {
      expect(within(sec).getAllByText(comp).length, comp).toBeGreaterThan(0);
    }
    expect(container.querySelectorAll('[data-theme="light"]').length).toBeGreaterThan(0);
    expect(container.querySelectorAll('[data-theme="dark"]').length).toBeGreaterThan(0);
  });
  it("estados del botón: reposo, deshabilitado y carga", async () => {
    await renderWithI18n(<Catalog />);
    const sec = screen.getByRole("region", { name: "Componentes" });
    expect(within(sec).getAllByRole("button", { name: /Deshabilitado/ }).length).toBeGreaterThan(0);
    expect(within(sec).getAllByText("estado: carga").length).toBeGreaterThan(0);
  });
  it("axe: sin infracciones graves en el catálogo (sin contraste, que se mide en navegador real)", async () => {
    const { container } = await renderWithI18n(<Catalog />);
    const r = await axe.run(container, { rules: { "color-contrast": { enabled: false } }, runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] } });
    expect(r.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => ({ id: v.id, n: v.nodes.map((x) => x.html.slice(0, 90)) }))).toEqual([]);
  });
});

describe("el catálogo es solo de desarrollo (RF-17.3, DP-9)", () => {
  it("existe como entrada de desarrollo del sitio web, fuera de la lista de entradas de producción", () => {
    expect(existsSync(resolve(root, "apps/web/catalog.html"))).toBe(true);
    const cfg = readFileSync(resolve(root, "apps/web/vite.config.ts"), "utf8");
    expect(cfg).not.toMatch(/catalog/);
    expect(cfg).not.toMatch(/rollupOptions[\s\S]*input/);
  });
  it("ningún archivo de producción importa el catálogo", () => {
    for (const f of ["apps/web/src/main.tsx", "apps/desktop/src/main.tsx", "packages/ui/src/index.ts"]) expect(readFileSync(resolve(root, f), "utf8"), f).not.toMatch(/catalog/i);
  });
});

describe("guía de estilo (RF-17.1)", () => {
  const guide = readFileSync(resolve(root, "docs/design/guia-de-estilo.md"), "utf8");
  it("menciona cada token de color, nivel tipográfico, radio, movimiento, capa y tamaño", () => {
    for (const n of [...Object.keys(colors), ...Object.keys(typography), ...Object.keys(radii), ...Object.keys(motion), ...Object.keys(layers), ...Object.keys(sizes)]) expect(guide, n).toContain(`\`${n}\``);
  });
  it("documenta los ajustes respecto del mockup con su motivo", () => {
    for (const t of ["#787774", "#2383E2", "#D9730D", "#DF5452", "#4DAB9A", "4,27"]) expect(guide, t).toContain(t);
  });
  it("declara que no hay diseño para teléfono ni tableta (RF-15.5)", () => {
    expect(guide).toMatch(/No existe diseño específico para teléfono/);
  });
  it("explica cómo documentar una excepción (RF-17.4)", () => {
    expect(guide).toMatch(/## Excepciones al estándar/);
  });
});
