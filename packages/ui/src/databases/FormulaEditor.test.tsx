// T-269 (prueba primero): al definir una fórmula se ve una vista previa con el resultado de la primera fila o el error en español.
import { describe, it, expect } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FakeClock, migrate, migrations, DatabaseService } from "@vnote/core";
import { createNodeSqliteStore } from "../../../core/tests/support/nodeSqliteStore";
import { renderWithI18n } from "../../tests/renderWithI18n";
import { DatabaseController } from "./databaseController";
import { DatabaseView } from "./DatabaseView";
import { choose } from "../../tests/dropdown";

const must = <T,>(r: { ok: boolean; value?: T; error?: { message: string } }): T => { if (!r.ok) throw new Error(r.error?.message); return r.value as T; };

async function setup() {
  const store = await createNodeSqliteStore(":memory:");
  await migrate(store, migrations);
  const clock = new FakeClock(Date.UTC(2026, 2, 5, 12));
  const dbs = new DatabaseService(store, clock);
  const d = must(await dbs.createDatabase({ name: "Gastos" }));
  const a = must(await dbs.addProperty(d.id, { name: "A", type: "number" }));
  must(await dbs.addRow(d.id, { title: "fila", values: { [a.id]: 10 } }));
  const c = (await DatabaseController.forPage(store, clock, d.pageId!))!;
  await renderWithI18n(<DatabaseView controller={c} showTitle={false} />);
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Nueva propiedad" }));
  await choose(user, screen.getByLabelText("Tipo de propiedad"), "formula");
  await user.type(screen.getByLabelText("Nombre de la propiedad"), "Calc");
  return { c, user };
}
const preview = () => screen.findByRole("status", { name: "Vista previa de la fórmula" });
const typeExpr = async (user: ReturnType<typeof userEvent.setup>, text: string) => { const el = screen.getByLabelText("Fórmula"); await user.clear(el); await user.click(el); await user.paste(text); };

describe("editor de fórmulas (T-269)", () => {
  it("muestra el resultado de la primera fila mientras se escribe", async () => {
    const { user } = await setup();
    await typeExpr(user, 'prop("A") * 2 + 1');
    await waitFor(async () => expect(await preview()).toHaveTextContent("21"));
  });
  it("un error de sintaxis se explica en español", async () => {
    const { user } = await setup();
    await typeExpr(user, 'prop("A") +');
    await waitFor(async () => expect(await preview()).toHaveTextContent(/incompleta|esperaba|inesperad/i));
  });
  it("una propiedad inexistente se nombra", async () => {
    const { user } = await setup();
    await typeExpr(user, 'prop("Fantasma") + 1');
    await waitFor(async () => expect(await preview()).toHaveTextContent("Fantasma"));
  });
  it("un error de ejecución (dividir entre cero) se muestra con su explicación, sin impedir seguir editando", async () => {
    const { user } = await setup();
    await typeExpr(user, 'prop("A") / 0');
    await waitFor(async () => expect(await preview()).toHaveTextContent(/cero/i));
  });
  it("una fórmula válida se puede guardar y la nueva columna muestra el valor", async () => {
    const { user, c } = await setup();
    await typeExpr(user, 'prop("A") * 3');
    await user.click(screen.getByRole("button", { name: "Añadir propiedad" }));
    await waitFor(() => expect(c.getSnapshot().properties.map((p) => p.name)).toContain("Calc"));
    const calc = c.getSnapshot().properties.find((p) => p.name === "Calc")!;
    await waitFor(() => expect(c.getSnapshot().result!.rows[0]!.values[calc.id]).toBe(30));
  });
  it("una fórmula inválida no se guarda y muestra el motivo", async () => {
    const { user, c } = await setup();
    await typeExpr(user, 'prop("A") +');
    await user.click(screen.getByRole("button", { name: "Añadir propiedad" }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(c.getSnapshot().properties.map((p) => p.name)).not.toContain("Calc");
  });
  it("sin filas, la vista previa solo valida la fórmula", async () => {
    const store = await createNodeSqliteStore(":memory:");
    await migrate(store, migrations);
    const clock = new FakeClock(1);
    const dbs = new DatabaseService(store, clock);
    const d = must(await dbs.createDatabase({ name: "Vacía" }));
    must(await dbs.addProperty(d.id, { name: "A", type: "number" }));
    const c = (await DatabaseController.forPage(store, clock, d.pageId!))!;
    await renderWithI18n(<DatabaseView controller={c} showTitle={false} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Nueva propiedad" }));
    await choose(user, screen.getByLabelText("Tipo de propiedad"), "formula");
    await typeExpr(user, 'prop("A") * 2');
    await waitFor(async () => expect(await preview()).toHaveTextContent(/válida|sin filas/i));
  });
});
