// U-133 (RF-11.5, CL-16): varios avisos a la vez se apilan sin bloquear los controles de la página.
import { describe, it, expect } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { ToastProvider, useToasts } from "./ToastContext";
import { renderWithI18n } from "../../tests/renderWithI18n";

function Emit() {
  const s = useToasts();
  return <button type="button" onClick={() => { s.add({ key: "g", tone: "success", message: "Guardado" }); s.add({ key: "b", tone: "info", message: "Respaldo listo" }); s.add({ key: "r", tone: "info", message: "Recordatorio" }); }}>emitir</button>;
}
describe("ToastProvider (U-133)", () => {
  it("tres avisos a la vez se apilan y el visor no captura clics fuera de los avisos", async () => {
    await renderWithI18n(<ToastProvider><Emit /></ToastProvider>);
    act(() => screen.getByText("emitir").click());
    expect(await screen.findAllByText("Guardado")).not.toHaveLength(0);
    expect(screen.getAllByText(/Respaldo listo|Recordatorio/).length).toBeGreaterThanOrEqual(2);
    const vp = document.querySelector("[data-toast-viewport]") as HTMLElement;
    expect(vp.className).toContain("pointer-events-none");
    expect(document.querySelectorAll("[data-toast-viewport] li")).toHaveLength(3);
    expect(screen.getByText("emitir")).toBeTruthy();
  });
});
