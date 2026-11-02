// Recordatorios en la aplicación (RF-11, RF-12): resumen global al abrir, tic con notificaciones y acceso desde la barra lateral.
import { describe, it, expect } from "vitest";
import * as Y from "yjs";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nextProvider } from "react-i18next";
import { FakeClock, PageService, WorkspaceManager, toYjs, type Block } from "@vnote/core";
import { MemoryConfigStore, MemoryWorkspaceStorage } from "../../../core/tests/support/memoryPorts";
import { createI18n } from "../i18n";
import { MemoryNotifier } from "../reminders/notifier";
import { MemoryPreferences } from "../theme/theme";
import { App } from "./App";

const task = (id: string, title: string, props: Record<string, unknown>): Block => ({ id, type: "task", props: { checked: false, due: "", remindAt: "", recurrence: "", ...props }, content: [{ type: "text", text: title, styles: {} }], children: [] });

async function mount(blocks: Block[], opts: { now?: string } = {}) {
  const clock = new FakeClock(Date.UTC(2026, 2, 5, 10, 0));
  const workspaces = new WorkspaceManager(new MemoryConfigStore(), new MemoryWorkspaceStorage(), clock);
  const w = await workspaces.create({ name: "Personal" });
  if (!w.ok) throw new Error("x");
  const o = await workspaces.open(w.value.id);
  if (!o.ok) throw new Error("x");
  const pages = new PageService(o.value.store, clock);
  const p = await pages.create({ title: "Mi nota" });
  if (!p.ok) throw new Error("x");
  const d = new Y.Doc(); toYjs(blocks, d.getXmlFragment("doc"));
  await pages.saveUpdate(p.value.id, Y.encodeStateAsUpdate(d));
  const notifier = new MemoryNotifier("granted");
  const tickers = new Set<() => void>();
  const i18n = await createI18n();
  render(
    <I18nextProvider i18n={i18n}>
      <App
        services={{ workspaces, clock, reminders: { notifier, nowLocal: () => opts.now ?? "2026-03-05T10:00", onTick: (cb) => { tickers.add(cb); return () => tickers.delete(cb); } } }}
        preferences={new MemoryPreferences()}
        renderPageBody={(id) => <div data-testid="editor">{id}</div>}
      />
    </I18nextProvider>,
  );
  return { notifier, tick: async () => { tickers.forEach((t) => t()); await new Promise((r) => setTimeout(r, 50)); }, user: userEvent.setup(), pageId: p.value.id };
}

describe("resumen al abrir (T-312)", () => {
  it("si hay vencidos, lo primero que se ve es el resumen con el espacio de cada uno", async () => {
    await mount([task("a", "Pagar luz", { remindAt: "2026-03-04T09:00" })]);
    expect(await screen.findByRole("heading", { name: "Recordatorios" })).toBeInTheDocument();
    expect(await screen.findByRole("list", { name: "Vencidos" })).toHaveTextContent("Personal");
  });
  it("si no hay nada pendiente se abre directamente el espacio", async () => {
    await mount([task("a", "Futura", { due: "2027-01-01" })]);
    expect(await screen.findByRole("button", { name: "Nueva página" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Recordatorios" })).toBeNull();
  });
  it("«Abrir» desde el resumen lleva a la página de la tarea", async () => {
    const { user } = await mount([task("a", "Pagar luz", { remindAt: "2026-03-04T09:00" })]);
    await user.click(within(await screen.findByRole("list", { name: "Vencidos" })).getByRole("button", { name: "Abrir Pagar luz" }));
    expect(await screen.findByTestId("editor")).toBeInTheDocument();
  });
});

describe("tic y acceso (T-306, T-308)", () => {
  it("cada tic notifica los recordatorios que llegaron, una sola vez", async () => {
    const { notifier, tick } = await mount([task("a", "Pagar luz", { remindAt: "2026-03-05T09:00" })]);
    await screen.findByRole("heading", { name: "Recordatorios" });
    await tick();
    await waitFor(() => expect(notifier.sent.map((n) => n.title)).toEqual(["Pagar luz"]));
    await tick();
    expect(notifier.sent).toHaveLength(1);
  });
  it("hay un botón «Recordatorios» en la barra lateral para volver a verlos", async () => {
    const { user } = await mount([task("a", "Futura", { due: "2027-01-01" })]);
    await user.click(await screen.findByRole("button", { name: "Recordatorios" }));
    expect(await screen.findByRole("heading", { name: "Recordatorios" })).toBeInTheDocument();
  });
});

describe("abrir la tarea desde la ventana de recordatorio (T-307)", () => {
  it("el evento «abrir tarea» abre el espacio y la página de la tarea", async () => {
    const clock = new FakeClock(Date.UTC(2026, 2, 5, 10, 0));
    const workspaces = new WorkspaceManager(new MemoryConfigStore(), new MemoryWorkspaceStorage(), clock);
    const w = await workspaces.create({ name: "Personal" });
    if (!w.ok) throw new Error("x");
    const o = await workspaces.open(w.value.id);
    if (!o.ok) throw new Error("x");
    const p = await new PageService(o.value.store, clock).create({ title: "Mi nota" });
    if (!p.ok) throw new Error("x");
    let fire: (e: { workspaceId: string; pageId: string }) => void = () => {};
    const i18n = await createI18n();
    render(<I18nextProvider i18n={i18n}><App services={{ workspaces, clock, onOpenTask: (cb) => { fire = cb; return () => {}; } }} preferences={new MemoryPreferences()} renderPageBody={(id) => <div data-testid="editor">{id}</div>} /></I18nextProvider>);
    await screen.findByRole("button", { name: "Nueva página" });
    fire({ workspaceId: w.value.id, pageId: p.value.id });
    expect(await screen.findByTestId("editor")).toHaveTextContent(p.value.id);
  });
});
