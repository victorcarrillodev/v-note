// A: las tareas de las casillas se derivan solas de cada documento al guardarlo (no hace falta reindexar a mano).
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

const task = (id: string, title: string, props: Record<string, unknown>): Block => ({ id, type: "task", props: { checked: false, due: "", remindAt: "", recurrence: "", ...props }, content: [{ type: "text", text: title, styles: {} }], children: [] });
const update = (blocks: Block[]) => { const d = new Y.Doc(); toYjs(blocks, d.getXmlFragment("doc")); return Y.encodeStateAsUpdate(d); };

async function setup() {
  const db = await createNodeSqliteStore(":memory:");
  await migrate(db, migrations);
  const clock = new FakeClock(1_000);
  const pages = new PageService(db, clock);
  const tasks = new TaskService(db, clock, { async setSchedule() {}, async setDone() {} }, () => "2026-03-05T10:00");
  const page = await pages.create({ title: "Nota" });
  if (!page.ok) throw new Error("x");
  return { db, pages, tasks, pageId: page.value.id };
}

describe("indexado automático de tareas al guardar la página", () => {
  it("guardar un documento con una casilla con fecha crea la tarea", async () => {
    const { pages, tasks, pageId } = await setup();
    expect((await pages.saveUpdate(pageId, update([task("b1", "Pagar luz", { due: "2026-03-10", remindAt: "2026-03-09T08:00" })]))).ok).toBe(true);
    const list = await tasks.list();
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ title: "Pagar luz", due: "2026-03-10", remindAt: "2026-03-09T08:00", pageId, blockId: "b1", source: "checkbox" });
  });
  it("editar la fecha o marcar la casilla actualiza la tarea; quitarla la elimina", async () => {
    const { pages, tasks, pageId, db } = await setup();
    const doc = new Y.Doc();
    toYjs([task("b1", "T", { due: "2026-03-10" })], doc.getXmlFragment("doc"));
    await pages.saveUpdate(pageId, Y.encodeStateAsUpdate(doc));
    // segunda versión del documento (estado completo nuevo sobre el anterior no es un delta; se reescribe la página)
    const d2 = new Y.Doc();
    toYjs([task("b1", "T", { due: "2026-03-11", checked: true })], d2.getXmlFragment("doc"));
    await db.exec("DELETE FROM page_docs WHERE page_id = ?", [pageId]);
    await pages.saveUpdate(pageId, Y.encodeStateAsUpdate(d2));
    expect(await tasks.list()).toMatchObject([{ due: "2026-03-11", done: true }]);
    const d3 = new Y.Doc();
    toYjs([task("b1", "T", {})], d3.getXmlFragment("doc"));
    await db.exec("DELETE FROM page_docs WHERE page_id = ?", [pageId]);
    await pages.saveUpdate(pageId, Y.encodeStateAsUpdate(d3));
    expect(await tasks.list()).toEqual([]);
  });
  it("una página sin casillas con fecha no genera tareas y guardar no falla", async () => {
    const { pages, tasks, pageId } = await setup();
    expect((await pages.saveUpdate(pageId, update([{ id: "p", type: "paragraph", props: {}, content: [{ type: "text", text: "hola", styles: {} }], children: [] }]))).ok).toBe(true);
    expect(await tasks.list()).toEqual([]);
  });
});
