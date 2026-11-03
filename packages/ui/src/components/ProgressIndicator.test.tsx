// U-179 (RF-12.3, RNF-1): progreso con porcentaje y «Cancelar»; no aparece antes de 300 ms.
import { describe, it, expect, vi, afterEach } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProgressIndicator, PROGRESS_DELAY_MS } from "./ProgressIndicator";

afterEach(() => { vi.useRealTimers(); });

describe("ProgressIndicator", () => {
  it("no aparece antes de 300 ms y sí después", () => {
    vi.useFakeTimers();
    render(<ProgressIndicator label="Exportando" done={1} total={4} cancelLabel="Cancelar" onCancel={() => {}} />);
    expect(PROGRESS_DELAY_MS).toBe(300);
    act(() => { vi.advanceTimersByTime(299); });
    expect(screen.queryByRole("progressbar")).toBeNull();
    act(() => { vi.advanceTimersByTime(2); });
    expect(screen.getByRole("progressbar", { name: "Exportando" })).toBeInTheDocument();
  });
  it("una operación que termina antes de 300 ms nunca muestra el indicador", () => {
    vi.useFakeTimers();
    const { rerender } = render(<ProgressIndicator label="x" done={0} total={1} cancelLabel="Cancelar" onCancel={() => {}} />);
    act(() => { vi.advanceTimersByTime(200); });
    rerender(<></>);
    act(() => { vi.advanceTimersByTime(500); });
    expect(screen.queryByRole("progressbar")).toBeNull();
  });
  it("muestra el porcentaje, expone el valor y permite cancelar", async () => {
    const onCancel = vi.fn();
    render(<ProgressIndicator label="Exportando" done={1} total={4} cancelLabel="Cancelar" onCancel={onCancel} delayMs={0} />);
    const bar = await screen.findByRole("progressbar", { name: "Exportando" });
    expect(bar).toHaveAttribute("aria-valuenow", "25");
    expect(screen.getByText("25 %")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onCancel).toHaveBeenCalled();
  });
  it("sin total conocido no inventa un porcentaje (indeterminado)", async () => {
    render(<ProgressIndicator label="Leyendo" done={0} total={0} cancelLabel="Cancelar" delayMs={0} />);
    const bar = await screen.findByRole("progressbar");
    expect(bar).not.toHaveAttribute("aria-valuenow");
    expect(screen.queryByText(/%/)).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });
});
