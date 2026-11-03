// U-110 (RF-12.2, RF-13.4): primera apertura sin espacios.
import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { brand } from "@vnote/core";
import { renderWithI18n } from "../../tests/renderWithI18n";
import { WelcomeScreen } from "./WelcomeScreen";

describe("WelcomeScreen", () => {
  it("muestra el logotipo, una frase de presentación y las dos acciones", async () => {
    const { container } = await renderWithI18n(<WelcomeScreen onCreate={() => {}} onRestore={() => {}} />);
    expect(container.querySelector("[data-logo-symbol]")).not.toBeNull();
    expect(screen.getByText(brand.name)).toBeInTheDocument();
    expect(screen.getByText(/Escribe, organiza y planea/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Crear espacio" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Restaurar desde GitHub" })).toBeInTheDocument();
  });
  it("«Crear espacio» es la acción principal (única en estilo primario)", async () => {
    await renderWithI18n(<WelcomeScreen onCreate={() => {}} onRestore={() => {}} />);
    expect(screen.getByRole("button", { name: "Crear espacio" }).className).toContain("bg-[var(--c-accent)]");
    expect(screen.getByRole("button", { name: "Restaurar desde GitHub" }).className).not.toContain("bg-[var(--c-accent)]");
  });
  it("pide un nombre y crea el espacio con él", async () => {
    const onCreate = vi.fn();
    await renderWithI18n(<WelcomeScreen onCreate={onCreate} onRestore={() => {}} />);
    await userEvent.type(screen.getByRole("textbox", { name: "Nombre del espacio" }), "Personal");
    await userEvent.click(screen.getByRole("button", { name: "Crear espacio" }));
    expect(onCreate).toHaveBeenCalledWith("Personal");
  });
  it("sin nombre no crea y avisa en el campo", async () => {
    const onCreate = vi.fn();
    await renderWithI18n(<WelcomeScreen onCreate={onCreate} onRestore={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: "Crear espacio" }));
    expect(onCreate).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
  it("sin respaldo disponible (web sin respaldo) no ofrece restaurar", async () => {
    await renderWithI18n(<WelcomeScreen onCreate={() => {}} />);
    expect(screen.queryByRole("button", { name: /Restaurar/ })).toBeNull();
  });
  it("«Restaurar» llama a su acción", async () => {
    const onRestore = vi.fn();
    await renderWithI18n(<WelcomeScreen onCreate={() => {}} onRestore={onRestore} />);
    await userEvent.click(screen.getByRole("button", { name: "Restaurar desde GitHub" }));
    expect(onRestore).toHaveBeenCalled();
  });
});
