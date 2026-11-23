// T-271…T-276 (prueba primero): vistas lista, galería, calendario y línea de tiempo.
import { describe, it, expect } from "vitest";
import { screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FakeClock, migrate, migrations, DatabaseService, ViewService } from "@vnote/core";
import { createNodeSqliteStore } from "../../../core/tests/support/nodeSqliteStore";
import { renderWithI18n } from "../../tests/renderWithI18n";
import { DatabaseController } from "./databaseController";
import { DatabaseView } from "./DatabaseView";
import { choose } from "../../tests/dropdown";

const must = <T,>(r: { ok: boolean; value?: T; error?: { message: string } }): T => { if (!r.ok) throw new Error(r.error?.message); return r.value as T; };

async function setup(type: "list" | "gallery" | "calendar" | "timeline", seed?: (dbs: DatabaseService, id: string, f: string) => Promise<void>) {
  const store = await createNodeSqliteStore(":memory:");
  await migrate(store, migrations);
  const clock = new FakeClock(Date.UTC(2026, 2, 15, 12)); // 15 de marzo de 2026
  const dbs = new DatabaseService(store, clock), views = new ViewService(store);
  const d = must(await dbs.createDatabase({ name: "Plan" }));
  const monto = must(await dbs.addProperty(d.id, { name: "Monto", type: "number" }));
  const fecha = must(await dbs.addProperty(d.id, { name: "Fecha", type: "date" }));
  void monto;
  await seed?.(dbs, d.id, fecha.id);
  const view = must(await views.create(d.id, { name: type, type }));
  const c = (await DatabaseController.forPage(store, clock, d.pageId!))!;
  await c.setActiveView(view.id);
  const opened: string[] = [];
  await renderWithI18n(<DatabaseView controller={c} showTitle={false} today="2026-03-15" onOpenRow={(id) => opened.push(id)} />);
  return { c, opened, dbs, dbId: d.id, fecha: fecha.id, monto: monto.id, user: userEvent.setup() };
}

describe("lista (T-271)", () => {
  it("muestra cada fila con su título y sus valores, y permite abrirla", async () => {
    const { user, opened, c } = await setup("list", async (dbs, id) => { const p = (await dbs.listProperties(id))[0]!; must(await dbs.addRow(id, { title: "Café", values: { [p.id]: 45 } })); must(await dbs.addRow(id, { title: "Pan" })); });
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("Café");
    expect(items[0]).toHaveTextContent("45");
    await user.click(screen.getByRole("button", { name: "Abrir Café" }));
    expect(opened).toEqual([c.getSnapshot().result!.rows[0]!.pageId]);
  });
  it("sin filas muestra el aviso", async () => {
    await setup("list");
    expect(screen.getByText("Esta base de datos no tiene filas.")).toBeInTheDocument();
  });
});

describe("galería (T-272)", () => {
  it("muestra una tarjeta por fila", async () => {
    await setup("gallery", async (dbs, id) => { must(await dbs.addRow(id, { title: "Uno" })); must(await dbs.addRow(id, { title: "Dos" })); });
    expect(screen.getAllByRole("article").map((a) => a.getAttribute("aria-label"))).toEqual(["Uno", "Dos"]);
  });
});

describe("calendario (T-273, T-274)", () => {
  it("muestra el mes de hoy con sus días y las filas en su fecha", async () => {
    await setup("calendar", async (dbs, id, f) => {
      must(await dbs.addRow(id, { title: "Dentista", values: { [f]: "2026-03-10" } }));
      must(await dbs.addRow(id, { title: "Reunión", values: { [f]: "2026-03-10T09:30" } }));
      must(await dbs.addRow(id, { title: "Viaje", values: { [f]: "2026-05-20" } }));
    });
    expect(screen.getByRole("heading", { name: /marzo de 2026/i })).toBeInTheDocument();
    const day10 = screen.getByRole("gridcell", { name: /10 de marzo/i });
    expect(within(day10).getAllByRole("button").map((b) => b.textContent)).toEqual(expect.arrayContaining(["Dentista", "Reunión"]));
    expect(screen.queryByText("Viaje")).toBeNull(); // es de mayo
  });
  it("navegar al mes siguiente y volver a hoy", async () => {
    const { user } = await setup("calendar", async (dbs, id, f) => { must(await dbs.addRow(id, { title: "Viaje", values: { [f]: "2026-04-20" } })); });
    await user.click(screen.getByRole("button", { name: "Mes siguiente" }));
    expect(screen.getByRole("heading", { name: /abril de 2026/i })).toBeInTheDocument();
    expect(screen.getByText("Viaje")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Hoy" }));
    expect(screen.getByRole("heading", { name: /marzo de 2026/i })).toBeInTheDocument();
  });
  it("las filas sin fecha se listan aparte", async () => {
    await setup("calendar", async (dbs, id) => { must(await dbs.addRow(id, { title: "Pendiente de fecha" })); });
    expect(within(screen.getByRole("region", { name: "Sin fecha" })).getByText("Pendiente de fecha")).toBeInTheDocument();
  });
  it("mover una fila a otro día (alternativa accesible al arrastre) cambia su fecha y conserva la hora", async () => {
    const { user, c, fecha } = await setup("calendar", async (dbs, id, f) => { must(await dbs.addRow(id, { title: "Reunión", values: { [f]: "2026-03-10T09:30" } })); });
    const { fireEvent } = await import("@testing-library/react");
    const input = screen.getByLabelText("Cambiar fecha de Reunión") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "2026-03-12" } });
    await waitFor(() => expect(c.getSnapshot().result!.rows[0]!.values[fecha]).toEqual({ start: "2026-03-12T09:30" }));
    void user;
  });
  it("se puede elegir qué propiedad de fecha usa la vista", async () => {
    const { c, dbs, dbId, user } = await setup("calendar", async (dbs, id, f) => { must(await dbs.addRow(id, { title: "R", values: { [f]: "2026-03-10" } })); });
    const otra = must(await dbs.addProperty(dbId, { name: "Entrega", type: "date" }));
    await c.refresh();
    await choose(user, await screen.findByLabelText("Propiedad de fecha"), otra.id);
    await waitFor(() => expect(c.getSnapshot().views.find((v) => v.id === c.getSnapshot().activeViewId)!.config.dateProperty).toBe(otra.id));
  });
});

