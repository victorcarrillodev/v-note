// T-290, T-309, T-310 (prueba primero): casilla con fecha límite, recordatorio y repetición.
import { describe, it, expect, vi } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithI18n } from "../../tests/renderWithI18n";
import { TaskBlockView, type TaskProps } from "./TaskBlock";

const base: TaskProps = { checked: false, due: "", remindAt: "", recurrence: "" };
async function setup(props: Partial<TaskProps> = {}, now = "2026-03-05T10:00") {
  const onChange = vi.fn();
  await renderWithI18n(<TaskBlockView props={{ ...base, ...props }} onChange={onChange} now={now} content={<span>Pagar luz</span>} />);
  return { onChange, user: userEvent.setup() };
}

describe("casilla (T-290)", () => {
  it("marcar y desmarcar la casilla", async () => {
    const { onChange, user } = await setup();
    await user.click(screen.getByRole("checkbox", { name: "Hecha" }));
    expect(onChange).toHaveBeenCalledWith({ checked: true });
  });
  it("fijar la fecha límite", async () => {
    const { onChange } = await setup();
    fireEvent.change(screen.getByLabelText("Fecha límite"), { target: { value: "2026-03-10" } });
    expect(onChange).toHaveBeenCalledWith({ due: "2026-03-10" });
  });
  it("quitar la fecha límite la deja vacía", async () => {
    const { onChange } = await setup({ due: "2026-03-10" });
    fireEvent.change(screen.getByLabelText("Fecha límite"), { target: { value: "" } });
    expect(onChange).toHaveBeenCalledWith({ due: "" });
  });
});

describe("recordatorio (T-309)", () => {
  it("fijar la fecha y hora del recordatorio", async () => {
    const { onChange } = await setup({ due: "2026-03-10" });
    fireEvent.change(screen.getByLabelText("Recordatorio"), { target: { value: "2026-03-09T08:30" } });
    expect(onChange).toHaveBeenCalledWith({ remindAt: "2026-03-09T08:30" });
  });
  it("si la hora del recordatorio ya pasó, avisa que quedará como vencido y ofrece cambiar la fecha (CL-11)", async () => {
    await setup({ remindAt: "2026-03-04T09:00" });
    expect(screen.getByRole("note")).toHaveTextContent(/ya pasó/i);
    expect(screen.getByRole("note")).toHaveTextContent(/vencido/i);
  });
  it("un recordatorio futuro no muestra aviso", async () => {
    await setup({ remindAt: "2026-03-06T09:00" });
    expect(screen.queryByRole("note")).toBeNull();
  });
});

describe("repetición (T-310)", () => {
  it("ofrece ninguna, diaria, semanal, mensual y anual", async () => {
    await setup({ due: "2026-03-10" });
    const opts = [...screen.getByLabelText("Repetir").querySelectorAll("option")].map((o) => o.textContent);
    expect(opts).toEqual(["No se repite", "Cada día", "Cada semana", "Cada mes", "Cada año"]);
  });
  it("elegir una frecuencia la guarda como JSON; «No se repite» la quita", async () => {
    const { onChange, user } = await setup({ due: "2026-03-10" });
    await user.selectOptions(screen.getByLabelText("Repetir"), "weekly");
    expect(onChange).toHaveBeenLastCalledWith({ recurrence: JSON.stringify({ freq: "weekly", interval: 1 }) });
    await user.selectOptions(screen.getByLabelText("Repetir"), "");
    expect(onChange).toHaveBeenLastCalledWith({ recurrence: "" });
  });
  it("muestra la frecuencia guardada", async () => {
    await setup({ due: "2026-03-10", recurrence: JSON.stringify({ freq: "monthly", interval: 1 }) });
    expect(screen.getByLabelText("Repetir")).toHaveValue("monthly");
  });
  it("marcar una tarea que se repite NO la cierra: programa la siguiente repetición desde la fecha original (CL-32)", async () => {
    const { onChange, user } = await setup({ due: "2026-03-07", remindAt: "2026-03-07T09:00", recurrence: JSON.stringify({ freq: "daily", interval: 1 }) });
    await user.click(screen.getByRole("checkbox", { name: "Hecha" }));
    expect(onChange).toHaveBeenCalledWith({ due: "2026-03-08", remindAt: "2026-03-08T09:00", recurrence: JSON.stringify({ freq: "daily", interval: 1, anchor: "2026-03-07T09:00" }) });
  });
  it("una tarea que se repite pero ya está marcada se puede desmarcar", async () => {
    const { onChange, user } = await setup({ checked: true, due: "2026-03-07", recurrence: JSON.stringify({ freq: "daily", interval: 1 }) });
    await user.click(screen.getByRole("checkbox", { name: "Hecha" }));
    expect(onChange).toHaveBeenCalledWith({ checked: false });
  });
});
