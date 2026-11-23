// T-283…T-286 (prueba primero): vista de tablero kanban sobre una base de datos con propiedad de estado.
import { describe, it, expect } from "vitest";
import { screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FakeClock, migrate, migrations, BoardService, DatabaseService, ViewService } from "@vnote/core";
import { createNodeSqliteStore } from "../../../core/tests/support/nodeSqliteStore";
import { renderWithI18n } from "../../tests/renderWithI18n";
import { DatabaseController } from "./databaseController";
import { DatabaseView } from "./DatabaseView";
import { ToastProvider } from "../feedback/ToastContext";
import { choose } from "../../tests/dropdown";

const must = <T,>(r: { ok: boolean; value?: T; error?: { message: string } }): T => { if (!r.ok) throw new Error(r.error?.message); return r.value as T; };

async function setup(seed?: (b: BoardService, dbId: string, dbs: DatabaseService) => Promise<void>) {
  const store = await createNodeSqliteStore(":memory:");
  await migrate(store, migrations);
  const clock = new FakeClock(Date.UTC(2026, 2, 5, 12));
  const dbs = new DatabaseService(store, clock), views = new ViewService(store), boards = new BoardService(dbs, views);
  const b = must(await boards.createBoard({ name: "Proyecto" }));
  await seed?.(boards, b.databaseId, dbs);
  const c = (await DatabaseController.forPage(store, clock, b.pageId))!;
  const opened: string[] = [];
  await renderWithI18n(<ToastProvider><DatabaseView controller={c} onOpenRow={(id) => opened.push(id)} /></ToastProvider>);
  return { c, boards, dbId: b.databaseId, opened, user: userEvent.setup() };
}
const column = (name: string) => screen.getByRole("group", { name });
const cardsIn = (name: string) => within(column(name)).queryAllByRole("article").map((a) => a.getAttribute("aria-label"));

