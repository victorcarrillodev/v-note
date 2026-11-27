import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithI18n } from "../../tests/renderWithI18n";
import { RestoreAllPanel } from "./RestoreAllPanel";

describe("RestoreAllPanel", () => {
  it("pide confirmación, no toca nada hasta aceptar, y avisa al terminar con el resumen", async () => {
    const user = userEvent.setup();
    const restore = vi.fn(async () => ({ restored: 2, failed: [] as { name: string; message: string }[] }));
    const onDone = vi.fn();
    await renderWithI18n(<RestoreAllPanel restore={restore} onDone={onDone} onCancel={() => {}} />);
    expect(restore).not.toHaveBeenCalled();
    expect(screen.getByText(/espacios nuevos/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Restaurar" }));
    expect(restore).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("Se restauraron 2 espacios.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Listo" }));
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("muestra el error si no se pudo leer el respaldo y permite cancelar", async () => {
    const user = userEvent.setup();
    const restore = vi.fn(async () => ({ error: "El respaldo no contiene app/workspaces.json" }));
    const onCancel = vi.fn();
    await renderWithI18n(<RestoreAllPanel restore={restore} onDone={() => {}} onCancel={onCancel} />);
    await user.click(screen.getByRole("button", { name: "Restaurar" }));
    expect(await screen.findByText("El respaldo no contiene app/workspaces.json")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("informa los espacios que fallaron sin ocultar los restaurados", async () => {
    const user = userEvent.setup();
    const restore = vi.fn(async () => ({ restored: 1, failed: [{ name: "Notas", message: "dañado" }] }));
    await renderWithI18n(<RestoreAllPanel restore={restore} onDone={() => {}} onCancel={() => {}} />);
    await user.click(screen.getByRole("button", { name: "Restaurar" }));
    expect(await screen.findByText("Se restauró 1 espacio.")).toBeInTheDocument();
    expect(screen.getByText(/Notas: dañado/)).toBeInTheDocument();
  });
});
