// U-197 y U-198 (RF-6.2): barra con palabra clave y «Filtros y orden»; chips activos que se pueden quitar.
import { describe, it, expect } from "vitest";
import { screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FakeClock, migrate, migrations, DatabaseService } from "@vnote/core";
import { createNodeSqliteStore } from "../../../core/tests/support/nodeSqliteStore";
import { renderWithI18n } from "../../tests/renderWithI18n";
import { DatabaseController } from "./databaseController";
import { DatabaseView } from "./DatabaseView";

const must = <T,>(r: { ok: boolean; value?: T; error?: { message: string } }): T => { if (!r.ok) throw new Error(r.error?.message); return r.value as T; };

async function setup() {
  const store = await createNodeSqliteStore(":memory:");
  await migrate(store, migrations);
  const clock = new FakeClock(Date.UTC(2026, 2, 5, 12));
  const dbs = new DatabaseService(store, clock);
  const d = must(await dbs.createDatabase({ name: "Gastos" }));
  const monto = must(await dbs.addProperty(d.id, { name: "Monto", type: "number" }));
  for (const [t, m] of [["Taco", 50], ["Metro", 10], ["Cena", 300]] as const) must(await dbs.addRow(d.id, { title: t, values: { [monto.id]: m } }));
  const c = (await DatabaseController.forPage(store, clock, d.pageId!))!;
  await renderWithI18n(<DatabaseView controller={c} showTitle={false} />);
  return { c, monto: monto.id, user: userEvent.setup() };
}
const titles = (c: DatabaseController) => c.getSnapshot().result!.rows.map((r) => r.title);

describe("barra de la base", () => {
  it("hay un campo de palabra clave y el botón «Filtros y orden»", async () => {
    await setup();
    expect(screen.getByRole("searchbox", { name: "Buscar en esta base" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Filtros y orden" })).toBeInTheDocument();
  });
  it("escribir una palabra clave filtra las filas y borrarla las devuelve", async () => {
    const { c, user } = await setup();
    await user.type(screen.getByRole("searchbox", { name: "Buscar en esta base" }), "tac");
    await waitFor(() => expect(titles(c)).toEqual(["Taco"]));
    await user.clear(screen.getByRole("searchbox", { name: "Buscar en esta base" }));
    await waitFor(() => expect(titles(c)).toEqual(["Taco", "Metro", "Cena"]));
  });
  it("un filtro activo aparece como chip y al quitarlo vuelven las filas", async () => {
    const { c, monto, user } = await setup();
    await c.updateViewConfig({ filter: { type: "condition", property: monto, op: "gte", value: 100 } });
    const chips = await screen.findByRole("list", { name: "Filtros activos" });
    expect(within(chips).getByText(/Monto/)).toBeInTheDocument();
    expect(titles(c)).toEqual(["Cena"]);
    await user.click(within(chips).getByRole("button", { name: /Quitar.*Monto/ }));
    await waitFor(() => expect(titles(c)).toEqual(["Taco", "Metro", "Cena"]));
    expect(screen.queryByRole("list", { name: "Filtros activos" })).toBeNull();
  });
  it("un orden y una agrupación también aparecen como chips", async () => {
    const { c, monto } = await setup();
    await c.updateViewConfig({ sorts: [{ property: monto, direction: "desc" }] });
    const chips = await screen.findByRole("list", { name: "Filtros activos" });
    expect(within(chips).getByText(/Orden/)).toBeInTheDocument();
  });
  it("hacer clic en un chip abre el panel de filtros para editarlo", async () => {
    const { c, monto, user } = await setup();
    await c.updateViewConfig({ filter: { type: "condition", property: monto, op: "gte", value: 100 } });
    await user.click(await screen.findByRole("button", { name: /Editar.*Monto/ }));
    expect(await screen.findByRole("region", { name: "Filtros y orden" })).toBeInTheDocument();
  });
});
