// U-218 a U-221 (RF-7.2, RF-7.3, RF-7.4, CL-11, CL-14): calendario semanal por horas.
import { describe, it, expect, vi, afterEach } from "vitest";
import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithI18n } from "../../tests/renderWithI18n";
import { WeekGrid } from "./WeekGrid";
import type { PlanEvent } from "@vnote/core";

afterEach(() => { vi.useRealTimers(); });
const ev = (id: string, start: string, extra: Partial<PlanEvent> = {}): PlanEvent => ({ id, title: id, start, ...extra });
const NOW = Date.UTC(2026, 2, 4, 15, 30); // 09:30 hora local con UTC−6
const base = { weekStart: "2026-03-02", now: () => NOW, offsetMinutes: -360, onOpen: () => {}, onCreateAt: () => {} };

describe("estructura (U-218)", () => {
  it("cabecera de siete días, eje de 24 horas y franja «Todo el día»", async () => {
    await renderWithI18n(<WeekGrid {...base} events={[]} />);
    expect(screen.getAllByRole("columnheader")).toHaveLength(8); // 7 días + la esquina de las horas
    expect(screen.getByRole("rowheader", { name: "Todo el día" })).toBeInTheDocument();
    expect(document.querySelectorAll("[data-hour]")).toHaveLength(24);
  });
  it("las tareas con fecha y sin hora van a «Todo el día»", async () => {
    await renderWithI18n(<WeekGrid {...base} events={[ev("Pagar", "2026-03-04")]} />);
    const strip = screen.getByRole("group", { name: "Todo el día" });
    expect(within(strip).getByRole("button", { name: /Pagar/ })).toBeInTheDocument();
  });
});

describe("línea de «ahora» (U-219)", () => {
  it("aparece en el día y la hora locales y se mueve cada minuto", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    let t = NOW;
    await renderWithI18n(<WeekGrid {...base} now={() => t} events={[]} />);
    const line = () => document.querySelector("[data-now-line]") as HTMLElement;
    expect(line().dataset.day).toBe("2");
    expect(line().dataset.minute).toBe("570");
    t += 60_000;
    act(() => { vi.advanceTimersByTime(60_000); });
    expect(line().dataset.minute).toBe("571");
  });
  it("no aparece si la semana mostrada no contiene hoy", async () => {
    await renderWithI18n(<WeekGrid {...base} weekStart="2026-03-09" events={[]} />);
    expect(document.querySelector("[data-now-line]")).toBeNull();
  });
});

describe("eventos (U-220, U-221)", () => {
  it("coloca por hora y duración: 09:00 + 90 min → top y alto proporcionales", async () => {
    await renderWithI18n(<WeekGrid {...base} events={[ev("A", "2026-03-04T09:00", { durationMin: 90 })]} />);
    const e = screen.getByRole("button", { name: /A/ }).closest("[data-event]") as HTMLElement;
    expect(e.dataset.startMin).toBe("540");
    expect(e.dataset.endMin).toBe("630");
    expect(e.style.top).toBe(`${(540 / 1440) * 100}%`);
  });
  it("tres solapados van lado a lado, cada uno con un tercio del ancho", async () => {
    await renderWithI18n(<WeekGrid {...base} events={[ev("A", "2026-03-04T09:00"), ev("B", "2026-03-04T09:20"), ev("C", "2026-03-04T09:40")]} />);
    const items = [...document.querySelectorAll("[data-event]")] as HTMLElement[];
    expect(items.map((i) => i.dataset.lanes)).toEqual(["3", "3", "3"]);
    expect(new Set(items.map((i) => i.style.left)).size).toBe(3);
  });
  it("con 8 solapados muestra 3 y un grupo «+5» que abre el detalle", async () => {
    const events = Array.from({ length: 8 }, (_, i) => ev(`E${i}`, "2026-03-04T10:00"));
    await renderWithI18n(<WeekGrid {...base} events={events} />);
    expect(document.querySelectorAll("[data-event]")).toHaveLength(3);
    const more = screen.getByRole("button", { name: "+5 más" });
    await userEvent.click(more);
    const list = await screen.findByRole("list", { name: /Eventos simultáneos/ });
    expect(within(list).getAllByRole("listitem")).toHaveLength(5);
  });
  it("hacer clic en una franja vacía pide crear a esa fecha y hora", async () => {
    const onCreateAt = vi.fn();
    await renderWithI18n(<WeekGrid {...base} events={[]} onCreateAt={onCreateAt} />);
    const slot = document.querySelector('[data-slot="2026-03-04T14:00"]') as HTMLElement;
    await userEvent.click(slot);
    expect(onCreateAt).toHaveBeenCalledWith("2026-03-04", 840);
  });
  it("un evento que cruza medianoche se ve en dos días con bordes continuos", async () => {
    await renderWithI18n(<WeekGrid {...base} events={[ev("N", "2026-03-04T23:00", { end: "2026-03-05T01:00" })]} />);
    const parts = [...document.querySelectorAll("[data-event]")] as HTMLElement[];
    expect(parts).toHaveLength(2);
    expect(parts[0]!.dataset.continuesAfter).toBe("true");
    expect(parts[1]!.dataset.continuesBefore).toBe("true");
  });
});
