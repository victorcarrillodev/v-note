// T-264…T-268 (prueba primero): vista de tabla con edición de celdas de cada tipo, propiedades y selector de vistas.
import { describe, it, expect } from "vitest";
import { screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FakeClock, migrate, migrations, DatabaseService } from "@vnote/core";
import { createNodeSqliteStore } from "../../../core/tests/support/nodeSqliteStore";
import { renderWithI18n } from "../../tests/renderWithI18n";
import { DatabaseController } from "./databaseController";
import { DatabaseView } from "./DatabaseView";
import { choose } from "../../tests/dropdown";

const must = <T,>(r: { ok: boolean; value?: T; error?: { message: string } }): T => { if (!r.ok) throw new Error(r.error?.message); return r.value as T; };

async function setup(seed?: (dbs: DatabaseService, dbId: string) => Promise<void>) {
  const store = await createNodeSqliteStore(":memory:");
  await migrate(store, migrations);
  const clock = new FakeClock(Date.UTC(2026, 2, 5, 12));
  const dbs = new DatabaseService(store, clock);
  const d = must(await dbs.createDatabase({ name: "Gastos" }));
  await seed?.(dbs, d.id);
  const c = (await DatabaseController.forPage(store, clock, d.pageId!))!;
  await renderWithI18n(<DatabaseView controller={c} />);
  return { c, dbs, dbId: d.id, user: userEvent.setup() };
}
const cell = (row: string, col: string) => screen.getByRole("row", { name: row }).querySelector(`[data-col="${col}"]`) as HTMLElement;

describe("tabla (T-266)", () => {
  it("muestra el nombre de la base, las columnas y las filas", async () => {
    await setup(async (dbs, id) => {
      const m = must(await dbs.addProperty(id, { name: "Monto", type: "number" }));
      must(await dbs.addRow(id, { title: "Café", values: { [m.id]: 45 } }));
    });
    expect(screen.getByRole("heading", { name: "Gastos" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /Nombre/ })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /Monto/ })).toBeInTheDocument();
    expect(screen.getByRole("row", { name: /Café/ })).toBeInTheDocument();
    expect(screen.getByDisplayValue("45")).toBeInTheDocument();
  });
  it("«Nueva fila» añade una fila vacía", async () => {
    const { user } = await setup();
    await user.click(screen.getByRole("button", { name: "Nueva fila" }));
    expect(await screen.findAllByRole("row", { name: /Sin título/ })).toHaveLength(1);
  });
  it("editar el título de la fila lo guarda", async () => {
    const { user, c } = await setup(async (dbs, id) => { must(await dbs.addRow(id, { title: "viejo" })); });
    const input = screen.getByLabelText("Título de la fila viejo");
    await user.clear(input); await user.type(input, "nuevo"); await user.tab();
    await waitFor(() => expect(c.getSnapshot().result!.rows[0]!.title).toBe("nuevo"));
  });
  it("añadir una propiedad: nombre y tipo", async () => {
    const { user, c } = await setup();
    await user.click(screen.getByRole("button", { name: "Nueva propiedad" }));
    await user.type(screen.getByLabelText("Nombre de la propiedad"), "Notas");
    await choose(user, screen.getByLabelText("Tipo de propiedad"), "text");
    await user.click(screen.getByRole("button", { name: "Añadir propiedad" }));
    await waitFor(() => expect(c.getSnapshot().properties.map((p) => p.name)).toEqual(["Notas"]));
    expect(await screen.findByRole("columnheader", { name: /Notas/ })).toBeInTheDocument();
  });
  it("una propiedad con nombre repetido muestra el error", async () => {
    const { user } = await setup(async (dbs, id) => { must(await dbs.addProperty(id, { name: "Notas", type: "text" })); });
    await user.click(screen.getByRole("button", { name: "Nueva propiedad" }));
    await user.type(screen.getByLabelText("Nombre de la propiedad"), "notas");
    await user.click(screen.getByRole("button", { name: "Añadir propiedad" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/ya existe/i);
  });
  it("renombrar y borrar una propiedad desde su encabezado", async () => {
    const { user, c } = await setup(async (dbs, id) => { must(await dbs.addProperty(id, { name: "Viejo", type: "text" })); });
    await user.click(screen.getByRole("button", { name: "Opciones de la propiedad Viejo" }));
    const name = await screen.findByLabelText("Nuevo nombre de la propiedad");
    await user.clear(name); await user.type(name, "Nuevo"); await user.click(screen.getByRole("button", { name: "Renombrar" }));
    await waitFor(() => expect(c.getSnapshot().properties[0]!.name).toBe("Nuevo"));
    await user.click(screen.getByRole("button", { name: "Opciones de la propiedad Nuevo" }));
    await user.click(await screen.findByRole("button", { name: "Eliminar propiedad" }));
    await waitFor(() => expect(c.getSnapshot().properties).toEqual([]));
  });
});

