// Editar las propiedades de un bloque dentro del documento Yjs (p. ej. marcar una tarea como hecha desde un recordatorio).
import { describe, it, expect } from "vitest";
import * as Y from "yjs";
import { createNodeSqliteStore } from "../../tests/support/nodeSqliteStore";
import { FakeClock } from "../clock";
import { migrate } from "../db/migrate";
import { migrations } from "../db/migrations";
import { DocStore } from "../docs/docStore";
import { PageService } from "../pages/pageService";
import { fromYjs } from "./fromYjs";
import { toYjs } from "./toYjs";
import { setBlockProps } from "./updateProps";
import type { Block } from "./types";

const task = (id: string, props: Record<string, unknown> = {}, children: Block[] = []): Block => ({ id, type: "task", props: { checked: false, due: "2026-03-10", remindAt: "", recurrence: "", ...props }, content: [{ type: "text", text: id, styles: {} }], children });

describe("setBlockProps", () => {
  it("cambia solo las propiedades indicadas del bloque con ese id", () => {
    const d = new Y.Doc();
    toYjs([task("a"), task("b")], d.getXmlFragment("doc"));
    expect(setBlockProps(d.getXmlFragment("doc"), "b", { checked: true, due: "2026-04-01" })).toBe(true);
    const blocks = fromYjs(d.getXmlFragment("doc"));
    expect(blocks[1]!.props).toMatchObject({ checked: true, due: "2026-04-01", remindAt: "" });
    expect(blocks[0]!.props.checked).toBe(false);
  });
  it("encuentra bloques anidados", () => {
    const d = new Y.Doc();
    toYjs([task("a", {}, [task("hijo")])], d.getXmlFragment("doc"));
    expect(setBlockProps(d.getXmlFragment("doc"), "hijo", { checked: true })).toBe(true);
    expect(fromYjs(d.getXmlFragment("doc"))[0]!.children[0]!.props.checked).toBe(true);
  });
  it("devuelve false si el bloque no existe y no cambia nada", () => {
    const d = new Y.Doc();
    toYjs([task("a")], d.getXmlFragment("doc"));
    const before = JSON.stringify(fromYjs(d.getXmlFragment("doc")));
    expect(setBlockProps(d.getXmlFragment("doc"), "zzz", { checked: true })).toBe(false);
    expect(JSON.stringify(fromYjs(d.getXmlFragment("doc")))).toBe(before);
  });
});

describe("PageService.updateBlockProps", () => {
  it("guarda el cambio como una actualización más, sin tocar el resto, y reindexa las tareas", async () => {
    const db = await createNodeSqliteStore(":memory:");
    await migrate(db, migrations);
    const clock = new FakeClock(1_000);
    const pages = new PageService(db, clock);
    const p = await pages.create({ title: "N" });
    if (!p.ok) throw new Error("x");
    const d = new Y.Doc();
    toYjs([task("a"), task("b")], d.getXmlFragment("doc"));
    await pages.saveUpdate(p.value.id, Y.encodeStateAsUpdate(d));
    const r = await pages.updateBlockProps(p.value.id, "b", { checked: true });
    expect(r.ok).toBe(true);
    const doc = await new DocStore(db, clock).loadIn(db, p.value.id);
    const blocks = fromYjs(doc.getXmlFragment("doc"));
    expect(blocks.map((b) => b.props.checked)).toEqual([false, true]);
    expect((await db.query<{ done: number }>("SELECT done FROM tasks WHERE block_id = 'b'"))[0]!.done).toBe(1);
  });
  it("un bloque inexistente o una página inexistente dan error", async () => {
    const db = await createNodeSqliteStore(":memory:");
    await migrate(db, migrations);
    const pages = new PageService(db, new FakeClock(1));
    const p = await pages.create({ title: "N" });
    if (!p.ok) throw new Error("x");
    expect((await pages.updateBlockProps(p.value.id, "no-existe", { checked: true })).ok).toBe(false);
    expect((await pages.updateBlockProps("no-existe", "a", {})).ok).toBe(false);
  });
  it("ediciones sucesivas se acumulan: la segunda no revierte la primera", async () => {
    const db = await createNodeSqliteStore(":memory:");
    await migrate(db, migrations);
    const clock = new FakeClock(1_000);
    const pages = new PageService(db, clock);
    const p = await pages.create({ title: "N" });
    if (!p.ok) throw new Error("x");
    const d = new Y.Doc();
    toYjs([task("a")], d.getXmlFragment("doc"));
    await pages.saveUpdate(p.value.id, Y.encodeStateAsUpdate(d));
    await pages.updateBlockProps(p.value.id, "a", { due: "2026-04-01" });
    await pages.updateBlockProps(p.value.id, "a", { remindAt: "2026-04-01T09:00" });
    await pages.updateBlockProps(p.value.id, "a", { checked: true });
    const blocks = fromYjs((await new DocStore(db, clock).loadIn(db, p.value.id)).getXmlFragment("doc"));
    expect(blocks[0]!.props).toMatchObject({ due: "2026-04-01", remindAt: "2026-04-01T09:00", checked: true });
  });
  it("varias propiedades a la vez, incluidas las que ya tenían valor", async () => {
    const db = await createNodeSqliteStore(":memory:");
    await migrate(db, migrations);
    const clock = new FakeClock(1_000);
    const pages = new PageService(db, clock);
    const p = await pages.create({ title: "N" });
    if (!p.ok) throw new Error("x");
    const d = new Y.Doc();
    toYjs([task("a", { due: "2026-03-05", remindAt: "2026-03-05T09:00", recurrence: '{"freq":"daily","interval":1}' })], d.getXmlFragment("doc"));
    await pages.saveUpdate(p.value.id, Y.encodeStateAsUpdate(d));
    await pages.updateBlockProps(p.value.id, "a", { due: "2026-03-06", recurrence: "x" });
    const blocks = fromYjs((await new DocStore(db, clock).loadIn(db, p.value.id)).getXmlFragment("doc"));
    expect(blocks[0]!.props).toMatchObject({ due: "2026-03-06", recurrence: "x" });
  });
});

