// U-195 y U-196 (RF-6.1): cabecera de la base (ícono, título, acciones) y vistas como pestañas con ícono.
import { describe, it, expect } from "vitest";
import { screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FakeClock, migrate, migrations, DatabaseService } from "@vnote/core";
import { createNodeSqliteStore } from "../../../core/tests/support/nodeSqliteStore";
import { renderWithI18n } from "../../tests/renderWithI18n";
import { DatabaseController } from "./databaseController";
import { DatabaseView } from "./DatabaseView";
import { VIEW_ICON } from "./DatabaseHeader";
import { Tabs } from "../components/Tabs";

const must = <T,>(r: { ok: boolean; value?: T }): T => { if (!r.ok) throw new Error("x"); return r.value as T; };
async function setup() {
  const store = await createNodeSqliteStore(":memory:");
  await migrate(store, migrations);
  const clock = new FakeClock(Date.UTC(2026, 2, 5, 12));
  const d = must(await new DatabaseService(store, clock).createDatabase({ name: "Proyectos" }));
  const c = (await DatabaseController.forPage(store, clock, d.pageId!))!;
  await renderWithI18n(<DatabaseView controller={c} />);
  return { c, user: userEvent.setup() };
}

describe("cabecera de la base (U-195)", () => {
  it("muestra ícono, título y las acciones principales", async () => {
    const { container } = (await setup(), { container: document.body });
    const header = screen.getByRole("group", { name: "Proyectos" });
    expect(header.querySelector("svg")).toBeTruthy();
    expect(within(header).getByRole("heading", { name: "Proyectos" })).toBeInTheDocument();
    expect(within(header).getByRole("button", { name: "Nueva fila" })).toBeInTheDocument();
    expect(within(header).getByRole("button", { name: "Nueva propiedad" })).toBeInTheDocument();
    void container;
  });
});

describe("vistas como pestañas con ícono (U-196)", () => {
  it("cada tipo de vista tiene su ícono y es único", () => {
    const icons = Object.values(VIEW_ICON);
    expect(icons).toHaveLength(6);
    expect(new Set(icons).size).toBe(6);
  });
  it("Tabs muestra el ícono junto al nombre", () => {
    const { container } = render2();
    expect(container.querySelectorAll("[role=tab] svg")).toHaveLength(2);
  });
  it("«Nueva vista» crea y activa una vista", async () => {
    const { c, user } = await setup();
    const before = c.getSnapshot().views.length;
    await user.click(screen.getByRole("button", { name: "Nueva vista" }));
    await waitFor(() => expect(c.getSnapshot().views.length).toBe(before + 1));
    expect(c.getSnapshot().views.at(-1)!.id).toBe(c.getSnapshot().activeViewId);
  });
  it("cambia entre vistas con las pestañas", async () => {
    const { c, user } = await setup();
    await c.createView("board", "Tablero");
    const tabs = await screen.findAllByRole("tab");
    await user.click(tabs[tabs.length - 1]!);
    await waitFor(() => expect(c.getSnapshot().views.find((v) => v.id === c.getSnapshot().activeViewId)?.type).toBe("board"));
  });
});

import { render } from "@testing-library/react";
const render2 = () => render(<Tabs label="Vistas" value="a" onChange={() => {}} tabs={[{ value: "a", label: "Tabla", icon: "database" }, { value: "b", label: "Tablero", icon: "board" }]} />);