describe("línea de tiempo (T-275, T-276)", () => {
  it("dibuja una barra por fila con rango, con su inicio y fin", async () => {
    await setup("timeline", async (dbs, id, f) => {
      must(await dbs.addRow(id, { title: "Fase 1", values: { [f]: { start: "2026-03-05", end: "2026-03-09" } } }));
      must(await dbs.addRow(id, { title: "Hito", values: { [f]: "2026-03-12" } }));
    });
    const bar = screen.getByRole("button", { name: /Fase 1: 2026-03-05 → 2026-03-09/ });
    expect(bar).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Hito: 2026-03-12/ })).toBeInTheDocument();
    // la barra del rango es más ancha que la de un solo día
    expect(parseFloat(bar.style.width)).toBeGreaterThan(parseFloat(screen.getByRole("button", { name: /^Hito: / }).style.width));
  });
  it("las filas sin fecha no aparecen en el eje", async () => {
    await setup("timeline", async (dbs, id) => { must(await dbs.addRow(id, { title: "Sin fecha" })); });
    expect(screen.queryByRole("button", { name: /Sin fecha:/ })).toBeNull();
    expect(screen.getByRole("region", { name: "Sin fecha" })).toBeInTheDocument();
  });
  it("cambiar inicio y fin con los campos (alternativa accesible a arrastrar y redimensionar)", async () => {
    const { c, fecha } = await setup("timeline", async (dbs, id, f) => { must(await dbs.addRow(id, { title: "Fase", values: { [f]: { start: "2026-03-05", end: "2026-03-09" } } })); });
    const { fireEvent } = await import("@testing-library/react");
    fireEvent.change(screen.getByLabelText("Fin de Fase") as HTMLInputElement, { target: { value: "2026-03-14" } });
    await waitFor(() => expect(c.getSnapshot().result!.rows[0]!.values[fecha]).toEqual({ start: "2026-03-05", end: "2026-03-14" }));
    fireEvent.change(screen.getByLabelText("Inicio de Fase") as HTMLInputElement, { target: { value: "2026-03-08" } });
    await waitFor(() => expect(c.getSnapshot().result!.rows[0]!.values[fecha]).toEqual({ start: "2026-03-08", end: "2026-03-14" }));
  });
});

describe("cronograma con el estándar (U-215, U-216)", () => {
  const seed = async (dbs: DatabaseService, id: string, f: string) => { must(await dbs.addRow(id, { title: "Fase", values: { [f]: { start: "2026-03-10", end: "2026-03-20" } } })); };
  it("dibuja la línea de «hoy» dentro del rango y las barras usan tokens (sin colores sueltos)", async () => {
    await setup("timeline", seed);
    expect(document.querySelector("[data-today-line]")).toBeTruthy();
    const bar = screen.getByRole("button", { name: /Fase:/ });
    expect(bar.className).toContain("var(--c-accent)");
    expect(bar.className).not.toMatch(/#[0-9a-f]{3,6}|text-white/i);
  });
  it("hacer clic en una barra abre un panel lateral con el detalle", async () => {
    const { user } = await setup("timeline", seed);
    await user.click(screen.getByRole("button", { name: /Fase:/ }));
    const panel = await screen.findByRole("complementary", { name: "Fase" });
    expect(panel).toHaveTextContent("2026-03-10");
    expect(panel).toHaveTextContent("2026-03-20");
  });
  it("Escape cierra el panel y devuelve el foco a la barra", async () => {
    const { user } = await setup("timeline", seed);
    const bar = screen.getByRole("button", { name: /Fase:/ });
    await user.click(bar);
    await screen.findByRole("complementary", { name: "Fase" });
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("complementary")).toBeNull());
    expect(bar).toHaveFocus();
  });
});