describe("editores de celda de cada tipo (T-268)", () => {
  it("texto y número; un número inválido muestra el error y conserva el valor", async () => {
    const { user, c, dbId } = await setup(async (dbs, id) => {
      must(await dbs.addProperty(id, { name: "Nota", type: "text" })); must(await dbs.addProperty(id, { name: "Monto", type: "number" }));
      must(await dbs.addRow(id, { title: "Fila" }));
    });
    const props = c.getSnapshot().properties; const [nota, monto] = [props[0]!, props[1]!];
    const t = within(cell("Fila", nota.id)).getByRole("textbox"); await user.type(t, "hola"); await user.tab();
    await waitFor(() => expect(c.getSnapshot().result!.rows[0]!.values[nota.id]).toBe("hola"));
    const n = within(cell("Fila", monto.id)).getByRole("textbox"); await user.type(n, "12"); await user.tab();
    await waitFor(() => expect(c.getSnapshot().result!.rows[0]!.values[monto.id]).toBe(12));
    await user.clear(n); await user.type(n, "abc"); await user.tab();
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(c.getSnapshot().result!.rows[0]!.values[monto.id]).toBe(12);
    void dbId;
  });
  it("casilla", async () => {
    const { user, c } = await setup(async (dbs, id) => { must(await dbs.addProperty(id, { name: "Pagado", type: "checkbox" })); must(await dbs.addRow(id, { title: "F" })); });
    const p = c.getSnapshot().properties[0]!;
    await user.click(within(cell("F", p.id)).getByRole("checkbox"));
    await waitFor(() => expect(c.getSnapshot().result!.rows[0]!.values[p.id]).toBe(true));
  });
  it("selección y estado", async () => {
    const { user, c } = await setup(async (dbs, id) => {
      must(await dbs.addProperty(id, { name: "Prio", type: "select", config: { options: [{ id: "a", name: "Alta" }, { id: "b", name: "Baja" }] } }));
      must(await dbs.addProperty(id, { name: "Estado", type: "status" })); must(await dbs.addRow(id, { title: "F" }));
    });
    const [prio, st] = c.getSnapshot().properties;
    await choose(user, within(cell("F", prio!.id)).getByRole("combobox"), "a");
    await choose(user, within(cell("F", st!.id)).getByRole("combobox"), "in_progress");
    await waitFor(() => { const v = c.getSnapshot().result!.rows[0]!.values; expect([v[prio!.id], v[st!.id]]).toEqual(["a", "in_progress"]); });
  });
  it("selección múltiple", async () => {
    const { user, c } = await setup(async (dbs, id) => {
      must(await dbs.addProperty(id, { name: "Etq", type: "multi_select", config: { options: [{ id: "x", name: "X" }, { id: "y", name: "Y" }] } })); must(await dbs.addRow(id, { title: "F" }));
    });
    const p = c.getSnapshot().properties[0]!;
    const box = within(cell("F", p.id));
    await user.click(box.getByRole("checkbox", { name: "X" })); await user.click(box.getByRole("checkbox", { name: "Y" }));
    await waitFor(() => expect(c.getSnapshot().result!.rows[0]!.values[p.id]).toEqual(["x", "y"]));
  });
  it("fecha", async () => {
    const { c } = await setup(async (dbs, id) => { must(await dbs.addProperty(id, { name: "Fecha", type: "date" })); must(await dbs.addRow(id, { title: "F" })); });
    const p = c.getSnapshot().properties[0]!;
    const input = within(cell("F", p.id)).getByLabelText(/Fecha de inicio/) as HTMLInputElement;
    const { fireEvent } = await import("@testing-library/react");
    fireEvent.change(input, { target: { value: "2026-04-01" } }); fireEvent.blur(input);
    await waitFor(() => expect(c.getSnapshot().result!.rows[0]!.values[p.id]).toEqual({ start: "2026-04-01" }));
  });
  it("enlace web, correo y teléfono validan", async () => {
    const { user, c } = await setup(async (dbs, id) => {
      must(await dbs.addProperty(id, { name: "Web", type: "url" })); must(await dbs.addProperty(id, { name: "Mail", type: "email" })); must(await dbs.addRow(id, { title: "F" }));
    });
    const [web, mail] = c.getSnapshot().properties;
    await user.type(within(cell("F", web!.id)).getByRole("textbox"), "https://example.com"); await user.tab();
    await user.type(within(cell("F", mail!.id)).getByRole("textbox"), "no-es-correo"); await user.tab();
    await waitFor(() => expect(c.getSnapshot().result!.rows[0]!.values[web!.id]).toBe("https://example.com"));
    expect(await screen.findByRole("alert")).toHaveTextContent(/correo/i);
  });
  it("las propiedades calculadas son de solo lectura; un error de fórmula se muestra en su celda y no en las demás", async () => {
    const { c } = await setup(async (dbs, id) => {
      const a = must(await dbs.addProperty(id, { name: "A", type: "number" })); const b = must(await dbs.addProperty(id, { name: "B", type: "number" }));
      must(await dbs.addFormula(id, { name: "Ratio", expression: 'prop("A") / prop("B")' }));
      must(await dbs.addRow(id, { title: "ok", values: { [a.id]: 10, [b.id]: 2 } })); must(await dbs.addRow(id, { title: "mal", values: { [a.id]: 1, [b.id]: 0 } }));
    });
    const ratio = c.getSnapshot().properties.find((p) => p.name === "Ratio")!;
    expect(within(cell("ok", ratio.id)).getByText("5")).toBeInTheDocument();
    expect(within(cell("mal", ratio.id)).getByText(/cero/i)).toBeInTheDocument();
    expect(within(cell("ok", ratio.id)).queryByRole("textbox")).toBeNull();
  });
});

