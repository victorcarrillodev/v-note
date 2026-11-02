// T-291, T-292, T-296…T-305 (prueba primero): tareas derivadas y recordatorios (vencidos, agrupación, posponer, hora flotante).
import { describe, it, expect, beforeEach } from "vitest";
import { createNodeSqliteStore } from "../../tests/support/nodeSqliteStore";
import { FakeClock } from "../clock";
import { migrate } from "../db/migrate";
import { migrations } from "../db/migrations";
import { defaultProps, type Block } from "../blocks/types";
import { DatabaseService } from "../databases/databaseService";
import { PageService } from "../pages/pageService";
import { PagesRepo } from "../pages/pagesRepo";
import type { SqlStore } from "../ports/sqlStore";
import { TaskService, localNow, type Task, type TaskSourceWriter } from "./taskService";

let db: SqlStore, svc: TaskService, pages: PageService, repo: PagesRepo, dbs: DatabaseService;
let page: string;
const writes: string[] = [];
const writer: TaskSourceWriter = {
  async setSchedule(t, s) { writes.push(`schedule ${t.id} due=${s.due} remind=${s.remindAt}`); },
  async setDone(t, done) { writes.push(`done ${t.id} ${done}`); },
};
const must = <T,>(r: { ok: boolean; value?: T; error?: { message: string } }): T => { if (!r.ok) throw new Error(r.error?.message); return r.value as T; };
let n = 0;
const taskBlock = (title: string, props: Record<string, unknown> = {}): Block => ({ id: `b${++n}`, type: "task", props: { checked: false, due: "", remindAt: "", recurrence: "", ...props }, content: [{ type: "text", text: title, styles: {} }], children: [] });
const para = (title: string): Block => ({ id: `b${++n}`, type: "paragraph", props: defaultProps("paragraph"), content: [{ type: "text", text: title, styles: {} }], children: [] });
let nowLocal = "2026-03-05T10:00";
beforeEach(async () => {
  db = await createNodeSqliteStore(":memory:");
  await migrate(db, migrations);
  const clock = new FakeClock(Date.UTC(2026, 2, 5, 10, 0));
  pages = new PageService(db, clock); repo = new PagesRepo(db, clock); dbs = new DatabaseService(db, clock);
  nowLocal = "2026-03-05T10:00";
  svc = new TaskService(db, clock, writer, () => nowLocal);
  writes.length = 0;
  page = must(await pages.create({ title: "Mi nota" })).id;
});
const tasks = async () => (await svc.list()).map((t) => `${t.title}|${t.due ?? ""}|${t.remindAt ?? ""}`);

describe("tareas derivadas de casillas (T-291)", () => {
  it("cada casilla con fecha crea una tarea; las demás no", async () => {
    await svc.indexPage(page, [taskBlock("Con fecha", { due: "2026-03-10" }), taskBlock("Sin fecha"), para("texto"), taskBlock("Solo aviso", { remindAt: "2026-03-06T09:00" })]);
    expect(await tasks()).toEqual(["Solo aviso||2026-03-06T09:00", "Con fecha|2026-03-10|"]); // ordenadas por fecha
  });
  it("reindexar actualiza, quita las que ya no tienen fecha y elimina las borradas", async () => {
    const a = taskBlock("A", { due: "2026-03-10" }), b = taskBlock("B", { due: "2026-03-11" });
    await svc.indexPage(page, [a, b]);
    await svc.indexPage(page, [{ ...a, props: { ...a.props, due: "2026-04-01" } }, { ...b, props: { ...b.props, due: "" } }]);
    expect(await tasks()).toEqual(["A|2026-04-01|"]);
    await svc.indexPage(page, []);
    expect(await tasks()).toEqual([]);
  });
  it("las casillas anidadas también cuentan; el título es el texto y el estado, la casilla marcada", async () => {
    const child = taskBlock("Hija", { due: "2026-03-12", checked: true });
    const parent = { ...para("Padre"), children: [child] };
    await svc.indexPage(page, [parent]);
    const [t] = await svc.list();
    expect(t!.title).toBe("Hija");
    expect(t!.done).toBe(true);
    expect(t!.source).toBe("checkbox");
    expect(t!.pageId).toBe(page);
  });
  it("una fecha inválida se ignora sin romper el resto", async () => {
    await svc.indexPage(page, [taskBlock("Mala", { due: "ayer" }), taskBlock("Buena", { due: "2026-03-10" })]);
    expect(await tasks()).toEqual(["Buena|2026-03-10|"]);
  });
  it("la página en la papelera no aporta tareas a la agenda y vuelve al restaurar", async () => {
    await svc.indexPage(page, [taskBlock("A", { due: "2026-03-10" })]);
    must(await repo.trash(page));
    expect(await tasks()).toEqual([]);
    must(await repo.restore(page));
    expect(await tasks()).toEqual(["A|2026-03-10|"]);
  });
});

