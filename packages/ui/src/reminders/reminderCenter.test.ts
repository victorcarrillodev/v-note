// T-306…T-313 (prueba primero): centro de recordatorios — tic con notificaciones, permiso, resumen global, acciones sobre vencidos.
import { describe, it, expect, beforeEach } from "vitest";
import * as Y from "yjs";
import { FakeClock, PageService, WorkspaceManager, toYjs, type Block } from "@vnote/core";
import { MemoryConfigStore, MemoryWorkspaceStorage } from "../../../core/tests/support/memoryPorts";
import { MemoryNotifier } from "./notifier";
import { ReminderCenter } from "./reminderCenter";

const task = (id: string, title: string, props: Record<string, unknown>): Block => ({ id, type: "task", props: { checked: false, due: "", remindAt: "", recurrence: "", ...props }, content: [{ type: "text", text: title, styles: {} }], children: [] });
const upd = (blocks: Block[]) => { const d = new Y.Doc(); toYjs(blocks, d.getXmlFragment("doc")); return Y.encodeStateAsUpdate(d); };

let workspaces: WorkspaceManager, clock: FakeClock, notifier: MemoryNotifier, center: ReminderCenter, now: string;
async function addWs(name: string, blocks: Block[]) {
  const w = await workspaces.create({ name });
  if (!w.ok) throw new Error("x");
  const opened = await workspaces.open(w.value.id);
  if (!opened.ok) throw new Error("x");
  const pages = new PageService(opened.value.store, clock);
  const p = await pages.create({ title: `Nota de ${name}` });
  if (!p.ok) throw new Error("x");
  await pages.saveUpdate(p.value.id, upd(blocks));
  return { id: w.value.id, pageId: p.value.id, store: opened.value.store, pages };
}
beforeEach(() => {
  clock = new FakeClock(Date.UTC(2026, 2, 5, 10, 0));
  workspaces = new WorkspaceManager(new MemoryConfigStore(), new MemoryWorkspaceStorage(), clock);
  notifier = new MemoryNotifier("granted");
  now = "2026-03-05T10:00";
  center = new ReminderCenter({ workspaces, clock, notifier, nowLocal: () => now });
});

describe("la notificación identifica la tarea (T-307)", () => {
  it("lleva el espacio y la página para poder abrirla desde la ventana de recordatorio", async () => {
    const ws = await addWs("Personal", [task("a", "Pagar luz", { remindAt: "2026-03-05T09:00", due: "2026-03-06" })]);
    await center.tick();
    expect(notifier.sent[0]).toMatchObject({ workspaceId: ws.id, pageId: ws.pageId });
  });
});

describe("tic: notificaciones (T-306, T-308)", () => {
  it("notifica los recordatorios nuevos con el título de la tarea, una sola vez", async () => {
    await addWs("Personal", [task("a", "Pagar luz", { remindAt: "2026-03-05T09:00", due: "2026-03-06" })]);
    await center.tick();
    expect(notifier.sent).toHaveLength(1);
    expect(notifier.sent[0]).toMatchObject({ title: "Pagar luz" });
    await center.tick();
    expect(notifier.sent).toHaveLength(1); // no se repite
  });
  it("no notifica lo que aún no llegó", async () => {
    await addWs("Personal", [task("a", "Luego", { remindAt: "2026-03-05T18:00" })]);
    await center.tick();
    expect(notifier.sent).toHaveLength(0);
    now = "2026-03-05T18:00";
    await center.tick();
    expect(notifier.sent).toHaveLength(1);
  });
  it("muchos vencidos a la vez producen una sola notificación agrupada (CL-14)", async () => {
    await addWs("Personal", Array.from({ length: 15 }, (_, i) => task(`t${i}`, `Tarea ${i}`, { remindAt: "2026-03-04T09:00" })));
    await center.tick();
    expect(notifier.sent).toHaveLength(1);
    expect(notifier.sent[0]!.body).toMatch(/15/);
  });
  it("recorre todos los espacios, aunque no estén abiertos", async () => {
    await addWs("A", [task("a", "Del A", { remindAt: "2026-03-05T09:00" })]);
    await addWs("B", [task("b", "Del B", { remindAt: "2026-03-05T09:30" })]);
    await center.tick();
    expect(notifier.sent.map((n) => n.title).sort()).toEqual(["Del A", "Del B"]);
  });
  it("con el permiso bloqueado no notifica, avisa una sola vez, y los recordatorios siguen como vencidos (T-305)", async () => {
    notifier = new MemoryNotifier("denied");
    center = new ReminderCenter({ workspaces, clock, notifier, nowLocal: () => now });
    await addWs("Personal", [task("a", "Pagar luz", { remindAt: "2026-03-05T09:00" })]);
    await center.tick();
    expect(notifier.sent).toHaveLength(0);
    expect(center.getSnapshot().permissionWarning).toBe(true);
    center.dismissPermissionWarning();
    await center.tick();
    expect(center.getSnapshot().permissionWarning).toBe(false); // ya se avisó una vez
    expect((await center.summary()).overdue.map((o) => o.task.title)).toEqual(["Pagar luz"]);
  });
  it("si el permiso aún no se decidió, lo pide antes de notificar", async () => {
    notifier = new MemoryNotifier("prompt", "granted");
    center = new ReminderCenter({ workspaces, clock, notifier, nowLocal: () => now });
    await addWs("Personal", [task("a", "Pagar luz", { remindAt: "2026-03-05T09:00" })]);
    await center.tick();
    expect(notifier.requested).toBe(1);
    expect(notifier.sent).toHaveLength(1);
  });
});

