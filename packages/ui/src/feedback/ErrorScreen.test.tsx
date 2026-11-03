// U-141 (RF-11.8): la pantalla de error global nunca queda en blanco: causa en lenguaje claro y opciones de recuperación.
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ErrorScreen, AppErrorBoundary } from "./ErrorScreen";
import { renderWithI18n } from "../../tests/renderWithI18n";

describe("ErrorScreen (RF-11.8)", () => {
  it("muestra causa y opciones de reintentar y volver", async () => {
    const retry = vi.fn(); const back = vi.fn();
    await renderWithI18n(<ErrorScreen cause="El disco no está disponible" onRetry={retry} onBack={back} />);
    expect(screen.getByRole("alert")).toHaveTextContent("El disco no está disponible");
    await userEvent.click(screen.getByRole("button", { name: /reintentar/i }));
    await userEvent.click(screen.getByRole("button", { name: /espacios/i }));
    expect(retry).toHaveBeenCalled(); expect(back).toHaveBeenCalled();
  });
  it("un fallo al dibujar muestra la pantalla en lugar de dejar la ventana en blanco", async () => {
    const Boom = () => { throw new Error("kaboom"); };
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    await renderWithI18n(<AppErrorBoundary><Boom /></AppErrorBoundary>);
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.getByRole("button", { name: /reintentar/i })).toBeTruthy();
    spy.mockRestore();
  });
});
