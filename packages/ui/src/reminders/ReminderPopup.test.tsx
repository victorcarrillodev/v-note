// T-307 (prueba primero): ventana pequeña de recordatorio con Abrir, Hecho y Posponer.
import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithI18n } from "../../tests/renderWithI18n";
import { ReminderPopup } from "./ReminderPopup";
import { choose } from "../../tests/dropdown";

function setup() {
  const h = { onOpen: vi.fn(), onDone: vi.fn(), onSnooze: vi.fn(), onClose: vi.fn() };
  return { h, user: userEvent.setup(), view: renderWithI18n(<ReminderPopup title="Pagar luz" when="2026-03-05 09:00" {...h} />) };
}

describe("ReminderPopup", () => {
  it("muestra el título y la hora, como un aviso accesible", async () => {
    const { view } = setup(); await view;
    const box = screen.getByRole("alertdialog");
    expect(box).toHaveTextContent("Pagar luz");
    expect(box).toHaveTextContent("2026-03-05 09:00");
  });
  it("Abrir abre la tarea y cierra la ventana", async () => {
    const { h, user, view } = setup(); await view;
    await user.click(screen.getByRole("button", { name: "Abrir" }));
    expect(h.onOpen).toHaveBeenCalledTimes(1);
    expect(h.onClose).toHaveBeenCalled();
  });
  it("Hecho completa la tarea y cierra", async () => {
    const { h, user, view } = setup(); await view;
    await user.click(screen.getByRole("button", { name: "Hecho" }));
    expect(h.onDone).toHaveBeenCalledTimes(1);
    expect(h.onClose).toHaveBeenCalled();
  });
  it("Posponer ofrece 10 minutos, 1 hora y hasta mañana", async () => {
    const { h, user, view } = setup(); await view;
    await choose(user, screen.getByRole("combobox", { name: "Posponer…" }), "1h");
    expect(h.onSnooze).toHaveBeenCalledWith("1h");
    expect(h.onClose).toHaveBeenCalled();
  });
  it("Escape cierra sin hacer nada", async () => {
    const { h, user, view } = setup(); await view;
    await user.keyboard("{Escape}");
    expect(h.onClose).toHaveBeenCalled();
    expect(h.onDone).not.toHaveBeenCalled(); expect(h.onOpen).not.toHaveBeenCalled(); expect(h.onSnooze).not.toHaveBeenCalled();
  });
  it("una acción que falla no cierra la ventana (no se pierde el aviso)", async () => {
    const h = { onOpen: vi.fn(), onDone: vi.fn(async () => { throw new Error("x"); }), onSnooze: vi.fn(), onClose: vi.fn() };
    await renderWithI18n(<ReminderPopup title="T" when="w" {...h} />);
    await userEvent.click(screen.getByRole("button", { name: "Hecho" }));
    expect(h.onClose).not.toHaveBeenCalled();
    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });
});