describe("tablero (T-283)", () => {
  it("al abrir un tablero se muestra su vista tablero con las columnas iniciales", async () => {
    await setup();
    expect(screen.getByRole("tab", { name: "Tablero", selected: true })).toBeInTheDocument();
    for (const n of ["Por hacer", "En curso", "Hecho"]) expect(column(n)).toBeInTheDocument();
  });
  it("sin tarjetas muestra el estado vacío y las columnas siguen disponibles (U-176, RF-6.7)", async () => {
    await setup();
    expect(await screen.findByText("Esta base de datos no tiene filas.")).toBeInTheDocument();
    expect(column("Por hacer")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Nueva columna" })).toBeInTheDocument();
  });
  it("muestra las tarjetas en su columna y en orden", async () => {
    await setup(async (b, id) => {
      must(await b.createCard(id, { title: "A", columnId: "todo" })); must(await b.createCard(id, { title: "B", columnId: "todo" })); must(await b.createCard(id, { title: "C", columnId: "done" }));
    });
    expect(cardsIn("Por hacer")).toEqual(["A", "B"]);
    expect(cardsIn("En curso")).toEqual([]);
    expect(cardsIn("Hecho")).toEqual(["C"]);
  });
  it("«Nueva tarjeta» crea una tarjeta (página + fila) en esa columna", async () => {
    const { user, c } = await setup();
    await user.click(within(column("En curso")).getByRole("button", { name: "Nueva tarjeta" }));
    const input = await within(column("En curso")).findByLabelText("Título de la nueva tarjeta");
    await user.type(input, "Escribir informe{Enter}");
    await waitFor(() => expect(cardsIn("En curso")).toEqual(["Escribir informe"]));
    expect(c.getSnapshot().result!.rows[0]!.title).toBe("Escribir informe");
  });
  it("mover una tarjeta con el selector de columna (alternativa accesible al arrastre) cambia su estado y persiste", async () => {
    const { user, c } = await setup(async (b, id) => { must(await b.createCard(id, { title: "A", columnId: "todo" })); });
    await choose(user, screen.getByLabelText("Mover A a"), "in_progress");
    await waitFor(() => expect(cardsIn("En curso")).toEqual(["A"]));
    expect(cardsIn("Por hacer")).toEqual([]);
    await c.refresh();
    expect(cardsIn("En curso")).toEqual(["A"]);
  });
});

describe("columnas (T-280, T-281 en la interfaz)", () => {
  it("añadir y renombrar una columna", async () => {
    const { user } = await setup();
    await user.click(screen.getByRole("button", { name: "Nueva columna" }));
    await user.type(screen.getByLabelText("Nombre de la columna nueva"), "Revisión{Enter}");
    expect(await screen.findByRole("group", { name: "Revisión" })).toBeInTheDocument();
    await user.click(within(column("Revisión")).getByRole("button", { name: "Menú de la columna Revisión" }));
    await user.click(await screen.findByRole("menuitem", { name: "Renombrar columna Revisión" }));
    const input = await screen.findByLabelText("Nuevo nombre de la columna Revisión");
    await user.clear(input); await user.type(input, "QA{Enter}");
    expect(await screen.findByRole("group", { name: "QA" })).toBeInTheDocument();
  });
  it("eliminar una columna con tarjetas pide confirmar y elegir a dónde van", async () => {
    const { user } = await setup(async (b, id) => { must(await b.createCard(id, { title: "A", columnId: "in_progress" })); });
    await user.click(within(column("En curso")).getByRole("button", { name: "Menú de la columna En curso" }));
    await user.click(await screen.findByRole("menuitem", { name: "Eliminar columna En curso" }));
    const dlg = await screen.findByRole("alertdialog");
    expect(dlg).toHaveTextContent(/1 tarjeta/);
    await choose(user, within(dlg).getByLabelText("Mover las tarjetas a"), "done");
    await user.click(within(dlg).getByRole("button", { name: "Eliminar" }));
    await waitFor(() => expect(screen.queryByRole("group", { name: "En curso" })).toBeNull());
    expect(cardsIn("Hecho")).toEqual(["A"]);
  });
  it("eliminar una columna vacía no pide nada", async () => {
    const { user } = await setup();
    await user.click(within(column("En curso")).getByRole("button", { name: "Menú de la columna En curso" }));
    await user.click(await screen.findByRole("menuitem", { name: "Eliminar columna En curso" }));
    await waitFor(() => expect(screen.queryByRole("group", { name: "En curso" })).toBeNull());
  });
});

describe("la tarjeta (T-285, T-286)", () => {
  it("muestra su fecha límite y si tiene recordatorio", async () => {
    await setup(async (b, id, dbs) => {
      const f = must(await dbs.addProperty(id, { name: "Fecha", type: "date", config: { asTask: true } }));
      const card = must(await b.createCard(id, { title: "Con fecha", columnId: "todo" }));
      must(await dbs.setCell(id, card.pageId, f.id, { start: "2026-03-10", remind: "2026-03-09T08:00" }));
      must(await b.createCard(id, { title: "Sin fecha", columnId: "todo" }));
    });
    const card = within(column("Por hacer")).getByRole("article", { name: "Con fecha" });
    expect(card).toHaveTextContent("2026-03-10");
    expect(within(card).getByLabelText("Con recordatorio")).toBeInTheDocument();
    expect(within(within(column("Por hacer")).getByRole("article", { name: "Sin fecha" })).queryByLabelText("Con recordatorio")).toBeNull();
  });
  it("abrir la tarjeta lleva a su página completa", async () => {
    const { user, opened, c } = await setup(async (b, id) => { must(await b.createCard(id, { title: "A", columnId: "todo" })); });
    await user.click(screen.getByRole("button", { name: "Abrir A" }));
    expect(opened).toEqual([c.getSnapshot().result!.rows[0]!.pageId]);
  });
  it("mover una tarjeta ofrece «Deshacer» (U-150, RF-11.1) y la devuelve a su columna", async () => {
    const { user } = await setup(async (b, id) => { must(await b.createCard(id, { title: "A", columnId: "todo" })); });
    await choose(user, screen.getByLabelText("Mover A a"), "in_progress");
    await waitFor(() => expect(cardsIn("En curso")).toEqual(["A"]));
    await user.click(await screen.findByRole("button", { name: "Deshacer" }));
    await waitFor(() => expect(cardsIn("Por hacer")).toEqual(["A"]));
    expect(cardsIn("En curso")).toEqual([]);
  });
});

describe("columnas y tarjetas con el estándar (U-204 a U-206, U-210)", () => {
  it("la columna muestra punto de color de estado, nombre, conteo, «+» y menú", async () => {
    await setup(async (b, id) => { must(await b.createCard(id, { title: "A", columnId: "todo" })); });
    const col = column("Por hacer");
    expect(col.querySelector("[data-status-dot]")).toBeTruthy();
    const head = col.querySelector("header") as HTMLElement;
    expect(within(head).getByText("Por hacer")).toBeInTheDocument();
    expect(within(head).getByText("1")).toBeInTheDocument();
    expect(within(col).getByRole("button", { name: "Añadir tarjeta en Por hacer" })).toBeInTheDocument();
    expect(within(col).getByRole("button", { name: /Menú de la columna Por hacer/ })).toBeInTheDocument();
  });
  it("una fecha límite pasada se marca «Vencida» con texto, no solo con color", async () => {
    await setup(async (b, id, dbs) => {
      const date = must(await dbs.addProperty(id, { name: "Fecha", type: "date", config: { asTask: true } }));
      const card = must(await b.createCard(id, { title: "Tarde", columnId: "todo" }));
      must(await dbs.setCell(id, card.pageId, date.id, { start: "2020-01-01" }));
    });
    const card = screen.getByRole("article", { name: "Tarde" });
    expect(within(card).getByText("Vencida")).toBeInTheDocument();
  });
  it("el tablero no ofrece puntos de historia, velocidad, asignados ni capacidad (RF-6.6)", async () => {
    await setup(async (b, id) => { must(await b.createCard(id, { title: "A", columnId: "todo" })); });
    const text = document.body.textContent ?? "";
    for (const banned of [/puntos? de historia/i, /story points?/i, /velocidad/i, /velocity/i, /asignad/i, /assignee/i, /capacidad/i, /capacity/i]) expect(text).not.toMatch(banned);
  });
});
