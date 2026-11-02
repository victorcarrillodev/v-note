// T-117 (prueba primero): papelera con restaurar, borrar definitivo y días restantes, con confirmaciones.
import { describe, it, expect } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithI18n } from "../../tests/renderWithI18n";
import { makeController } from "../../tests/withController";
import { TrashView } from "./TrashView";

async function setup(titles = ["Uno", "Dos"]) {
  const { controller, clock } = await makeController();
  for (const t of titles) { const r = await controller.createPage(null, t); if (!r.ok) throw 1; await controller.trashPage(r.value.id); }
  await renderWithI18n(<TrashView controller={controller} />);
  return { controller, clock, user: userEvent.setup() };
}

describe("TrashView", () => {
  it("papelera vacía muestra el mensaje", async () => {
    const { controller } = await makeController();
    await renderWithI18n(<TrashView controller={controller} />);
    expect(screen.getByText("La papelera está vacía.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Vaciar papelera" })).toBeNull();
  });
  it("lista cada elemento con los días que le quedan (singular y plural)", async () => {
    const { controller, clock } = await setup(["Uno"]);
    expect(screen.getByRole("listitem")).toHaveTextContent("Uno");
    expect(screen.getByRole("listitem")).toHaveTextContent("Quedan 30 días");
    clock.advance(29 * 86_400_000 + 3_600_000);
    await controller.refresh();
    expect(await screen.findByText("Queda 1 día")).toBeInTheDocument();
  });
  it("restaurar devuelve la página", async () => {
    const { controller, user } = await setup(["Uno"]);
    await user.click(screen.getByRole("button", { name: "Restaurar Uno" }));
    expect(controller.getSnapshot().tree.map((n) => n.page.title)).toEqual(["Uno"]);
    expect(await screen.findByText("La papelera está vacía.")).toBeInTheDocument();
  });
  it("eliminar definitivamente pide confirmación; cancelar no borra", async () => {
    const { controller, user } = await setup(["Uno"]);
    await user.click(screen.getByRole("button", { name: "Eliminar definitivamente Uno" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText("¿Eliminar definitivamente?")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Cancelar" }));
    expect(controller.getSnapshot().trash).toHaveLength(1);
  });
  it("confirmar elimina definitivamente", async () => {
    const { controller, user } = await setup(["Uno"]);
    await user.click(screen.getByRole("button", { name: "Eliminar definitivamente Uno" }));
    await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Eliminar" }));
    expect(controller.getSnapshot().trash).toEqual([]);
  });
  it("vaciar la papelera pide confirmación y borra todo al confirmar", async () => {
    const { controller, user } = await setup();
    await user.click(screen.getByRole("button", { name: "Vaciar papelera" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(controller.getSnapshot().trash).toHaveLength(2);
    await user.click(within(dialog).getByRole("button", { name: "Eliminar" }));
    expect(controller.getSnapshot().trash).toEqual([]);
  });
});