describe("tareas derivadas de tarjetas y filas (T-292)", () => {
  it("una fila con una propiedad de fecha marcada como tarea crea una tarea; sin fecha, no", async () => {
    const d = must(await dbs.createDatabase({ name: "Base" })).id;
    const f = must(await dbs.addProperty(d, { name: "Entrega", type: "date", config: { asTask: true } }));
    const r1 = must(await dbs.addRow(d, { title: "Con fecha", values: { [f.id]: { start: "2026-03-10", remind: "2026-03-09T08:00" } } }));
    must(await dbs.addRow(d, { title: "Sin fecha" }));
    await svc.indexDatabase(dbs, d);
    const list = await svc.list();
    expect(list.map((t) => t.title)).toEqual(["Con fecha"]);
    expect(list[0]).toMatchObject({ source: "row", due: "2026-03-10", remindAt: "2026-03-09T08:00", pageId: r1.pageId, databaseId: d });
  });
  it("en un tablero las tareas son tarjetas y se completan al pasar a «Hecho»", async () => {
    const d = must(await dbs.createDatabase({ name: "Tablero", pageKind: "board" })).id;
    const st = must(await dbs.addProperty(d, { name: "Estado", type: "status" }));
    await db.exec("INSERT INTO views(id, database_id, name, type, position, config) VALUES ('v1', ?, 'T', 'board', 'z', ?)", [d, JSON.stringify({ groupBy: st.id })]);
    const f = must(await dbs.addProperty(d, { name: "Fecha", type: "date", config: { asTask: true } }));
    const r = must(await dbs.addRow(d, { title: "Tarjeta", values: { [f.id]: { start: "2026-03-10" } } }));
    await svc.indexDatabase(dbs, d);
    expect((await svc.list())[0]).toMatchObject({ source: "card", done: false });
    must(await dbs.setCell(d, r.pageId, st.id, "done"));
    await svc.indexDatabase(dbs, d);
    expect((await svc.list())[0]!.done).toBe(true);
  });
  it("quitar la fecha o la fila retira la tarea", async () => {
    const d = must(await dbs.createDatabase({ name: "Base" })).id;
    const f = must(await dbs.addProperty(d, { name: "Entrega", type: "date", config: { asTask: true } }));
    const r = must(await dbs.addRow(d, { title: "X", values: { [f.id]: { start: "2026-03-10" } } }));
    await svc.indexDatabase(dbs, d);
    expect(await tasks()).toHaveLength(1);
    must(await dbs.setCell(d, r.pageId, f.id, null));
    await svc.indexDatabase(dbs, d);
    expect(await tasks()).toEqual([]);
  });
});

