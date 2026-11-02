// T-311…T-313 (prueba primero): vista de recordatorios — vencidos con acciones, tareas de hoy y agenda del espacio.
import { describe, it, expect, vi } from "vitest";
import * as Y from "yjs";
import { screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FakeClock, PageService, WorkspaceManager, toYjs, type Block } from "@vnote/core";
import { MemoryConfigStore, MemoryWorkspaceStorage } from "../../../core/tests/support/memoryPorts";
import { renderWithI18n } from "../../tests/renderWithI18n";
import { MemoryNotifier } from "./notifier";
import { ReminderCenter } from "./reminderCenter";
import { RemindersView } from "./RemindersView";

const task = (id: string, title: string, props: Record<string, unknown>): Block => ({ id, type: "task", props: { checked: false, due: "", remindAt: "", recurrence: "", ...props }, content: [{ type: "text", text: title, styles: {} }], children: [] });
const upd = (blocks: Block[]) => { const d = new Y.Doc(); toYjs(blocks, d.getXmlFragment("doc")); return Y.encodeStateAsUpdate(d); };

async function setup(spec: Record<string, Block[]>, active?: string) {
  const clock = new FakeClock(Date.UTC(2026, 2, 5, 10, 0));
  const workspaces = new WorkspaceManager(new MemoryConfigStore(), new MemoryWorkspaceStorage(), clock);
  const ids: Record<string, string> = {};
  for (const [name, blocks] of Object.entries(spec)) {
    const w = await workspaces.create({ name }); if (!w.ok) throw new Error("x");
    ids[name] = w.value.id;
    const o = await workspaces.open(w.value.id); if (!o.ok) throw new Error("x");
    const pages = new PageService(o.value.store, clock);
    const p = await pages.create({ title: `Nota ${name}` }); if (!p.ok) throw new Error("x");
    await pages.saveUpdate(p.value.id, upd(blocks));
  }
  let now = "2026-03-05T10:00";
  const center = new ReminderCenter({ workspaces, clock, notifier: new MemoryNotifier("granted"), nowLocal: () => now });
  const onOpen = vi.fn();
  await renderWithI18n(<RemindersView center={center} activeWorkspaceId={ids[active ?? Object.keys(spec)[0]!]!} onOpen={onOpen} />);
  return { center, onOpen, ids, user: userEvent.setup(), setNow: (v: string) => { now = v; } };
}

describe("vencidos y de hoy (T-312)", () => {
  it("muestra los vencidos de todos los espacios con el nombre de cada espacio", async () => {
    await setup({ Personal: [task("a", "Pagar luz", { remindAt: "2026-03-04T09:00" })], Trabajo: [task("b", "Entregar informe", { remindAt: "2026-03-05T08:00" })] });
    const list = await screen.findByRole("list", { name: "Vencidos" });
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(list).toHaveTextContent("Pagar luz");
    expect(list).toHaveTextContent("Personal");
    expect(list).toHaveTextContent("Trabajo");
  });
  it("muestra las tareas de hoy aparte", async () => {
    await setup({ Personal: [task("a", "Cena", { due: "2026-03-05" })] });
    const list = await screen.findByRole("list", { name: "Hoy" });
    expect(within(list).getByText("Cena")).toBeInTheDocument();
  });
  it("sin nada pendiente lo dice", async () => {
    await setup({ Personal: [task("a", "Futura", { due: "2026-04-01" })] });
    expect(await screen.findByText("No tienes recordatorios vencidos ni tareas para hoy.")).toBeInTheDocument();
  });
});

describe("acciones sobre un vencido (T-307, T-313)", () => {
  it("«Abrir» lleva a la tarea (espacio y página)", async () => {
    const { user, onOpen, ids } = await setup({ Personal: [task("a", "Pagar luz", { remindAt: "2026-03-04T09:00" })] });
    await user.click(within(await screen.findByRole("list", { name: "Vencidos" })).getByRole("button", { name: "Abrir Pagar luz" }));
    expect(onOpen).toHaveBeenCalledWith(ids.Personal, expect.any(String));
  });
  it("«Hecho» lo quita de la lista al instante", async () => {
    const { user } = await setup({ Personal: [task("a", "Pagar luz", { remindAt: "2026-03-04T09:00" })] });
    await user.click(within(await screen.findByRole("list", { name: "Vencidos" })).getByRole("button", { name: "Marcar como hecho Pagar luz" }));
    await waitFor(() => expect(screen.queryByRole("list", { name: "Vencidos" })).toBeNull());
  });
  it("«Posponer» ofrece 10 minutos, 1 hora o mañana, y lo oculta", async () => {
    const { user } = await setup({ Personal: [task("a", "Pagar luz", { remindAt: "2026-03-04T09:00" })] });
    const sel = await screen.findByLabelText("Posponer Pagar luz");
    expect([...sel.querySelectorAll("option")].map((o) => o.textContent)).toEqual(["Posponer…", "10 minutos", "1 hora", "Hasta mañana"]);
    await user.selectOptions(sel, "1h");
    await waitFor(() => expect(screen.queryByRole("list", { name: "Vencidos" })).toBeNull());
  });
  it("«Descartar» lo quita sin marcar la tarea", async () => {
    const { user } = await setup({ Personal: [task("a", "Pagar luz", { remindAt: "2026-03-04T09:00" })] });
    await user.click(within(await screen.findByRole("list", { name: "Vencidos" })).getByRole("button", { name: "Descartar Pagar luz" }));
    await waitFor(() => expect(screen.queryByRole("list", { name: "Vencidos" })).toBeNull());
  });
  it("una tarea con varias repeticiones acumuladas muestra una sola entrada indicando cuántas se perdieron", async () => {
    await setup({ Personal: [task("a", "Diaria", { due: "2026-03-01", remindAt: "2026-03-01T09:00", recurrence: JSON.stringify({ freq: "daily", interval: 1 }) })] });
    const list = await screen.findByRole("list", { name: "Vencidos" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(1);
    expect(list).toHaveTextContent(/4 repeticiones/);
  });
});

describe("agenda del espacio activo (T-311)", () => {
  it("lista las tareas del espacio activo por fecha, sin las de otros espacios", async () => {
    await setup({ Personal: [task("a", "Tarde", { due: "2026-03-20" }), task("b", "Temprano", { due: "2026-03-07" })], Trabajo: [task("c", "Ajena", { due: "2026-03-08" })] }, "Personal");
    const agenda = await screen.findByRole("list", { name: "Agenda" });
    expect(within(agenda).getAllByRole("listitem").map((l) => l.textContent)).toEqual([expect.stringContaining("Temprano"), expect.stringContaining("Tarde")]);
    expect(within(agenda).queryByText("Ajena")).toBeNull();
  });
});
