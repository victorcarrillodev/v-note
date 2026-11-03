// U-185, U-193, U-194 (RF-7.2, RF-8, RNF-11, CL-23): hora de inicio y duración de las tareas (opcionales).
import { describe, it, expect } from "vitest";
import * as Y from "yjs";
import { createNodeSqliteStore } from "../../tests/support/nodeSqliteStore";
import { FakeClock } from "../clock";
import { migrate } from "../db/migrate";
import { migrations } from "../db/migrations";
import { toYjs } from "../blocks/toYjs";
import type { Block } from "../blocks/types";
import { PageService } from "../pages/pageService";
import { TaskService } from "./taskService";
import { tasksFromBlocks } from "./taskIndex";

const task = (id: string, title: string, props: Record<string, unknown>): Block => ({ id, type: "task", props: { checked: false, due: "", remindAt: "", recurrence: "", durationMin: "", ...props }, content: [{ type: "text", text: title, styles: {} }], children: [] });
const update = (blocks: Block[]) => { const d = new Y.Doc(); toYjs(blocks, d.getXmlFragment("doc")); return Y.encodeStateAsUpdate(d); };

async function setup(upTo?: number) {
  const db = await createNodeSqliteStore(":memory:");
  await migrate(db, upTo ? migrations.filter((m) => m.version <= upTo) : migrations);
  const clock = new FakeClock(1_000);
  const pages = new PageService(db, clock);
  const tasks = new TaskService(db, clock, { async setSchedule() {}, async setDone() {} }, () => "2026-03-05T10:00");
  const page = await pages.create({ title: "Nota" });
  if (!page.ok) throw new Error("x");
  return { db, pages, tasks, pageId: page.value.id };
}

describe("migración de hora y duración (U-185)", () => {
  it("agrega columnas opcionales a tasks sin tocar las existentes", async () => {
    const { db } = await setup();
    const cols = (await db.query<{ name: string; notnull: number }>("PRAGMA table_info(tasks)"));
    expect(cols.find((c) => c.name === "start_time")).toMatchObject({ notnull: 0 });
    expect(cols.find((c) => c.name === "duration_min")).toMatchObject({ notnull: 0 });
    for (const c of ["due", "remind_at", "recurrence", "done"]) expect(cols.map((x) => x.name)).toContain(c);
  });
  it("las tareas que ya existían antes de la migración quedan igual (sin hora ni duración)", async () => {
    const db = await createNodeSqliteStore(":memory:");
    await migrate(db, migrations.filter((m) => m.version <= 11));
    await db.exec("INSERT INTO pages(id, position, kind, created_at, updated_at) VALUES ('p','a0','note',0,0)");
    await db.exec("INSERT INTO tasks(id, source, page_id, title, due, updated_at) VALUES ('t','checkbox','p','Vieja','2026-03-10',0)");
    await migrate(db, migrations);
    const tasks = new TaskService(db, new FakeClock(1), { async setSchedule() {}, async setDone() {} }, () => "2026-03-05T10:00");
    expect(await tasks.get("t")).toMatchObject({ title: "Vieja", due: "2026-03-10", startTime: null, durationMin: null });
  });
});

describe("hora y duración desde las casillas", () => {
  it("una casilla con hora y duración las guarda en el índice", async () => {
    const { pages, tasks, pageId } = await setup();
    await pages.saveUpdate(pageId, update([task("b", "Reunión", { due: "2026-03-10T09:30", durationMin: "45" })]));
    expect((await tasks.list())[0]).toMatchObject({ due: "2026-03-10T09:30", startTime: "09:30", durationMin: 45 });
  });
  it("sin hora no hay duración aunque la casilla la traiga (va a «Todo el día»)", () => {
    const [t] = tasksFromBlocks("p", [task("b", "X", { due: "2026-03-10", durationMin: "30" })]);
    expect(t).toMatchObject({ startTime: null, durationMin: null });
  });
  it("duración inválida (cero, negativa, texto) se ignora", () => {
    for (const d of ["0", "-5", "abc", "1.5"]) expect(tasksFromBlocks("p", [task("b", "X", { due: "2026-03-10T09:00", durationMin: d })])[0]!.durationMin, d).toBeNull();
  });
  it("las tareas sin hora siguen igual", async () => {
    const { pages, tasks, pageId } = await setup();
    await pages.saveUpdate(pageId, update([task("b", "Pagar", { due: "2026-03-10" })]));
    expect((await tasks.list())[0]).toMatchObject({ due: "2026-03-10", startTime: null, durationMin: null });
  });
});