describe("recordatorios vencidos y pendientes (T-300)", () => {
  const idOf = async (title: string) => (await svc.list()).find((t) => t.title === title)!.id;
  it("evalúa en cada tic los recordatorios cuya hora llegó, y no los futuros", async () => {
    await svc.indexPage(page, [taskBlock("Ya", { remindAt: "2026-03-05T09:00" }), taskBlock("Ahora", { remindAt: "2026-03-05T10:00" }), taskBlock("Luego", { remindAt: "2026-03-05T10:01" })]);
    const due = await svc.dueReminders();
    expect(due.map((d) => d.task.title).sort()).toEqual(["Ahora", "Ya"]);
    nowLocal = "2026-03-05T10:01";
    expect((await svc.dueReminders()).map((d) => d.task.title).sort()).toEqual(["Ahora", "Luego", "Ya"]);
  });
  it("un recordatorio disparado no vuelve a ser «nuevo», pero sigue como vencido hasta atenderlo", async () => {
    await svc.indexPage(page, [taskBlock("T", { remindAt: "2026-03-05T09:00" })]);
    const id = await idOf("T");
    expect((await svc.dueReminders({ onlyNew: true })).map((d) => d.task.title)).toEqual(["T"]);
    await svc.markFired(id);
    expect(await svc.dueReminders({ onlyNew: true })).toEqual([]);
    expect((await svc.dueReminders()).map((d) => d.task.title)).toEqual(["T"]); // sigue vencido
  });
  it("las tareas hechas no tienen recordatorios (T-297)", async () => {
    await svc.indexPage(page, [taskBlock("T", { remindAt: "2026-03-05T09:00", checked: true })]);
    expect(await svc.dueReminders()).toEqual([]);
  });
  it("descartar un recordatorio lo quita de vencidos", async () => {
    await svc.indexPage(page, [taskBlock("T", { remindAt: "2026-03-05T09:00" })]);
    await svc.dismiss(await idOf("T"));
    expect(await svc.dueReminders()).toEqual([]);
  });
});

describe("completar una tarea (T-296, T-297)", () => {
  const idOf = async (title: string) => (await svc.list()).find((t) => t.title === title)!.id;
  it("marcarla como hecha cancela sus recordatorios pendientes y avisa a la fuente", async () => {
    await svc.indexPage(page, [taskBlock("T", { due: "2026-03-10", remindAt: "2026-03-05T09:00" })]);
    const id = await idOf("T");
    await svc.markFired(id);
    must(await svc.complete(id));
    expect((await svc.list())[0]!.done).toBe(true);
    expect(await svc.dueReminders()).toEqual([]);
    expect((await db.query("SELECT * FROM reminder_state WHERE task_id = ?", [id])).length).toBe(0);
    expect(writes).toContain(`done ${id} true`);
  });
  it("una tarea recurrente no se cierra: programa la siguiente repetición a partir de la fecha original (CL-32)", async () => {
    const rec = JSON.stringify({ freq: "daily", interval: 1 });
    await svc.indexPage(page, [taskBlock("Diaria", { due: "2026-03-07", remindAt: "2026-03-07T09:00", recurrence: rec })]);
    const id = await idOf("Diaria");
    nowLocal = "2026-03-05T10:00"; // se completa ANTES de la fecha
    must(await svc.complete(id));
    const t = (await svc.list())[0]!;
    expect(t.done).toBe(false);
    expect(t.due).toBe("2026-03-08"); // la siguiente a la del 7, no a la de hoy
    expect(t.remindAt).toBe("2026-03-08T09:00");
    expect(writes.find((w) => w.startsWith("schedule"))).toContain("due=2026-03-08");
    expect(t.recurrence?.anchor).toBe("2026-03-07T09:00"); // la serie recuerda su origen
  });
  it("mensual el 31: respeta el ajuste a fin de mes en cada repetición", async () => {
    const rec = JSON.stringify({ freq: "monthly", interval: 1 });
    await svc.indexPage(page, [taskBlock("Mensual", { due: "2026-01-31", recurrence: rec })]);
    const id = await idOf("Mensual");
    must(await svc.complete(id)); expect((await svc.list())[0]!.due).toBe("2026-02-28");
    must(await svc.complete(id)); expect((await svc.list())[0]!.due).toBe("2026-03-31");
    must(await svc.complete(id)); expect((await svc.list())[0]!.due).toBe("2026-04-30");
  });
  it("completar una tarea inexistente da error", async () => {
    expect((await svc.complete("no-existe")).ok).toBe(false);
  });
});

