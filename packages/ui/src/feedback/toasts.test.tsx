// U-128 a U-132 (RF-11.1, RF-11.2, RF-11.5, RF-11.6, CL-16, CL-17): cola de avisos temporales y su componente.
import { describe, it, expect, vi, afterEach } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createToastStore } from "./toastStore";
import { ToastViewport } from "./ToastViewport";
import { renderWithI18n } from "../../tests/renderWithI18n";

afterEach(() => { vi.useRealTimers(); });

describe("cola de avisos (RF-11.5, CL-17)", () => {
  it("un mismo evento repetido actualiza el aviso existente en lugar de apilar otro", () => {
    const s = createToastStore();
    s.add({ key: "guardado", tone: "success", message: "Guardado" });
    s.add({ key: "guardado", tone: "success", message: "Guardado otra vez" });
    const { visible } = s.getSnapshot();
    expect(visible).toHaveLength(1);
    expect(visible[0]!.message).toBe("Guardado otra vez");
  });
  it("máximo 3 visibles; los demás esperan y avanzan al cerrarse uno", () => {
    const s = createToastStore();
    for (let i = 0; i < 5; i++) s.add({ key: `k${i}`, tone: "info", message: `m${i}` });
    expect(s.getSnapshot().visible.map((t) => t.message)).toEqual(["m0", "m1", "m2"]);
    expect(s.getSnapshot().queued).toHaveLength(2);
    s.dismiss(s.getSnapshot().visible[0]!.id);
    expect(s.getSnapshot().visible.map((t) => t.message)).toEqual(["m1", "m2", "m3"]);
  });
  it("duración: 5 s en éxito y 8 s si tiene «Deshacer»", () => {
    const s = createToastStore();
    s.add({ key: "a", tone: "success", message: "a" });
    s.add({ key: "b", tone: "success", message: "b", undo: { label: "Deshacer", run: () => {} } });
    const [a, b] = s.getSnapshot().visible;
    expect(a!.duration).toBe(5000);
    expect(b!.duration).toBe(8000);
  });
  it("rechaza errores accionables: esos van persistentes y en su contexto (RF-11.2)", () => {
    const s = createToastStore();
    expect(() => s.add({ key: "e", tone: "error" as never, message: "falló" })).toThrow(/persistente/i);
  });
  it("tres avisos a la vez (guardado, respaldo, recordatorio) conviven sin descartarse", () => {
    const s = createToastStore();
    s.add({ key: "save", tone: "success", message: "Guardado" });
    s.add({ key: "backup", tone: "info", message: "Respaldo listo" });
    s.add({ key: "reminder", tone: "info", message: "Recordatorio" });
    expect(s.getSnapshot().visible).toHaveLength(3);
  });
  it("notifica a los suscriptores y deja de hacerlo al desuscribirse", () => {
    const s = createToastStore(); const fn = vi.fn(); const off = s.subscribe(fn);
    s.add({ key: "a", tone: "info", message: "a" }); off(); s.add({ key: "b", tone: "info", message: "b" });
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe("ToastViewport (RF-11.1, RF-11.6)", () => {
  it("se coloca abajo y al centro del área de contenido, con margen", async () => {
    const s = createToastStore();
    await renderWithI18n(<ToastViewport store={s} />);
    const vp = document.querySelector("[data-toast-viewport]")!;
    expect(vp.className).toContain("bottom-");
    expect(vp.className).toContain("left-1/2");
    expect(vp.className).toContain("z-[var(--z-toast)]");
  });
  it("muestra ícono de gravedad, el mensaje y un botón de cerrar", async () => {
    const s = createToastStore();
    await renderWithI18n(<ToastViewport store={s} />);
    act(() => s.add({ key: "a", tone: "success", message: "Página movida" }));
    const t = await screen.findByText("Página movida");
    expect(t.closest("li")!.querySelector("svg")).not.toBeNull();
    expect(screen.getByRole("button", { name: /cerrar aviso/i })).toBeInTheDocument();
  });
  it("«Deshacer» ejecuta la acción y cierra el aviso", async () => {
    const s = createToastStore(); const run = vi.fn();
    await renderWithI18n(<ToastViewport store={s} />);
    act(() => s.add({ key: "a", tone: "success", message: "Página movida", undo: { label: "Deshacer", run } }));
    await userEvent.click(await screen.findByRole("button", { name: "Deshacer" }));
    expect(run).toHaveBeenCalled();
    expect(s.getSnapshot().visible).toHaveLength(0);
  });
  it("se retira solo tras su duración (éxito: 5 s)", async () => {
    vi.useFakeTimers();
    const s = createToastStore();
    render(<ToastViewport store={s} />);
    act(() => s.add({ key: "a", tone: "success", message: "Listo" }));
    expect(s.getSnapshot().visible).toHaveLength(1);
    await act(async () => { vi.advanceTimersByTime(5200); });
    expect(s.getSnapshot().visible).toHaveLength(0);
    vi.useRealTimers();
  });
  it("la cuenta se pausa al pasar el cursor y se reanuda al salir", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: false });
    const s = createToastStore();
    render(<ToastViewport store={s} />);
    act(() => s.add({ key: "a", tone: "success", message: "Listo" }));
    const vp = document.querySelector("[data-toast-viewport]")!;
    act(() => { vp.dispatchEvent(new Event("pointermove", { bubbles: true })); });
    await act(async () => { vi.advanceTimersByTime(20_000); });
    expect(s.getSnapshot().visible).toHaveLength(1); // pausado
    act(() => { vp.dispatchEvent(new Event("pointerleave", { bubbles: true })); });
    await act(async () => { vi.advanceTimersByTime(5200); });
    expect(s.getSnapshot().visible).toHaveLength(0);
    vi.useRealTimers();
  });
  it("accesible: región de avisos con role=status y cierre con Escape", async () => {
    const s = createToastStore();
    await renderWithI18n(<ToastViewport store={s} />);
    act(() => s.add({ key: "a", tone: "success", message: "Listo" }));
    await screen.findAllByText("Listo");
    expect(screen.getByRole("region", { name: "Avisos" })).toBeTruthy();
    const li = document.querySelector<HTMLElement>("[data-toast-viewport] li[role=status]")!;
    expect(li).toHaveTextContent("Listo");
    li.focus();
    await userEvent.keyboard("{Escape}");
    expect(s.getSnapshot().visible).toHaveLength(0);
  });
});