describe("selector de vistas (T-265)", () => {
  it("lista las vistas como pestañas, permite crear una y cambiar entre ellas", async () => {
    const { user, c } = await setup(async (dbs, id) => { must(await dbs.addRow(id, { title: "Fila" })); });
    expect(screen.getByRole("tab", { name: "Tabla" })).toHaveAttribute("aria-selected", "true");
    await choose(user, screen.getByLabelText("Tipo de vista nueva"), "list");
    await user.click(screen.getByRole("button", { name: "Nueva vista" }));
    await waitFor(() => expect(c.getSnapshot().views.map((v) => v.type)).toEqual(["table", "list"]));
    expect(screen.getByRole("tab", { name: "Lista" })).toHaveAttribute("aria-selected", "true");
    await user.click(screen.getByRole("tab", { name: "Tabla" }));
    expect(screen.getByRole("tab", { name: "Tabla" })).toHaveAttribute("aria-selected", "true");
  });
});

describe("virtualización (T-267)", () => {
  it("con miles de filas solo se pintan unas pocas", async () => {
    const { c } = await setup(async (dbs, id) => {
      for (let i = 0; i < 300; i++) must(await dbs.addRow(id, { title: `Fila ${i}` }));
    });
    expect(c.getSnapshot().result!.rows).toHaveLength(300);
    expect(screen.getAllByRole("row").length).toBeLessThan(80);
  }, 60_000);
});