describe("cambiar o quitar la fecha reprograma el aviso (T-298)", () => {
  it("cambiar la hora de aviso reinicia su estado: vuelve a ser nuevo", async () => {
    const b = taskBlock("T", { remindAt: "2026-03-05T09:00" });
    await svc.indexPage(page, [b]);
    const id = (await svc.list())[0]!.id;
    await svc.markFired(id);
    await svc.indexPage(page, [{ ...b, props: { ...b.props, remindAt: "2026-03-05T09:30" } }]);
    expect((await svc.dueReminders({ onlyNew: true })).map((d) => d.occurrence)).toEqual(["2026-03-05T09:30"]);
  });
  it("quitar la hora de aviso elimina el recordatorio y su estado", async () => {
    const b = taskBlock("T", { due: "2026-03-10", remindAt: "2026-03-05T09:00" });
    await svc.indexPage(page, [b]);
    await svc.markFired((await svc.list())[0]!.id);
    await svc.indexPage(page, [{ ...b, props: { ...b.props, remindAt: "" } }]);
    expect(await svc.dueReminders()).toEqual([]);
    expect((await db.query("SELECT * FROM reminder_state")).length).toBe(0);
  });
  it("reindexar sin cambios conserva el estado", async () => {
    const b = taskBlock("T", { remindAt: "2026-03-05T09:00" });
    await svc.indexPage(page, [b]);
    await svc.markFired((await svc.list())[0]!.id);
    await svc.indexPage(page, [b]);
    expect(await svc.dueReminders({ onlyNew: true })).toEqual([]);
  });
});

describe("fecha pasada al crear (T-299, CL-11)", () => {
  it("avisa y ofrece guardar como vencido o cambiar la fecha", () => {
    const r = svc.checkReminderInput("2026-03-04T09:00");
    expect(r).toEqual({ status: "past", options: ["save_overdue", "change_date"] });
    expect(svc.checkReminderInput("2026-03-05T10:00")).toEqual({ status: "ok" }); // justo ahora no es pasado
    expect(svc.checkReminderInput("2026-03-06T08:00")).toEqual({ status: "ok" });
    expect(svc.checkReminderInput("basura").status).toBe("invalid");
  });
  it("guardado como vencido aparece de inmediato en la lista de vencidos", async () => {
    await svc.indexPage(page, [taskBlock("Tarde", { remindAt: "2026-03-04T09:00" })]);
    expect((await svc.dueReminders()).map((d) => d.task.title)).toEqual(["Tarde"]);
  });
});

describe("agrupar vencidos (T-301, CL-14)", () => {
  it("pocos se notifican uno a uno; muchos, en una sola entrada agrupada", async () => {
    await svc.indexPage(page, Array.from({ length: 20 }, (_, i) => taskBlock(`T${i}`, { remindAt: `2026-03-0${(i % 4) + 1}T09:00` })));
    const notes = svc.toNotifications(await svc.dueReminders());
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatchObject({ kind: "group", count: 20 });
    await svc.indexPage(page, [taskBlock("A", { remindAt: "2026-03-05T09:00" }), taskBlock("B", { remindAt: "2026-03-05T09:30" })]);
    const few = svc.toNotifications(await svc.dueReminders());
    expect(few.map((x) => x.kind)).toEqual(["single", "single"]);
  });
});

describe("repeticiones acumuladas (T-302)", () => {
  it("con la app cerrada varios días, una tarea recurrente muestra solo la repetición más reciente", async () => {
    const rec = JSON.stringify({ freq: "daily", interval: 1 });
    await svc.indexPage(page, [taskBlock("Diaria", { due: "2026-03-01", remindAt: "2026-03-01T09:00", recurrence: rec })]);
    nowLocal = "2026-03-05T10:00"; // pasaron 5 repeticiones
    const due = await svc.dueReminders();
    expect(due).toHaveLength(1);
    expect(due[0]!.occurrence).toBe("2026-03-05T09:00");
    expect(due[0]!.missed).toBe(4);
  });
  it("antes de la hora de hoy, la más reciente es la de ayer", async () => {
    const rec = JSON.stringify({ freq: "daily", interval: 1 });
    await svc.indexPage(page, [taskBlock("Diaria", { due: "2026-03-01", remindAt: "2026-03-01T09:00", recurrence: rec })]);
    nowLocal = "2026-03-05T08:00";
    expect((await svc.dueReminders())[0]!.occurrence).toBe("2026-03-04T09:00");
  });
});

