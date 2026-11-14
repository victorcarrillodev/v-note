// Pulido posterior a la spec 004 (plan §17e): marco común de las vistas secundarias (papelera, ajustes, respaldo…).
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ViewLayout, ViewSection } from "./ViewLayout";

describe("ViewLayout", () => {
  it("es una región con el nombre de la vista y un único título de nivel 1", () => {
    render(<ViewLayout title="Papelera">contenido</ViewLayout>);
    expect(screen.getByRole("region", { name: "Papelera" })).toBeTruthy();
    expect(screen.getAllByRole("heading", { level: 1 }).map((h) => h.textContent)).toEqual(["Papelera"]);
  });
  it("muestra la descripción bajo el título y las acciones en la cabecera", () => {
    render(<ViewLayout title="Papelera" description="Lo eliminado espera aquí." actions={<button type="button">Vaciar</button>}>contenido</ViewLayout>);
    const header = screen.getByRole("heading", { level: 1 }).closest("header")!;
    expect(header.textContent).toContain("Lo eliminado espera aquí.");
    expect(header.contains(screen.getByRole("button", { name: "Vaciar" }))).toBe(true);
  });
  it("la columna se centra con el ancho de lectura; «wide» la ensancha y «full» la libera", () => {
    const { rerender } = render(<ViewLayout title="A">x</ViewLayout>);
    const cls = () => screen.getByRole("region").className;
    expect(cls()).toContain("mx-auto");
    expect(cls()).toContain("max-w-[var(--size-reading-width)]");
    rerender(<ViewLayout title="A" width="wide">x</ViewLayout>);
    expect(cls()).not.toContain("max-w-[var(--size-reading-width)]");
    expect(cls()).toContain("max-w-");
    rerender(<ViewLayout title="A" width="full">x</ViewLayout>);
    expect(cls()).not.toContain("max-w-");
  });
  it("acepta atributos propios (por ejemplo un nombre accesible distinto del título)", () => {
    render(<ViewLayout title="Ajustes" aria-label="Preferencias" data-x="1">x</ViewLayout>);
    expect(screen.getByRole("region", { name: "Preferencias" }).getAttribute("data-x")).toBe("1");
  });
});

describe("ViewSection", () => {
  it("agrupa un bloque de la vista con su título de nivel 2 y una nota opcional", () => {
    render(<ViewSection title="Apariencia" hint="Cómo se ve tu contenido.">cuerpo</ViewSection>);
    expect(screen.getByRole("heading", { level: 2, name: "Apariencia" })).toBeTruthy();
    expect(screen.getByText("Cómo se ve tu contenido.")).toBeTruthy();
    expect(screen.getByText("cuerpo")).toBeTruthy();
  });
  it("sin título no deja un encabezado vacío", () => {
    render(<ViewSection>cuerpo</ViewSection>);
    expect(screen.queryByRole("heading")).toBeNull();
  });
});
