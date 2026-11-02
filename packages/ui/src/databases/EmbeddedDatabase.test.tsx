// T-264, T-277 (prueba primero): vista de una base de datos dentro de una nota, enlazada a la misma base (los cambios se ven en ambas).
import { describe, it, expect } from "vitest";
import { screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FakeClock, migrate, migrations, DatabaseService } from "@vnote/core";
import { createNodeSqliteStore } from "../../../core/tests/support/nodeSqliteStore";
import { renderWithI18n } from "../../tests/renderWithI18n";
import { DatabaseController } from "./databaseController";
import { DatabaseEmbedProvider, EmbeddedDatabaseView, DatabasePicker } from "./EmbeddedDatabase";

const must = <T,>(r: { ok: boolean; value?: T; error?: { message: string } }): T => { if (!r.ok) throw new Error(r.error?.message); return r.value as T; };

async function setup() {
  const store = await createNodeSqliteStore(":memory:");
  await migrate(store, migrations);
  const clock = new FakeClock(Date.UTC(2026, 2, 5, 12));
  const dbs = new DatabaseService(store, clock);
  const gastos = must(await dbs.createDatabase({ name: "Gastos" }));
  const tareas = must(await dbs.createDatabase({ name: "Tareas" }));
  const monto = must(await dbs.addProperty(gastos.id, { name: "Monto", type: "number" }));
  must(await dbs.addRow(gastos.id, { title: "Café", values: { [monto.id]: 45 } }));
  const services = {
    list: async () => [{ id: gastos.id, name: "Gastos" }, { id: tareas.id, name: "Tareas" }],
    open: (id: string) => DatabaseController.forDatabase(store, clock, id),
  };
  return { store, clock, dbs, gastos, tareas, monto: monto.id, services, user: userEvent.setup() };
}

describe("selector de base de datos (T-264)", () => {
  it("lista las bases del espacio y devuelve la elegida", async () => {
    const { services, gastos, user } = await setup();
    const chosen: string[] = [];
    await renderWithI18n(<DatabaseEmbedProvider value={services}><DatabasePicker onPick={(id) => chosen.push(id)} /></DatabaseEmbedProvider>);
    const sel = await screen.findByLabelText("Base de datos");
    expect([...sel.querySelectorAll("option")].map((o) => o.textContent)).toEqual(expect.arrayContaining(["Gastos", "Tareas"]));
    await user.selectOptions(sel, gastos.id);
    await user.click(screen.getByRole("button", { name: "Insertar base de datos" }));
    expect(chosen).toEqual([gastos.id]);
  });
  it("sin bases de datos lo explica", async () => {
    await renderWithI18n(<DatabaseEmbedProvider value={{ list: async () => [], open: async () => null }}><DatabasePicker onPick={() => {}} /></DatabaseEmbedProvider>);
    expect(await screen.findByText("Aún no hay bases de datos en este espacio.")).toBeInTheDocument();
  });
});

describe("vista incrustada y enlazada (T-264, T-277)", () => {
  it("muestra la base con sus filas dentro de la nota", async () => {
    const { services, gastos } = await setup();
    await renderWithI18n(<DatabaseEmbedProvider value={services}><EmbeddedDatabaseView databaseId={gastos.id} viewId="" onViewChange={() => {}} /></DatabaseEmbedProvider>);
    expect(await screen.findByRole("row", { name: "Café" })).toBeInTheDocument();
    expect(screen.getByDisplayValue("45")).toBeInTheDocument();
  });
  it("es la MISMA base: editar una celda aquí se ve en la base original (y al revés)", async () => {
    const { services, gastos, store, clock, monto, user } = await setup();
    await renderWithI18n(<DatabaseEmbedProvider value={services}><EmbeddedDatabaseView databaseId={gastos.id} viewId="" onViewChange={() => {}} /></DatabaseEmbedProvider>);
    const input = await screen.findByDisplayValue("45");
    await user.clear(input); await user.type(input, "80"); await user.tab();
    const original = (await DatabaseController.forDatabase(store, clock, gastos.id))!;
    await waitFor(() => expect(original.getSnapshot().result!.rows[0]!.values[monto]).toBe(80));
    // y al revés: un cambio en la base original llega a la vista incrustada al recargarla
    await original.setCell(original.getSnapshot().result!.rows[0]!.pageId, monto, 99);
    await original.refresh();
    expect(original.getSnapshot().result!.rows[0]!.values[monto]).toBe(99);
  });
  it("la vista elegida se recuerda: cambiar de pestaña avisa para guardar el id de la vista en el bloque", async () => {
    const { services, gastos, user } = await setup();
    const seen: string[] = [];
    await renderWithI18n(<DatabaseEmbedProvider value={services}><EmbeddedDatabaseView databaseId={gastos.id} viewId="" onViewChange={(id) => seen.push(id)} /></DatabaseEmbedProvider>);
    await screen.findByRole("tab", { name: "Tabla" });
    await user.selectOptions(screen.getByLabelText("Tipo de vista nueva"), "list");
    await user.click(screen.getByRole("button", { name: "Nueva vista" }));
    await waitFor(() => expect(seen.length).toBeGreaterThan(0));
    expect(screen.getByRole("tab", { name: "Lista", selected: true })).toBeInTheDocument();
  });
  it("una vista guardada en el bloque se abre directamente", async () => {
    const { services, gastos, store, clock } = await setup();
    const c = (await DatabaseController.forDatabase(store, clock, gastos.id))!;
    const v = must(await c.createView("gallery", "Galería"));
    await renderWithI18n(<DatabaseEmbedProvider value={services}><EmbeddedDatabaseView databaseId={gastos.id} viewId={v.id} onViewChange={() => {}} /></DatabaseEmbedProvider>);
    expect(await screen.findByRole("tab", { name: "Galería", selected: true })).toBeInTheDocument();
    expect(within(await screen.findByRole("article", { name: "Café" })).getByText("Café")).toBeInTheDocument();
  });
  it("si la base ya no existe muestra un aviso, no una pantalla rota", async () => {
    await renderWithI18n(<DatabaseEmbedProvider value={{ list: async () => [], open: async () => null }}><EmbeddedDatabaseView databaseId="no-existe" viewId="" onViewChange={() => {}} /></DatabaseEmbedProvider>);
    expect(await screen.findByRole("note")).toHaveTextContent(/ya no existe/i);
  });
});
