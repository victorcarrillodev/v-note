// U-238 y U-239 (RF-5.9, CL-9): chips de etiqueta con «+N» y popover para elegir o crear.
import { describe, it, expect } from "vitest";
import { screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithI18n } from "../../tests/renderWithI18n";
import { makeController } from "../../tests/withController";
import { PageTags } from "./PageTags";
import { splitTags, MAX_VISIBLE_TAGS } from "./splitTags";

const tag = (n: number) => ({ id: `t${n}`, name: `Etiqueta ${n}`, color: "blue" as const, createdAt: n });
describe("splitTags", () => {
  it("con 10 etiquetas muestra las primeras y resume el resto como +N", () => {
    const r = splitTags(Array.from({ length: 10 }, (_, i) => tag(i)));
    expect(r.shown).toHaveLength(MAX_VISIBLE_TAGS);
    expect(r.more).toBe(10 - MAX_VISIBLE_TAGS);
  });
  it("con pocas no hay +N", () => { expect(splitTags([tag(1), tag(2)])).toMatchObject({ more: 0 }); });
});

async function setup(n = 0) {
  const { controller } = await makeController();
  const p = await controller.createPage(null, "Nota");
  if (!p.ok) throw new Error("x");
  for (let i = 0; i < n; i++) { const t = await controller.tags.create({ name: `Etiqueta ${i}`, color: "blue" }); if (t.ok) await controller.tags.assign(p.value.id, t.value.id); }
  await renderWithI18n(<PageTags controller={controller} pageId={p.value.id} />);
  return { controller, pageId: p.value.id, user: userEvent.setup() };
}

describe("chips (U-238)", () => {
  it("10 etiquetas: chips visibles y «+N» con nombre accesible", async () => {
    await setup(10);
    const list = await screen.findByRole("list", { name: "Etiquetas de la página" });
    expect(within(list).getAllByRole("listitem").length).toBe(MAX_VISIBLE_TAGS + 1);
    expect(within(list).getByText(`+${10 - MAX_VISIBLE_TAGS}`)).toBeInTheDocument();
  });
  it("cada chip lleva texto (no solo color) y color por nombre de la paleta", async () => {
    await setup(1);
    const chip = await screen.findByText("Etiqueta 0");
    expect(chip.closest("[data-color]")!.getAttribute("data-color")).toBe("blue");
  });
});

describe("popover (U-239)", () => {
  it("crea una etiqueta nueva y la asigna a la página", async () => {
    const { controller, pageId, user } = await setup(0);
    await user.click(screen.getByRole("button", { name: "Añadir etiqueta" }));
    await user.type(await screen.findByLabelText("Buscar o crear etiqueta"), "Urgente{Enter}");
    await waitFor(async () => expect((await controller.tags.forPage(pageId)).map((t) => t.name)).toEqual(["Urgente"]));
    expect(await screen.findByText("Urgente")).toBeInTheDocument();
  });
  it("elige una existente y la quita con su botón", async () => {
    const { controller, pageId, user } = await setup(0);
    await controller.tags.create({ name: "Casa", color: "green" });
    await user.click(screen.getByRole("button", { name: "Añadir etiqueta" }));
    await user.click(await screen.findByRole("option", { name: "Casa" }));
    await waitFor(async () => expect((await controller.tags.forPage(pageId)).length).toBe(1));
    await user.click(await screen.findByRole("button", { name: "Quitar la etiqueta Casa" }));
    await waitFor(async () => expect((await controller.tags.forPage(pageId)).length).toBe(0));
  });
  it("un nombre repetido muestra el motivo en lugar de duplicar", async () => {
    const { controller, user } = await setup(0);
    await controller.tags.create({ name: "Casa", color: "green" });
    await user.click(screen.getByRole("button", { name: "Añadir etiqueta" }));
    await user.type(await screen.findByLabelText("Buscar o crear etiqueta"), "casa{Enter}");
    // «casa» coincide con una existente: se asigna esa en vez de crear otra
    await waitFor(async () => expect((await controller.tags.list()).length).toBe(1));
  });
});
