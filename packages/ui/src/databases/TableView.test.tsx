// U-199 a U-202 (RF-6.3, CL-8): cabecera fija, primera columna fija, desplazamiento propio, «+» y pie con conteo.
import { describe, it, expect } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FakeClock, migrate, migrations, DatabaseService } from "@vnote/core";
import { createNodeSqliteStore } from "../../../core/tests/support/nodeSqliteStore";
import { renderWithI18n } from "../../tests/renderWithI18n";
import { DatabaseController } from "./databaseController";
import { TableView } from "./TableView";

const must = <T,>(r: { ok: boolean; value?: T }): T => { if (!r.ok) throw new Error("x"); return r.value as T; };
async function setup(columns = 2, rows = 3) {
  const store = await createNodeSqliteStore(":memory:");
  await migrate(store, migrations);
  const clock = new FakeClock(Date.UTC(2026, 2, 5, 12));
  const dbs = new DatabaseService(store, clock);
  const d = must(await dbs.createDatabase({ name: "Ancha" }));
  for (let i = 0; i < columns; i++) must(await dbs.addProperty(d.id, { name: `Col ${i}`, type: "text" }));
  for (let r = 0; r < rows; r++) must(await dbs.addRow(d.id, { title: `Fila ${r}` }));
  const c = (await DatabaseController.forPage(store, clock, d.pageId!))!;
  const view = await renderWithI18n(<TableView controller={c} height={300} />);
  return { c, user: userEvent.setup(), ...view };
}

describe("tabla (U-199)", () => {
  it("la cabecera queda fija al desplazar", async () => {
    await setup();
    const head = screen.getAllByRole("row")[0]!;
    expect(head.className).toContain("sticky");
    expect(head.className).toContain("top-0");
  });
  it("las filas se resaltan al pasar el cursor con un token", async () => {
    await setup();
    const row = screen.getByRole("row", { name: "Fila 0" });
    expect(row.className).toContain("hover:bg-[var(--c-raised)]");
  });
});

describe("primera columna fija y desplazamiento propio con 30 columnas (U-200, CL-8)", () => {
  it("el contenedor desplaza horizontal y verticalmente por sí mismo", async () => {
    const { container } = await setup(30, 3);
    const scroller = container.querySelector("[data-table-scroll]") as HTMLElement;
    expect(scroller).toBeTruthy();
    expect(scroller.style.overflow).toBe("auto");
    expect(scroller.className).toContain("max-w-full");
  });
  it("el ancho interno crece con las columnas (260 + 30×200 + 48 px de la columna «+») sin forzar el ancho de la página", async () => {
    const { container } = await setup(30, 1);
    const inner = container.querySelector("[data-table-scroll] > div") as HTMLElement;
    expect(inner.style.width).toBe(`${260 + 30 * 200 + 48}px`);
  });
  it("título de la fila y de la cabecera quedan fijos a la izquierda", async () => {
    const { container } = await setup(30, 2);
    expect(container.querySelector('[role=columnheader]')!.className).toContain("sticky left-0");
    const cell = container.querySelector('[role=cell][data-col=title]') as HTMLElement;
    expect(cell.className).toContain("sticky left-0");
    expect(cell.className).toContain("bg-[var(--c-canvas)]");
  });
});

describe("columna «+» y pie (U-202)", () => {
  it("la última columna de la cabecera es un «+» que abre el alta de propiedad", async () => {
    let opened = 0;
    const store = await createNodeSqliteStore(":memory:");
    await migrate(store, migrations);
    const clock = new FakeClock(1);
    const d = must(await new DatabaseService(store, clock).createDatabase({ name: "X" }));
    const c = (await DatabaseController.forPage(store, clock, d.pageId!))!;
    await renderWithI18n(<TableView controller={c} height={300} onNewProperty={() => { opened++; }} />);
    await userEvent.click(screen.getByRole("button", { name: "Nueva columna" }));
    expect(opened).toBe(1);
  });
  it("el pie cuenta las filas, con singular y plural", async () => {
    await setup(1, 3);
    expect(screen.getByRole("status", { name: "Conteo de filas" })).toHaveTextContent("3 filas");
  });
  it("una sola fila dice «1 fila»", async () => {
    await setup(1, 1);
    expect(screen.getByRole("status", { name: "Conteo de filas" })).toHaveTextContent("1 fila");
  });
});