describe("propiedad de fecha como tarea (T-309, T-292)", () => {
  async function withTaskDate() {
    const ctx = await setup(async (dbs, id) => { must(await dbs.addProperty(id, { name: "Entrega", type: "date" })); must(await dbs.addRow(id, { title: "Informe" })); });
    return ctx;
  }
  it("desde el menú de la propiedad se marca como tarea y aparecen el recordatorio y la repetición", async () => {
    const { user, c } = await withTaskDate();
    const p = c.getSnapshot().properties[0]!;
    expect(within(cell("Informe", p.id)).queryByLabelText(/Recordatorio/)).toBeNull();
    await user.click(screen.getByRole("button", { name: "Opciones de la propiedad Entrega" }));
    await user.click(await screen.findByRole("checkbox", { name: "Usar como tarea" }));
    await waitFor(() => expect(c.getSnapshot().properties[0]!.config.asTask).toBe(true));
    expect(within(cell("Informe", p.id)).getByLabelText(/Recordatorio/)).toBeInTheDocument();
    expect(within(cell("Informe", p.id)).getByLabelText("Repetir")).toBeInTheDocument();
  });
  it("fijar fecha, recordatorio y repetición los guarda en el valor de la celda", async () => {
    const { c, dbs, dbId } = await withTaskDate();
    const p = c.getSnapshot().properties[0]!;
    must(await dbs.updatePropertyConfig(p.id, { asTask: true }));
    await c.refresh();
    const { fireEvent } = await import("@testing-library/react");
    const box = within(cell("Informe", p.id));
    fireEvent.change(box.getByLabelText(/Fecha de inicio/), { target: { value: "2026-03-10" } });
    await waitFor(() => expect(c.getSnapshot().result!.rows[0]!.values[p.id]).toEqual({ start: "2026-03-10" }));
    fireEvent.change(within(cell("Informe", p.id)).getByLabelText(/Recordatorio/), { target: { value: "2026-03-09T08:00" } });
    await waitFor(() => expect(c.getSnapshot().result!.rows[0]!.values[p.id]).toMatchObject({ start: "2026-03-10", remind: "2026-03-09T08:00" }));
    await choose(userEvent.setup(), within(cell("Informe", p.id)).getByLabelText("Repetir"), "weekly");
    await waitFor(() => expect(c.getSnapshot().result!.rows[0]!.values[p.id]).toMatchObject({ repeat: { freq: "weekly", interval: 1 } }));
    void dbId;
  });
  it("al cambiar la celda, la tarea se indexa sola (aparece en la agenda)", async () => {
    const { c, dbs, dbId } = await withTaskDate();
    const p = c.getSnapshot().properties[0]!;
    must(await dbs.updatePropertyConfig(p.id, { asTask: true }));
    await c.refresh();
    const row = c.getSnapshot().result!.rows[0]!;
    must(await c.setCell(row.pageId, p.id, { start: "2026-03-10", remind: "2026-03-09T08:00" }));
    const tasks = await c.listTasks();
    expect(tasks.map((t) => t.title)).toEqual(["Informe"]);
    expect(tasks[0]).toMatchObject({ due: "2026-03-10", remindAt: "2026-03-09T08:00", source: "row", databaseId: dbId });
  });
});

describe("escribir y confirmar sin pausa", () => {
  it("Enter justo después de escribir guarda el texto que hay en el campo, no uno anterior", async () => {
    const { c } = await setup(async (dbs, id) => { must(await dbs.addProperty(id, { name: "Nota", type: "text" })); must(await dbs.addRow(id, { title: "F" })); });
    const p = c.getSnapshot().properties[0]!;
    const input = within(cell("F", p.id)).getByRole("textbox") as HTMLInputElement;
    const { fireEvent } = await import("@testing-library/react");
    // Se cambia el valor del DOM y se confirma sin dar tiempo a que React vuelva a pintar con el borrador nuevo
    input.focus();
    input.value = "rápido";
    fireEvent.blur(input);
    await waitFor(() => expect(c.getSnapshot().result!.rows[0]!.values[p.id]).toBe("rápido"));
  });
});
