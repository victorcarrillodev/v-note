// T-135…T-140 (prueba primero): paleta de comandos con recientes, búsqueda en vivo, filtros y acciones (RF-5).
import { describe, it, expect, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithI18n } from "../../tests/renderWithI18n";
import { makeController } from "../../tests/withController";
import { CommandPalette, type PaletteAction } from "./CommandPalette";
import type { WorkspaceController } from "../workspace/controller";

async function setup(opts: { seed?: (c: WorkspaceController) => Promise<void>; actions?: PaletteAction[] } = {}) {
  const { controller, clock } = await makeController();
  await opts.seed?.(controller);
  const onOpenPage = vi.fn();
  const onClose = vi.fn();
  const r = await renderWithI18n(<CommandPalette controller={controller} open onClose={onClose} onOpenPage={onOpenPage} actions={opts.actions ?? []} />);
  return { controller, clock, onOpenPage, onClose, user: userEvent.setup(), ...r };
}
const mk = async (c: WorkspaceController, title: string) => { const r = await c.createPage(null, title); if (!r.ok) throw new Error("x"); return r.value; };
const input = () => screen.getByPlaceholderText(/Busca páginas/);
const options = () => within(screen.getByRole("listbox")).queryAllByRole("option");

describe("abrir y cerrar (T-135)", () => {
  it("cerrada no muestra nada", async () => {
    const { controller } = await makeController();
    await renderWithI18n(<CommandPalette controller={controller} open={false} onClose={() => {}} onOpenPage={() => {}} actions={[]} />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
  it("abierta muestra el cuadro de búsqueda con foco, y Esc la cierra", async () => {
    const { user, onClose } = await setup();
    expect(await screen.findByRole("dialog", { name: "Paleta de comandos" })).toBeInTheDocument();
    expect(input()).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
  });
});

describe("recientes (T-136)", () => {
  it("muestra Recientes ordenadas por visita", async () => {
    const { controller, clock } = await makeController();
    const a = await mk(controller, "Alfa"); clock.advance(10);
    const b = await mk(controller, "Beta"); clock.advance(10);
    await controller.select(a.id); clock.advance(10);
    await controller.select(b.id); clock.advance(10);
    await controller.select(a.id);
    await renderWithI18n(<CommandPalette controller={controller} open onClose={() => {}} onOpenPage={() => {}} actions={[]} />);
    const group = await screen.findByRole("group", { name: "Recientes" });
    expect(within(group).getAllByRole("option").map((o) => o.textContent)).toEqual(["Alfa", "Beta"]);
  });
});

describe("búsqueda en vivo (T-137, T-138)", () => {
  const seed = async (c: WorkspaceController) => { await mk(c, "Receta de mole"); await mk(c, "Receta de pozole"); await mk(c, "Presupuesto"); };
  it("los resultados cambian al escribir y resaltan la coincidencia", async () => {
    const { user } = await setup({ seed });
    await user.type(input(), "rec");
    const group = await screen.findByRole("group", { name: "Páginas" });
    await waitFor(() => expect(within(group).getAllByRole("option")).toHaveLength(2));
    expect(group.querySelector("mark")?.textContent?.toLowerCase()).toBe("rec");
    await user.type(input(), "eta de mo");
    await waitFor(() => expect(within(screen.getByRole("group", { name: "Páginas" })).getAllByRole("option")).toHaveLength(1));
    expect(screen.getByRole("option", { name: /Receta de mole/ })).toBeInTheDocument();
  });
  it("sin coincidencias muestra un mensaje", async () => {
    const { user } = await setup({ seed });
    await user.type(input(), "zzzz");
    expect(await screen.findByText("Sin coincidencias")).toBeInTheDocument();
  });
  it("elegir un resultado abre la página y cierra la paleta", async () => {
    const { user, onOpenPage, onClose } = await setup({ seed });
    await user.type(input(), "presu");
    await user.click(await screen.findByRole("option", { name: /Presupuesto/ }));
    expect(onOpenPage).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalled();
  });
  it("se puede elegir con teclado: flecha abajo + Enter", async () => {
    const { user, onOpenPage } = await setup({ seed });
    await user.type(input(), "presu");
    await screen.findByRole("option", { name: /Presupuesto/ });
    await user.keyboard("{Enter}");
    expect(onOpenPage).toHaveBeenCalled();
  });
});

describe("filtros (T-139)", () => {
  it("por tipo de página", async () => {
    const { user } = await setup({
      seed: async (c) => { await mk(c, "Nota uno"); await c.createPage(null, "Nota tablero", "board"); },
    });
    await user.type(input(), "nota");
    await waitFor(() => expect(options()).toHaveLength(2));
    await user.selectOptions(screen.getByLabelText("Tipo"), "board");
    await waitFor(() => expect(options()).toHaveLength(1));
    expect(options()[0]).toHaveTextContent("Nota tablero");
  });
  it("por fecha de modificación", async () => {
    const { controller, clock } = await makeController();
    await mk(controller, "Nota vieja");
    clock.advance(40 * 86_400_000);
    await mk(controller, "Nota nueva");
    const user = userEvent.setup();
    await renderWithI18n(<CommandPalette controller={controller} open onClose={() => {}} onOpenPage={() => {}} actions={[]} />);
    await user.type(input(), "nota");
    await waitFor(() => expect(options()).toHaveLength(2));
    await user.selectOptions(screen.getByLabelText("Modificada"), "month");
    await waitFor(() => expect(options()).toHaveLength(1));
    expect(options()[0]).toHaveTextContent("Nota nueva");
  });
  it("la papelera se excluye salvo que se pida", async () => {
    const { user } = await setup({
      seed: async (c) => { await mk(c, "Nota viva"); const t = await mk(c, "Nota borrada"); await c.trashPage(t.id); },
    });
    await user.type(input(), "nota");
    await waitFor(() => expect(options()).toHaveLength(1));
    await user.click(screen.getByLabelText("Incluir papelera"));
    await waitFor(() => expect(options()).toHaveLength(2));
    expect(screen.getByRole("option", { name: /Nota borrada/ })).toHaveTextContent("En la papelera");
  });
  it("no ofrece filtro de espacio: la búsqueda nunca cruza entre espacios (RF-21)", async () => {
    await setup();
    expect(screen.queryByLabelText("Espacio")).toBeNull();
  });
});

describe("acciones (T-140)", () => {
  it("lista las acciones y ejecuta la elegida cerrando la paleta", async () => {
    const run = vi.fn();
    const { user, onClose } = await setup({ actions: [{ id: "page.new", label: "Crear página", run }, { id: "theme.toggle", label: "Cambiar tema", run: vi.fn() }] });
    const group = await screen.findByRole("group", { name: "Acciones" });
    expect(within(group).getAllByRole("option")).toHaveLength(2);
    await user.click(within(group).getByRole("option", { name: "Crear página" }));
    expect(run).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalled();
  });
  it("al escribir, las acciones se filtran por nombre", async () => {
    const { user } = await setup({ actions: [{ id: "page.new", label: "Crear página", run: vi.fn() }, { id: "theme.toggle", label: "Cambiar tema", run: vi.fn() }] });
    await user.type(input(), "tema");
    await waitFor(() => expect(within(screen.getByRole("group", { name: "Acciones" })).getAllByRole("option")).toHaveLength(1));
    expect(screen.getByRole("option", { name: "Cambiar tema" })).toBeInTheDocument();
  });
});

import { highlightWords } from "./CommandPalette";
describe("highlightWords", () => {
  it("marca el prefijo de cada palabra coincidente y conserva el resto", () => {
    expect(highlightWords("Receta de mole", "rec mo")).toEqual([
      { text: "Rec", match: true }, { text: "eta de ", match: false }, { text: "mo", match: true }, { text: "le", match: false },
    ]);
  });
  it("sin palabras o sin coincidencias devuelve el texto intacto", () => {
    expect(highlightWords("Hola", "")).toEqual([{ text: "Hola", match: false }]);
    expect(highlightWords("Hola", "xyz")).toEqual([{ text: "Hola", match: false }]);
  });
});
