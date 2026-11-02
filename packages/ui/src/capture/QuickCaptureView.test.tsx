// T-373 (parte web), T-374, T-375, T-376, T-378, T-382 (prueba primero): ventana mínima de captura rápida.
import { describe, it, expect, vi } from "vitest";
import { screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QuickCapture, WorkspaceManager, FakeClock, type Workspace } from "@vnote/core";
import { MemoryConfigStore, MemoryWorkspaceStorage } from "../../../core/tests/support/memoryPorts";
import { renderWithI18n } from "../../tests/renderWithI18n";
import { QuickCaptureView } from "./QuickCaptureView";

async function setup(names = ["Personal"], draft?: string, mount = true) {
  const clock = new FakeClock(1_000);
  const manager = new WorkspaceManager(new MemoryConfigStore(), new MemoryWorkspaceStorage(), clock);
  const spaces: Workspace[] = [];
  for (const n of names) { const r = await manager.create({ name: n }); if (r.ok) spaces.push(r.value); }
  if (draft !== undefined && spaces[0]) {
    const o = await manager.open(spaces[0].id);
    if (o.ok) await new QuickCapture(o.value.store, clock, "Bandeja de entrada").saveDraft(draft);
  }
  const onSaved = vi.fn(), onClose = vi.fn();
  const show = () => renderWithI18n(<QuickCaptureView manager={manager} clock={clock} onSaved={onSaved} onClose={onClose} />);
  if (mount) await show();
  const capOf = async (idx = 0) => { const o = await manager.open(spaces[idx]!.id); if (!o.ok) throw new Error(o.error.message); return new QuickCapture(o.value.store, clock, "Bandeja de entrada"); };
  return { manager, onSaved, onClose, capOf, show, user: userEvent.setup(), spaces };
}
const box = () => screen.findByRole("textbox", { name: "Nota rápida" });

describe("captura rápida", () => {
  it("el borrador se guarda al escribir (T-374) y se recupera con botón para descartarlo (T-376)", async () => {
    const { capOf, user } = await setup();
    await user.type(await box(), "comprar leche");
    await waitFor(async () => expect(await (await capOf()).getDraft()).toBe("comprar leche"));
  });
  it("al abrir con un borrador lo muestra y permite descartarlo", async () => {
    const { capOf, user } = await setup(["Personal"], "pendiente de ayer");
    expect(await box()).toHaveValue("pendiente de ayer");
    expect(screen.getByRole("status")).toHaveTextContent("Borrador recuperado");
    await user.click(screen.getByRole("button", { name: "Descartar borrador" }));
    expect(await box()).toHaveValue("");
    expect(await (await capOf()).getDraft()).toBeNull();
  });
  it("confirmar guarda en la Bandeja del espacio predeterminado y limpia el texto (T-375)", async () => {
    const { capOf, onSaved, user } = await setup();
    await user.type(await box(), "llamar a Ana");
    await user.click(screen.getByRole("button", { name: "Guardar en la bandeja" }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect((await (await capOf()).inboxNotes()).map((p) => p.title)).toEqual(["llamar a Ana"]);
    expect(await (await capOf()).getDraft()).toBeNull();
    expect(await box()).toHaveValue("");
  });
  it("Ctrl+Enter también confirma; con el texto vacío no hace nada", async () => {
    const { capOf, onSaved, user } = await setup();
    const b = await box();
    fireEvent.keyDown(b, { key: "Enter", ctrlKey: true });
    expect(onSaved).not.toHaveBeenCalled();
    await user.type(b, "idea");
    fireEvent.keyDown(b, { key: "Enter", ctrlKey: true });
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect((await (await capOf()).inboxNotes()).length).toBe(1);
  });
  it("cancelar con texto conserva el borrador y cierra (T-376)", async () => {
    const { capOf, onClose, user } = await setup();
    await user.type(await box(), "a medias");
    await waitFor(async () => expect(await (await capOf()).getDraft()).toBe("a medias"));
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onClose).toHaveBeenCalled();
    expect(await (await capOf()).getDraft()).toBe("a medias");
  });
  it("Escape cancela igual que el botón", async () => {
    const { onClose } = await setup();
    fireEvent.keyDown(await box(), { key: "Escape" });
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });
  it("si el espacio predeterminado se eliminó, pide elegir otro antes de capturar (T-378, CL-30)", async () => {
    const { manager, spaces, show, user } = await setup(["A", "B"], undefined, false);
    await manager.delete(spaces[0]!.id, { typedName: "A" });
    await show(); // nueva apertura de la captura
    expect(await screen.findByText(/Elige el espacio/)).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Nota rápida" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Usar B para la captura rápida" }));
    expect(await box()).toBeInTheDocument();
  });
  it("sin espacios explica que primero hay que crear uno", async () => {
    await setup([]);
    expect(await screen.findByText(/Crea un espacio/)).toBeInTheDocument();
  });
});
