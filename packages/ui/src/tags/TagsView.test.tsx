// Gestión de etiquetas del espacio: renombrar, color, eliminar, páginas que las usan y búsqueda por etiquetas.
import { describe, it, expect } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithI18n } from "../../tests/renderWithI18n";
import { makeController } from "../../tests/withController";
import { TagsView } from "./TagsView";

async function setup() {
  const { controller } = await makeController();
  const a = await controller.createPage(null, "Alfa");
  const b = await controller.createPage(null, "Beta");
  if (!a.ok || !b.ok) throw new Error("x");
  const t1 = await controller.tags.create({ name: "uno", color: "blue" });
  const t2 = await controller.tags.create({ name: "dos", color: "red" });
  if (!t1.ok || !t2.ok) throw new Error("x");
  await controller.tags.assign(a.value.id, t1.value.id);
  await controller.tags.assign(a.value.id, t2.value.id);
  await controller.tags.assign(b.value.id, t1.value.id);
  const opened: string[] = [];
  await renderWithI18n(<TagsView controller={controller} onOpenPage={(id) => opened.push(id)} />);
  return { controller, a: a.value.id, t1: t1.value.id, t2: t2.value.id, opened, user: userEvent.setup() };
}

describe("TagsView", () => {
  it("lista las etiquetas con su uso y muestra las páginas que las tienen", async () => {
    const { user, opened, a } = await setup();
    expect(await screen.findByText("2 páginas")).toBeInTheDocument();
    await user.click(screen.getAllByRole("button", { name: "Ver páginas" })[1]!);
    await user.click(await screen.findByRole("button", { name: "Alfa" }));
    expect(opened).toEqual([a]);
  });
  it("renombra, cambia el color y rechaza duplicados", async () => {
    const { user, controller, t1 } = await setup();
    await user.click(await screen.findByRole("button", { name: "Renombrar la etiqueta uno" }));
    const input = screen.getByRole("textbox", { name: "Nuevo nombre de la etiqueta" });
    await user.clear(input); await user.type(input, "dos{Enter}");
    expect(await screen.findByRole("alert")).toHaveTextContent("Ya existe");
    await user.clear(input); await user.type(input, "primera{Enter}");
    await waitFor(async () => expect((await controller.tags.list()).some((x) => x.name === "primera")).toBe(true));
    await user.click(screen.getAllByRole("button", { name: /^Color de la etiqueta/ })[1]!);
    await user.click(await screen.findByRole("tab", { name: "Degradados" }));
    await user.click((await screen.findAllByRole("radio"))[5]!);
    await waitFor(async () => expect((await controller.tags.list()).find((x) => x.id === t1)?.color).toMatch(/^#[0-9a-f]{6}~#[0-9a-f]{6}$/));
  });
  it("elimina con confirmación", async () => {
    const { user, controller } = await setup();
    await user.click(await screen.findByRole("button", { name: "Eliminar la etiqueta uno" }));
    await user.click(await screen.findByRole("button", { name: "Eliminar" }));
    await waitFor(async () => expect((await controller.tags.list()).map((x) => x.name)).toEqual(["dos"]));
  });
  it("la búsqueda del controlador filtra por etiquetas, con o sin texto", async () => {
    const { controller, t1, t2 } = await setup();
    expect((await controller.search({ query: "", tagIds: [t1] })).map((h) => h.title).sort()).toEqual(["Alfa", "Beta"]);
    expect((await controller.search({ query: "", tagIds: [t1, t2] })).map((h) => h.title)).toEqual(["Alfa"]);
    expect((await controller.search({ query: "Beta", tagIds: [t2] }))).toEqual([]);
  });
});
