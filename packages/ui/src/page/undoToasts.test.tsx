// U-148 y U-149 (RF-11.1, RF-11.4): mover a la papelera y duplicar muestran un aviso temporal con «Deshacer».
import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithI18n } from "../../tests/renderWithI18n";
import { makeController } from "../../tests/withController";
import { PageHeader } from "./PageHeader";
import { ToastProvider } from "../feedback/ToastContext";

async function setup() {
  const { controller } = await makeController();
  const r = await controller.createPage(null, "Mi página");
  if (!r.ok) throw new Error("x");
  await renderWithI18n(<ToastProvider><PageHeader controller={controller} pageId={r.value.id} /></ToastProvider>);
  return { controller, id: r.value.id, user: userEvent.setup() };
}
const titles = (c: Awaited<ReturnType<typeof makeController>>["controller"]) => c.getSnapshot().tree.map((n) => n.page.title);

describe("«Deshacer» en avisos (RF-11.1)", () => {
  it("eliminar muestra el aviso y «Deshacer» restaura la página", async () => {
    const { controller, user } = await setup();
    await user.click(screen.getByRole("button", { name: "Eliminar" }));
    expect(titles(controller)).toEqual([]);
    await user.click(await screen.findByRole("button", { name: "Deshacer" }));
    expect(titles(controller)).toEqual(["Mi página"]);
  });
  it("duplicar muestra el aviso y «Deshacer» quita la copia", async () => {
    const { controller, user } = await setup();
    await user.click(screen.getByRole("button", { name: "Duplicar" }));
    await user.click(await screen.findByRole("menuitem", { name: "Solo esta página" }));
    expect(titles(controller)).toHaveLength(2);
    await user.click(await screen.findByRole("button", { name: "Deshacer" }));
    expect(titles(controller)).toEqual(["Mi página"]);
  });
});
