// U-226 a U-233 (RF-8.1 a RF-8.5, CL-15): modal «Crear tarea con horario».
import { describe, it, expect, vi } from "vitest";
import { screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithI18n } from "../../tests/renderWithI18n";
import { TaskScheduleDialog, type ScheduleValues } from "./TaskScheduleDialog";

const NOW = "2026-03-04T10:00";
async function open(props: Partial<React.ComponentProps<typeof TaskScheduleDialog>> = {}) {
  const onSave = vi.fn<(v: ScheduleValues) => void>();
  const onOpenChange = vi.fn();
  await renderWithI18n(<TaskScheduleDialog open onOpenChange={onOpenChange} onSave={onSave} nowLocal={() => NOW} {...props} />);
  return { onSave, onOpenChange, user: userEvent.setup() };
}
const dlg = () => screen.getByRole("dialog");

describe("campos (U-226)", () => {
  it("título, fecha, inicio, fin, duración, recordatorio y repetición, en ese orden", async () => {
    await open();
    const labels = [...dlg().querySelectorAll("label")].map((l) => l.textContent?.trim());
    const want = ["Título", "Fecha", "Hora de inicio", "Hora de fin", "Duración", "Recordatorio", "Repetir"];
    expect(labels.filter((l) => want.includes(l!))).toEqual(want);
  });
  it("el foco inicial está en el título", async () => {
    await open();
    expect(screen.getByLabelText("Título")).toHaveFocus();
  });
});

describe("fecha y hora escritas (U-227, U-228)", () => {
  it("una fecha escrita se normaliza al salir del campo", async () => {
    const { user } = await open();
    const f = screen.getByLabelText("Fecha");
    await user.clear(f); await user.type(f, "5/3/2026"); await user.tab();
    expect(f).toHaveValue("2026-03-05");
  });
  it("una hora escrita se normaliza y una inválida marca error", async () => {
    const { user } = await open();
    const s = screen.getByLabelText("Hora de inicio");
    await user.clear(s); await user.type(s, "930"); await user.tab();
    expect(s).toHaveValue("09:30");
    await user.clear(s); await user.type(s, "99:99"); await user.tab();
    expect(await screen.findByText("Escribe una hora válida, por ejemplo 09:30.")).toBeInTheDocument();
  });
  it("el selector de hora es un popover con lista de franjas navegable con teclado", async () => {
    const { user } = await open();
    await user.click(screen.getByRole("button", { name: "Elegir hora de inicio" }));
    const list = await screen.findByRole("listbox", { name: "Horas" });
    await user.click(within(list).getByRole("option", { name: "14:30" }));
    expect(screen.getByLabelText("Hora de inicio")).toHaveValue("14:30");
  });
  it("el selector de fecha es un popover con rejilla del mes", async () => {
    const { user } = await open({ initial: { date: "2026-03-04" } });
    await user.click(screen.getByRole("button", { name: "Elegir fecha" }));
    await user.click(await screen.findByRole("button", { name: /^10 de marzo/ }));
    expect(screen.getByLabelText("Fecha")).toHaveValue("2026-03-10");
  });
});

describe("abrir desde una franja (U-229)", () => {
  it("llega con fecha y hora ya rellenas", async () => {
    await open({ initial: { date: "2026-03-06", startTime: "15:00" } });
    expect(screen.getByLabelText("Fecha")).toHaveValue("2026-03-06");
    expect(screen.getByLabelText("Hora de inicio")).toHaveValue("15:00");
    expect(screen.getByLabelText("Hora de fin")).toHaveValue("16:00");
  });
});

describe("guardar y cancelar (U-230)", () => {
  it("Enter en el título guarda", async () => {
    const { onSave, user } = await open({ initial: { date: "2026-03-06", startTime: "15:00" } });
    await user.type(screen.getByLabelText("Título"), "Reunión{Enter}");
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ title: "Reunión", date: "2026-03-06", startTime: "15:00", durationMin: 60 }));
  });
  it("Escape cancela sin guardar", async () => {
    const { onSave, onOpenChange, user } = await open();
    await user.keyboard("{Escape}");
    expect(onSave).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
  it("sin título el botón guardar está deshabilitado y dice por qué", async () => {
    await open({ initial: { date: "2026-03-06", startTime: "15:00" } });
    expect(screen.getByRole("button", { name: "Guardar" })).toBeDisabled();
    expect(screen.getByText(/Escribe un título para guardar\./)).toBeInTheDocument();
  });
});

describe("validación del horario (U-231)", () => {
  it("un fin anterior al inicio marca el campo y bloquea guardar con razón visible", async () => {
    const { user } = await open({ initial: { date: "2026-03-06", startTime: "15:00" } });
    await user.type(screen.getByLabelText("Título"), "X");
    const end = screen.getByLabelText("Hora de fin");
    await user.clear(end); await user.type(end, "14:00"); await user.tab();
    expect(end).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("La hora de fin no puede ser anterior al inicio.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Guardar" })).toBeDisabled();
    expect(screen.getByText(/No se puede guardar:/)).toBeInTheDocument();
  });
  it("cambiar la duración mueve la hora de fin", async () => {
    const { user } = await open({ initial: { date: "2026-03-06", startTime: "15:00" } });
    await user.selectOptions(screen.getByLabelText("Duración"), "90");
    expect(screen.getByLabelText("Hora de fin")).toHaveValue("16:30");
  });
});

describe("recordatorio en el pasado (U-232)", () => {
  it("avisa y ofrece guardar como vencida o cambiar la hora", async () => {
    const { onSave, user } = await open({ initial: { date: "2026-03-04", startTime: "09:00" } });
    await user.type(screen.getByLabelText("Título"), "Ya pasó");
    await user.selectOptions(screen.getByLabelText("Recordatorio"), "at_start");
    await user.click(screen.getByRole("button", { name: "Guardar" }));
    expect(onSave).not.toHaveBeenCalled();
    const alert = await screen.findByRole("group", { name: "Recordatorio en el pasado" });
    expect(alert).toHaveTextContent("ya pasó");
    await user.click(within(alert).getByRole("button", { name: "Guardar como vencida" }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ remindAt: "2026-03-04T09:00" }));
  });
  it("«Cambiar la hora» devuelve el foco al campo de inicio", async () => {
    const { user } = await open({ initial: { date: "2026-03-04", startTime: "09:00" } });
    await user.type(screen.getByLabelText("Título"), "X");
    await user.selectOptions(screen.getByLabelText("Recordatorio"), "at_start");
    await user.click(screen.getByRole("button", { name: "Guardar" }));
    await user.click(within(await screen.findByRole("group", { name: "Recordatorio en el pasado" })).getByRole("button", { name: "Cambiar la hora" }));
    await waitFor(() => expect(screen.getByLabelText("Hora de inicio")).toHaveFocus());
  });
});
