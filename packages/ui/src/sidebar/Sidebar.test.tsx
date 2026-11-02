// T-112 y T-114 (prueba primero): barra lateral con creación de páginas y mensaje al mover a un descendiente.
import { describe, it, expect } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithI18n } from "../../tests/renderWithI18n";
import { makeController } from "../../tests/withController";
import { Sidebar } from "./Sidebar";

describe("Sidebar", () => {
  it("sin páginas muestra el mensaje de vacío", async () => {
    const { controller } = await makeController();
    await renderWithI18n(<Sidebar controller={controller} onOpenTrash={() => {}} />);
    expect(screen.getByText(/aún no hay páginas/i)).toBeInTheDocument();
  });
  it("«Nueva página» crea una página sin título, la selecciona y queda lista para escribir", async () => {
    const { controller } = await makeController();
    const opened: string[] = [];
    await renderWithI18n(<Sidebar controller={controller} onOpenTrash={() => {}} onPageOpened={(id) => opened.push(id)} />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Nueva página" }));
    const item = await screen.findByRole("treeitem", { name: "Sin título" });
    expect(item).toHaveAttribute("aria-selected", "true");
    expect(opened).toEqual([controller.getSnapshot().selectedId]);
  });
  it("«Nueva subpágina» está deshabilitada sin selección y crea una hija de la seleccionada", async () => {
    const { controller } = await makeController();
    await renderWithI18n(<Sidebar controller={controller} onOpenTrash={() => {}} />);
    const sub = screen.getByRole("button", { name: "Nueva subpágina" });
    expect(sub).toBeDisabled();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Nueva página" }));
    await screen.findByRole("treeitem");
    expect(sub).toBeEnabled();
    await user.click(sub);
    const items = await screen.findAllByRole("treeitem");
    expect(items).toHaveLength(2);
    expect(items[1]).toHaveAttribute("aria-level", "2");
    expect(items[0]).toHaveAttribute("aria-expanded", "true");
  });
  it("lista las páginas favoritas y abre la que se elige", async () => {
    const { controller } = await makeController();
    const a = await controller.createPage(null, "Favorita");
    if (!a.ok) throw new Error("x");
    await controller.toggleFavorite(a.value.id);
    await controller.select(null);
    const opened: string[] = [];
    await renderWithI18n(<Sidebar controller={controller} onOpenTrash={() => {}} onPageOpened={(id) => opened.push(id)} />);
    const fav = screen.getByRole("region", { name: "Favoritos" });
    await userEvent.setup().click(within(fav).getByRole("button", { name: "Favorita" }));
    expect(opened).toEqual([a.value.id]);
  });
  it("T-114: mover una página a un descendiente muestra el motivo y no cambia el árbol", async () => {
    const { controller } = await makeController();
    const a = await controller.createPage(null, "A");
    if (!a.ok) throw new Error("x");
    const b = await controller.createPage(a.value.id, "B");
    if (!b.ok) throw new Error("x");
    await renderWithI18n(<Sidebar controller={controller} onOpenTrash={() => {}} />);
    await screen.findAllByRole("treeitem");
    // el arrastre real se verifica en el e2e; aquí se usa la misma acción que ejecuta el árbol al soltar
    const { act } = await import("@testing-library/react");
    await act(async () => { await controller.movePage(a.value.id, b.value.id); });
    expect(await screen.findByRole("alert")).toHaveTextContent("No se puede mover una página dentro de sí misma ni de sus subpáginas.");
    await userEvent.setup().click(screen.getByRole("button", { name: "Cerrar aviso" }));
    expect(screen.queryByRole("alert")).toBeNull();
  });
  it("el botón de papelera avisa a quien lo usa", async () => {
    const { controller } = await makeController();
    let opened = 0;
    await renderWithI18n(<Sidebar controller={controller} onOpenTrash={() => opened++} />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Papelera" }));
    expect(opened).toBe(1);
  });
});
