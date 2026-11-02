// T-110 (prueba primero): diseño con barra lateral y área de página.
import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithI18n } from "../../tests/renderWithI18n";
import userEvent from "@testing-library/user-event";
import { AppShell } from "./AppShell";

describe("AppShell", () => {
  it("muestra la barra lateral y el área de página con sus roles accesibles", async () => {
    await renderWithI18n(<AppShell sidebar={<p>árbol</p>}><p>contenido</p></AppShell>);
    expect(screen.getByRole("complementary", { name: /barra lateral/i })).toContainElement(screen.getByText("árbol"));
    expect(screen.getByRole("main")).toContainElement(screen.getByText("contenido"));
  });
  it("la barra lateral se puede ocultar y volver a mostrar con un botón accesible", async () => {
    await renderWithI18n(<AppShell sidebar={<p>árbol</p>}><p>contenido</p></AppShell>);
    const user = userEvent.setup();
    const toggle = screen.getByRole("button", { name: /ocultar barra lateral/i });
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    await user.click(toggle);
    expect(screen.queryByText("árbol")).not.toBeVisible();
    expect(screen.getByRole("button", { name: /mostrar barra lateral/i })).toHaveAttribute("aria-expanded", "false");
    await user.click(screen.getByRole("button", { name: /mostrar barra lateral/i }));
    expect(screen.getByText("árbol")).toBeVisible();
  });
  it("incluye un enlace para saltar al contenido (accesibilidad por teclado)", async () => {
    await renderWithI18n(<AppShell sidebar={<p>x</p>}><p>y</p></AppShell>);
    expect(screen.getByRole("link", { name: /saltar al contenido/i })).toHaveAttribute("href", "#contenido");
  });
  it("el botón de la barra lateral controla un elemento que existe (aria-controls válido)", async () => {
    await renderWithI18n(<AppShell sidebar={<p>lateral</p>}><p>contenido</p></AppShell>);
    const btn = screen.getByRole("button", { name: /barra lateral/i });
    const id = btn.getAttribute("aria-controls");
    expect(id).toBeTruthy();
    expect(document.getElementById(id!)).not.toBeNull();
  });
});