describe("resumen global al abrir (T-312, RF-12)", () => {
  it("junta vencidos y tareas de hoy de todos los espacios indicando el espacio de cada uno", async () => {
    await addWs("Personal", [task("a", "Vencida", { remindAt: "2026-03-04T09:00", due: "2026-03-04" }), task("b", "Para hoy", { due: "2026-03-05" }), task("c", "Mañana", { due: "2026-03-06" })]);
    await addWs("Trabajo", [task("d", "Informe", { due: "2026-03-05" })]);
    const s = await center.summary();
    expect(s.overdue.map((o) => `${o.workspace.name}:${o.task.title}`)).toEqual(["Personal:Vencida"]);
    expect(s.today.map((o) => `${o.workspace.name}:${o.task.title}`).sort()).toEqual(["Personal:Para hoy", "Trabajo:Informe"]);
  });
  it("las tareas hechas no aparecen y una tarea vencida con fecha de hoy no se duplica", async () => {
    await addWs("Personal", [task("a", "Hecha", { due: "2026-03-05", checked: true }), task("b", "Ambas", { due: "2026-03-05", remindAt: "2026-03-05T08:00" })]);
    const s = await center.summary();
    expect(s.today.map((o) => o.task.title)).toEqual([]);
    expect(s.overdue.map((o) => o.task.title)).toEqual(["Ambas"]);
  });
  it("vacío cuando no hay nada pendiente", async () => {
    await addWs("Personal", [task("a", "Futura", { due: "2026-04-01", remindAt: "2026-04-01T09:00" })]);
    const s = await center.summary();
    expect(s.overdue).toEqual([]); expect(s.today).toEqual([]);
  });
});

describe("acciones sobre vencidos (T-313)", () => {
  it("marcar como hecho escribe en la página y quita el vencido", async () => {
    const ws = await addWs("Personal", [task("a", "Vencida", { remindAt: "2026-03-05T09:00" })]);
    const item = (await center.summary()).overdue[0]!;
    await center.complete(item.workspace.id, item.task.id);
    expect((await center.summary()).overdue).toEqual([]);
    const row = (await ws.store.query<{ done: number }>("SELECT done FROM tasks WHERE block_id = 'a'"))[0]!;
    expect(row.done).toBe(1);
  });
  it("marcar como hecha una tarea recurrente programa la siguiente en la página", async () => {
    const ws = await addWs("Personal", [task("a", "Diaria", { due: "2026-03-05", remindAt: "2026-03-05T09:00", recurrence: JSON.stringify({ freq: "daily", interval: 1 }) })]);
    const item = (await center.summary()).overdue[0]!;
    await center.complete(item.workspace.id, item.task.id);
    const t = (await ws.store.query<{ due: string; remind_at: string; done: number }>("SELECT due, remind_at, done FROM tasks WHERE block_id = 'a'"))[0]!;
    expect(t).toMatchObject({ due: "2026-03-06", remind_at: "2026-03-06T09:00", done: 0 });
  });
  it("posponer lo oculta hasta su hora y descartar lo quita", async () => {
    await addWs("Personal", [task("a", "Una", { remindAt: "2026-03-05T09:00" }), task("b", "Otra", { remindAt: "2026-03-05T09:00" })]);
    const [a, b] = (await center.summary()).overdue;
    await center.snooze(a!.workspace.id, a!.task.id, "1h");
    await center.dismiss(b!.workspace.id, b!.task.id);
    expect((await center.summary()).overdue).toEqual([]);
    now = "2026-03-05T11:00";
    expect((await center.summary()).overdue.map((o) => o.task.title)).toEqual([a!.task.title]);
  });
  it("notifica a los suscriptores cuando cambia el estado (la interfaz se refresca al instante)", async () => {
    await addWs("Personal", [task("a", "Una", { remindAt: "2026-03-05T09:00" })]);
    let calls = 0;
    center.subscribe(() => calls++);
    const it = (await center.summary()).overdue[0]!;
    await center.dismiss(it.workspace.id, it.task.id);
    expect(calls).toBeGreaterThan(0);
  });
});

describe("agenda por espacio (T-311, RF-12)", () => {
  it("lista las tareas del espacio ordenadas por fecha, sin mezclar otros espacios", async () => {
    const a = await addWs("A", [task("1", "Tarde", { due: "2026-03-20" }), task("2", "Temprano", { due: "2026-03-07" })]);
    await addWs("B", [task("3", "Ajena", { due: "2026-03-01" })]);
    expect((await center.agenda(a.id)).map((t) => t.title)).toEqual(["Temprano", "Tarde"]);
  });
});
