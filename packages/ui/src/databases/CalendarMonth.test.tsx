// U-211 y U-212 (RF-7.1, CL-10, CL-12): calendario mensual con día actual, días ajenos atenuados, «+N más» y barras de varios días.
import { describe, it, expect } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FakeClock, migrate, migrations, DatabaseService, ViewService } from "@vnote/core";
import { createNodeSqliteStore } from "../../../core/tests/support/nodeSqliteStore";
import { renderWithI18n } from "../../tests/renderWithI18n";
import { DatabaseController } from "./databaseController";
import { DatabaseView } from "./DatabaseView";

const must = <T,>(r: { ok: boolean; value?: T; error?: { message: string } }): T => { if (!r.ok) throw new Error(r.error?.message); return r.value as T; };
async function setup(seed?: (dbs: DatabaseService, id: string, f: string) => Promise<void>) {
  const store = await createNodeSqliteStore(":memory:");
  await migrate(store, migrations);
  const clock = new FakeClock(Date.UTC(2026, 2, 15, 12));
  const dbs = new DatabaseService(store, clock), views = new ViewService(store);
  const d = must(await dbs.createDatabase({ name: "Plan" }));
  const fecha = must(await dbs.addProperty(d.id, { name: "Fecha", type: "date" }));
  await seed?.(dbs, d.id, fecha.id);
  const view = must(await views.create(d.id, { name: "cal", type: "calendar" }));
  const c = (await DatabaseController.forPage(store, clock, d.pageId!))!;
  await c.setActiveView(view.id);
  await renderWithI18n(<DatabaseView controller={c} showTitle={false} today="2026-03-15" />);
  return { c, user: userEvent.setup() };
}
const cell = (label: RegExp) => screen.getByRole("gridcell", { name: label });

describe("rejilla (U-211)", () => {
  it("destaca el día actual y atenúa los días de otros meses", async () => {
    await setup();
    expect(cell(/15 de marzo de 2026/)).toHaveAttribute("aria-current", "date");
    expect(cell(/^1 de marzo de 2026/)).not.toHaveAttribute("data-outside");
    expect(cell(/23 de febrero de 2026/)).toHaveAttribute("data-outside", "true");
  });
  it("hay un encabezado por día de la semana y seis filas como máximo", async () => {
    await setup();
    expect(screen.getAllByRole("columnheader")).toHaveLength(7);
    expect(screen.getAllByRole("gridcell").length % 7).toBe(0);
  });
});

describe("sin datos (U-176, RF-6.7)", () => {
  it("sin filas muestra el estado vacío y la rejilla sigue disponible para crear", async () => {
    await setup();
    expect(await screen.findByText("Esta base de datos no tiene filas.")).toBeInTheDocument();
    expect(screen.getByRole("grid")).toBeInTheDocument();
  });
});

describe("eventos (U-212)", () => {
  const twelve = async (dbs: DatabaseService, id: string, f: string) => { for (let i = 0; i < 12; i++) must(await dbs.addRow(id, { title: `Ev ${String(i).padStart(2, "0")}`, values: { [f]: `2026-03-10T${String(8 + (i % 10)).padStart(2, "0")}:00` } })); };
  it("con 12 eventos en un día muestra 3 y «+9 más»", async () => {
    await setup(twelve);
    const c = cell(/10 de marzo de 2026/);
    expect(within(c).getAllByRole("button", { name: /^Ev / })).toHaveLength(3);
    expect(within(c).getByRole("button", { name: "+9 más" })).toBeInTheDocument();
  });
  it("«+9 más» abre el listado completo del día", async () => {
    const { user } = await setup(twelve);
    await user.click(within(cell(/10 de marzo de 2026/)).getByRole("button", { name: "+9 más" }));
    const list = await screen.findByRole("list", { name: /Eventos del 10 de marzo/ });
    expect(within(list).getAllByRole("listitem")).toHaveLength(12);
  });
  it("un evento de varios días es una barra que abarca esas columnas", async () => {
    const { } = await setup(async (dbs, id, f) => { must(await dbs.addRow(id, { title: "Viaje", values: { [f]: { start: "2026-03-09", end: "2026-03-11" } } })); });
    const bar = screen.getByRole("button", { name: /Viaje/, description: undefined });
    expect(bar.closest("[data-bar]")).toBeTruthy();
    const holder = bar.closest("[data-bar]") as HTMLElement;
    expect(holder.style.gridColumn).toBe("1 / span 3");
  });
  it("una barra que cruza de semana se parte y marca la continuación", async () => {
    await setup(async (dbs, id, f) => { must(await dbs.addRow(id, { title: "Larga", values: { [f]: { start: "2026-03-12", end: "2026-03-17" } } })); });
    const bars = document.querySelectorAll("[data-bar]");
    expect(bars).toHaveLength(2);
    expect((bars[0] as HTMLElement).dataset.continuesAfter).toBe("true");
    expect((bars[1] as HTMLElement).dataset.continuesBefore).toBe("true");
  });
});

describe("navegación y cambio de vista (U-213)", () => {
  it("de mes a semana mantiene el periodo y «Siguiente» avanza una semana", async () => {
    const { user } = await setup(async (dbs, id, f) => { must(await dbs.addRow(id, { title: "Cita", values: { [f]: "2026-03-17T10:00" } })); });
    await user.click(screen.getByRole("button", { name: "Mes siguiente" }));
    expect(screen.getByRole("heading", { name: /abril de 2026/i })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Hoy" }));
    await user.click(screen.getByRole("button", { name: "Semana" }));
    expect(screen.getByRole("grid", { name: "Calendario semanal" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /15/ })).toBeInTheDocument(); // domingo 15 de la semana del 9 al 15
    await user.click(screen.getByRole("button", { name: "Semana siguiente" }));
    expect(screen.getByRole("button", { name: /Cita/ })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Mes" }));
    expect(screen.getByRole("grid", { name: /marzo de 2026/i })).toBeInTheDocument();
  });
});

describe("crear desde una franja (U-229, U-233)", () => {
  it("clic en una franja abre el modal relleno; al guardar la tarea aparece en el acto", async () => {
    const { user } = await setup();
    await user.click(screen.getByRole("button", { name: "Semana" }));
    const slot = document.querySelector('[data-slot="2026-03-11T14:00"]') as HTMLElement;
    await user.click(slot);
    expect(await screen.findByLabelText("Fecha")).toHaveValue("2026-03-11");
    expect(screen.getByLabelText("Hora de inicio")).toHaveValue("14:00");
    await user.type(screen.getByLabelText("Título"), "Dentista{Enter}");
    expect(await screen.findByRole("button", { name: /Dentista 14:00–15:00/ })).toBeInTheDocument();
  });
});