describe("posponer (T-303)", () => {
  const idOf = async () => (await svc.list())[0]!.id;
  it("10 minutos, 1 hora o hasta mañana", async () => {
    await svc.indexPage(page, [taskBlock("T", { remindAt: "2026-03-05T09:00" })]);
    const id = await idOf();
    must(await svc.snooze(id, "10m")); expect((await svc.getState(id))!.snoozedUntil).toBe("2026-03-05T10:10");
    must(await svc.snooze(id, "1h")); expect((await svc.getState(id))!.snoozedUntil).toBe("2026-03-05T11:00");
    must(await svc.snooze(id, "tomorrow")); expect((await svc.getState(id))!.snoozedUntil).toBe("2026-03-06T09:00");
  });
  it("pospuesto no aparece como vencido hasta que llega su hora; entonces vuelve", async () => {
    await svc.indexPage(page, [taskBlock("T", { remindAt: "2026-03-05T09:00" })]);
    const id = await idOf();
    must(await svc.snooze(id, "10m"));
    expect(await svc.dueReminders()).toEqual([]);
    nowLocal = "2026-03-05T10:09"; expect(await svc.dueReminders()).toEqual([]);
    nowLocal = "2026-03-05T10:10"; expect((await svc.dueReminders()).map((d) => d.task.title)).toEqual(["T"]);
  });
  it("«hasta mañana» cruza fin de mes", async () => {
    nowLocal = "2026-03-31T22:00";
    await svc.indexPage(page, [taskBlock("T", { remindAt: "2026-03-31T09:00" })]);
    must(await svc.snooze(await idOf(), "tomorrow"));
    expect((await svc.getState(await idOf()))!.snoozedUntil).toBe("2026-04-01T09:00");
  });
  it("opción desconocida o tarea inexistente = error", async () => {
    await svc.indexPage(page, [taskBlock("T", { remindAt: "2026-03-05T09:00" })]);
    expect((await svc.snooze(await idOf(), "15m" as never)).ok).toBe(false);
    expect((await svc.snooze("no-existe", "10m")).ok).toBe(false);
  });
});

describe("hora flotante y cambio de zona (T-304, CL-13)", () => {
  it("el mismo recordatorio «09:00» se dispara a las 09:00 locales, estés en la zona que estés", async () => {
    await svc.indexPage(page, [taskBlock("T", { remindAt: "2026-03-06T09:00" })]);
    const utc = Date.UTC(2026, 2, 6, 14, 0); // el mismo instante absoluto
    // Ciudad de México (UTC-6): son las 08:00 -> aún no; Madrid (UTC+1): son las 15:00 -> ya pasó
    expect(localNow(utc, -6 * 60)).toBe("2026-03-06T08:00");
    expect(localNow(utc, 60)).toBe("2026-03-06T15:00");
    nowLocal = localNow(utc, -6 * 60);
    expect(await svc.dueReminders()).toEqual([]);
    nowLocal = localNow(utc, 60);
    expect((await svc.dueReminders()).map((d) => d.task.title)).toEqual(["T"]);
    expect((await svc.list())[0]!.remindAt).toBe("2026-03-06T09:00"); // lo guardado no se movió
  });
  it("localNow cruza el día con desfases negativos y positivos", () => {
    expect(localNow(Date.UTC(2026, 2, 6, 1, 30), -6 * 60)).toBe("2026-03-05T19:30");
    expect(localNow(Date.UTC(2026, 2, 6, 23, 30), 5 * 60 + 30)).toBe("2026-03-07T05:00");
  });
});

describe("permiso de notificaciones (T-305)", () => {
  it("si están bloqueadas, avisa una sola vez; los recordatorios siguen apareciendo como vencidos", async () => {
    expect(await svc.shouldWarnAboutPermission("denied")).toBe(true);
    expect(await svc.shouldWarnAboutPermission("denied")).toBe(false);
    expect(await svc.shouldWarnAboutPermission("denied")).toBe(false);
    await svc.indexPage(page, [taskBlock("T", { remindAt: "2026-03-05T09:00" })]);
    expect((await svc.dueReminders()).map((d) => d.task.title)).toEqual(["T"]);
  });
  it("si están permitidas no avisa nunca; y si se concede después, se rearma el aviso por si vuelve a bloquearse", async () => {
    expect(await svc.shouldWarnAboutPermission("granted")).toBe(false);
    expect(await svc.shouldWarnAboutPermission("denied")).toBe(true);
    await svc.shouldWarnAboutPermission("granted");
    expect(await svc.shouldWarnAboutPermission("denied")).toBe(true);
  });
  it("«prompt» (aún sin decidir) no cuenta como bloqueado", async () => {
    expect(await svc.shouldWarnAboutPermission("prompt")).toBe(false);
  });
});
