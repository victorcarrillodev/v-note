// T-270 (prueba primero): panel de filtros, orden y agrupación de la vista activa.
import { describe, it, expect } from "vitest";
import { screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FakeClock, migrate, migrations, DatabaseService } from "@vnote/core";
import { createNodeSqliteStore } from "../../../core/tests/support/nodeSqliteStore";
import { renderWithI18n } from "../../tests/renderWithI18n";
import { DatabaseController } from "./databaseController";
import { DatabaseView } from "./DatabaseView";
import { choose, dropdownOptions } from "../../tests/dropdown";

const must = <T,>(r: { ok: boolean; value?: T; error?: { message: string } }): T => { if (!r.ok) throw new Error(r.error?.message); return r.value as T; };

async function setup() {
  const store = await createNodeSqliteStore(":memory:");
  await migrate(store, migrations);
  const clock = new FakeClock(Date.UTC(2026, 2, 5, 12));
  const dbs = new DatabaseService(store, clock);
  const d = must(await dbs.createDatabase({ name: "Gastos" }));
  const monto = must(await dbs.addProperty(d.id, { name: "Monto", type: "number" }));
  const cat = must(await dbs.addProperty(d.id, { name: "Categoría", type: "select", config: { options: [{ id: "c", name: "Comida" }, { id: "t", name: "Transporte" }] } }));
  for (const [t, m, c] of [["Taco", 50, "c"], ["Metro", 10, "t"], ["Cena", 300, "c"], ["Taxi", 120, "t"]] as const) must(await dbs.addRow(d.id, { title: t, values: { [monto.id]: m, [cat.id]: c } }));
  const c = (await DatabaseController.forPage(store, clock, d.pageId!))!;
  await renderWithI18n(<DatabaseView controller={c} showTitle={false} />);
  return { c, monto: monto.id, cat: cat.id, user: userEvent.setup() };
}
const titles = (c: DatabaseController) => c.getSnapshot().result!.rows.map((r) => r.title);
const open = async (user: ReturnType<typeof userEvent.setup>) => { await user.click(screen.getByRole("button", { name: "Filtros y orden" })); return screen.findByRole("region", { name: "Filtros y orden" }); };

describe("filtros (T-270)", () => {
  it("añadir una condición filtra las filas de la vista", async () => {
    const { c, monto, user } = await setup();
    const panel = await open(user);
    await user.click(within(panel).getByRole("button", { name: "Añadir filtro" }));
    await choose(user, within(panel).getByLabelText("Propiedad del filtro 1"), monto);
    await choose(user, within(panel).getByLabelText("Operador del filtro 1"), "gte");
    await user.type(within(panel).getByLabelText("Valor del filtro 1"), "100");
    await waitFor(() => expect(titles(c)).toEqual(["Cena", "Taxi"]));
  });
  it("un filtro por selección usa las opciones de la propiedad", async () => {
    const { c, cat, user } = await setup();
    const panel = await open(user);
    await user.click(within(panel).getByRole("button", { name: "Añadir filtro" }));
    await choose(user, within(panel).getByLabelText("Propiedad del filtro 1"), cat);
    await choose(user, within(panel).getByLabelText("Valor del filtro 1"), "t");
    await waitFor(() => expect(titles(c)).toEqual(["Metro", "Taxi"]));
  });
  it("varias condiciones con «y» / «o»", async () => {
    const { c, monto, cat, user } = await setup();
    const panel = await open(user);
    await user.click(within(panel).getByRole("button", { name: "Añadir filtro" }));
    await choose(user, within(panel).getByLabelText("Propiedad del filtro 1"), monto); await choose(user, within(panel).getByLabelText("Operador del filtro 1"), "gte"); await user.type(within(panel).getByLabelText("Valor del filtro 1"), "100");
    await user.click(within(panel).getByRole("button", { name: "Añadir filtro" }));
    await choose(user, within(panel).getByLabelText("Propiedad del filtro 2"), cat); await choose(user, within(panel).getByLabelText("Valor del filtro 2"), "c");
    await waitFor(() => expect(titles(c)).toEqual(["Cena"])); // y (por defecto)
    await choose(user, within(panel).getByLabelText("Combinar filtros con"), "or");
    await waitFor(() => expect(titles(c)).toEqual(["Taco", "Cena", "Taxi"]));
  });
  it("quitar el filtro devuelve todas las filas", async () => {
    const { c, monto, user } = await setup();
    const panel = await open(user);
    await user.click(within(panel).getByRole("button", { name: "Añadir filtro" }));
    await choose(user, within(panel).getByLabelText("Propiedad del filtro 1"), monto); await choose(user, within(panel).getByLabelText("Operador del filtro 1"), "gt"); await user.type(within(panel).getByLabelText("Valor del filtro 1"), "1000");
    await waitFor(() => expect(titles(c)).toEqual([]));
    await user.click(within(panel).getByRole("button", { name: "Quitar filtro 1" }));
    await waitFor(() => expect(titles(c)).toHaveLength(4));
  });
  it("los operadores dependen del tipo de la propiedad", async () => {
    const { monto, cat, user } = await setup();
    const panel = await open(user);
    await user.click(within(panel).getByRole("button", { name: "Añadir filtro" }));
    await choose(user, within(panel).getByLabelText("Propiedad del filtro 1"), monto);
    const ops = (label: string) => dropdownOptions(within(panel).getByLabelText(label));
    expect((await ops("Operador del filtro 1")).map((o) => o.value)).toEqual(expect.arrayContaining(["eq", "gt", "lt", "is_empty"]));
    await choose(user, within(panel).getByLabelText("Propiedad del filtro 1"), cat);
    expect((await ops("Operador del filtro 1")).map((o) => o.value)).toEqual(expect.arrayContaining(["is", "is_not", "is_empty"]));
    expect((await ops("Operador del filtro 1")).map((o) => o.value)).not.toContain("gt");
  });
});

describe("orden y agrupación (T-270)", () => {
  it("ordenar por una propiedad, ascendente y descendente, y añadir un desempate", async () => {
    const { c, monto, user } = await setup();
    const panel = await open(user);
    await user.click(within(panel).getByRole("button", { name: "Añadir orden" }));
    await choose(user, within(panel).getByLabelText("Propiedad del orden 1"), monto);
    await waitFor(() => expect(titles(c)).toEqual(["Metro", "Taco", "Taxi", "Cena"]));
    await choose(user, within(panel).getByLabelText("Dirección del orden 1"), "desc");
    await waitFor(() => expect(titles(c)).toEqual(["Cena", "Taxi", "Taco", "Metro"]));
  });
  it("agrupar por una propiedad crea grupos", async () => {
    const { c, cat, user } = await setup();
    const panel = await open(user);
    await choose(user, within(panel).getByLabelText("Agrupar por"), cat);
    await waitFor(() => expect(c.getSnapshot().result!.groups!.map((g) => g.key)).toEqual(["c", "t"]));
    await choose(user, within(panel).getByLabelText("Agrupar por"), "");
    await waitFor(() => expect(c.getSnapshot().result!.groups).toBeNull());
  });
  it("la configuración se guarda en la vista (persiste al recargar el controlador)", async () => {
    const { c, monto, user } = await setup();
    const panel = await open(user);
    await user.click(within(panel).getByRole("button", { name: "Añadir orden" }));
    await choose(user, within(panel).getByLabelText("Propiedad del orden 1"), monto);
    await waitFor(() => expect(c.getSnapshot().views[0]!.config.sorts).toHaveLength(1));
    await c.refresh();
    expect(c.getSnapshot().views[0]!.config.sorts![0]!.property).toBe(monto);
  });
});
