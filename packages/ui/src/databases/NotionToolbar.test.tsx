// Barra de la base como en Notion: herramientas de icono, botón partido «Nuevo» y disposición de la galería.
import { describe, it, expect } from "vitest";
import { screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FakeClock, migrate, migrations, DatabaseService, ViewService } from "@vnote/core";
import { createNodeSqliteStore } from "../../../core/tests/support/nodeSqliteStore";
import { renderWithI18n } from "../../tests/renderWithI18n";
import { DatabaseController } from "./databaseController";
import { DatabaseView } from "./DatabaseView";

const must = <T,>(r: { ok: boolean; value?: T }): T => { if (!r.ok) throw new Error("x"); return r.value as T; };
async function setup() {
  const store = await createNodeSqliteStore(":memory:");
  await migrate(store, migrations);
  const clock = new FakeClock(Date.UTC(2026, 2, 5, 12));
  const dbs = new DatabaseService(store, clock);
  const d = must(await dbs.createDatabase({ name: "Proyectos" }));
  must(await dbs.addProperty(d.id, { name: "Monto", type: "number" }));
  must(await dbs.addRow(d.id, { title: "Uno" }));
  const view = must(await new ViewService(store).create(d.id, { name: "Galería", type: "gallery" }));
  const c = (await DatabaseController.forPage(store, clock, d.pageId!))!;
  await c.setActiveView(view.id);
  await renderWithI18n(<DatabaseView controller={c} showTitle={false} />);
  return { c, user: userEvent.setup() };
}
const cfg = (c: DatabaseController) => c.getSnapshot().views.find((v) => v.id === c.getSnapshot().activeViewId)!.config;

describe("barra estilo Notion", () => {
  it("«Nuevo» crea una fila y su menú ofrece también una propiedad", async () => {
    const { c, user } = await setup();
    const before = c.getSnapshot().result!.rows.length;
    await user.click(within(screen.getByRole("group", { name: "Proyectos" })).getByRole("button", { name: "Nueva fila" }));
    await waitFor(() => expect(c.getSnapshot().result!.rows.length).toBe(before + 1));
    await user.click(screen.getByRole("button", { name: "Más opciones para crear" }));
    expect(await screen.findByRole("menuitem", { name: "Nueva propiedad" })).toBeInTheDocument();
  });
  it("la disposición cambia el tamaño de las tarjetas y oculta la portada", async () => {
    const { c, user } = await setup();
    await user.click(screen.getByRole("button", { name: "Disposición de la vista" }));
    const panel = await screen.findByRole("group", { name: "Disposición de la vista" });
    await user.click(within(panel).getByRole("radio", { name: "Grande" }));
    await waitFor(() => expect(cfg(c).cardSize).toBe("large"));
    expect(screen.getAllByTestId("card-cover").length).toBeGreaterThan(0);
    await user.click(within(panel).getByRole("switch", { name: "Mostrar portada" }));
    await waitFor(() => expect(cfg(c).showCover).toBe(false));
    expect(screen.queryAllByTestId("card-cover")).toHaveLength(0);
  });
  it("las propiedades visibles se activan y desactivan desde la disposición", async () => {
    const { c, user } = await setup();
    await user.click(screen.getByRole("button", { name: "Disposición de la vista" }));
    const box = await screen.findByRole("checkbox", { name: "Monto" });
    const was = (box as HTMLInputElement).checked;
    await user.click(box);
    await waitFor(() => expect(cfg(c).visibleProperties?.includes(c.getSnapshot().properties[0]!.id)).toBe(!was));
  });
});
