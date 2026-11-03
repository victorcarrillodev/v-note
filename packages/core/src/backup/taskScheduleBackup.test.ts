// U-193 y U-194 (RF-8, RNF-11, CL-23): la hora de inicio y la duración viajan en el respaldo solo cuando existen,
// y un respaldo anterior (sin ellas) se restaura igual que siempre.
import { describe, it, expect } from "vitest";
import * as Y from "yjs";
import { createNodeSqliteStore } from "../../tests/support/nodeSqliteStore";
import { migrate } from "../db/migrate";
import { migrations } from "../db/migrations";
import { FakeClock } from "../clock";
import { MemoryAssetStore } from "../assets/memoryAssetStore";
import { PageService } from "../pages/pageService";
import { toYjs } from "../blocks/toYjs";
import type { Block } from "../blocks/types";
import { serializeWorkspace } from "./serialize";
import { restoreFromFiles } from "./restore";

const task = (id: string, title: string, props: Record<string, unknown>): Block => ({ id, type: "task", props: { checked: false, due: "", remindAt: "", recurrence: "", ...props }, content: [{ type: "text", text: title, styles: {} }], children: [] });
const update = (blocks: Block[]) => { const d = new Y.Doc(); toYjs(blocks, d.getXmlFragment("doc")); return Y.encodeStateAsUpdate(d); };
const fresh = async () => { const s = await createNodeSqliteStore(":memory:"); await migrate(s, migrations); return { store: s, assets: new MemoryAssetStore() }; };

async function backupOf(blocks: Block[]) {
  const src = await fresh();
  const svc = new PageService(src.store, new FakeClock(1_000));
  const p = await svc.create({ title: "Agenda" });
  if (!p.ok) throw new Error("x");
  await svc.saveUpdate(p.value.id, update(blocks));
  const out = await serializeWorkspace(src, { id: "ws", name: "Personal" });
  return { files: new Map(out.files), pageId: p.value.id };
}

describe("hora y duración en el respaldo", () => {
  it("ida y vuelta con hora y duración: la tarea restaurada las conserva", async () => {
    const { files } = await backupOf([task("b", "Reunión", { due: "2026-03-10T09:30", durationMin: "45" })]);
    const dst = await fresh();
    expect((await restoreFromFiles(files, dst)).ok).toBe(true);
    const rows = await dst.store.query<{ due: string; start_time: string | null; duration_min: number | null }>("SELECT due, start_time, duration_min FROM tasks");
    expect(rows).toEqual([{ due: "2026-03-10T09:30", start_time: "09:30", duration_min: 45 }]);
  });
  it("ida y vuelta sin hora: igual que antes", async () => {
    const { files } = await backupOf([task("b", "Pagar", { due: "2026-03-10" })]);
    const dst = await fresh();
    expect((await restoreFromFiles(files, dst)).ok).toBe(true);
    const rows = await dst.store.query<{ due: string; start_time: string | null; duration_min: number | null }>("SELECT due, start_time, duration_min FROM tasks");
    expect(rows).toEqual([{ due: "2026-03-10", start_time: null, duration_min: null }]);
  });
  it("un respaldo anterior sin el campo de duración se restaura y la tarea queda con hora y duración por omisión", async () => {
    const { files, pageId } = await backupOf([task("b", "Vieja", { due: "2026-03-10T09:30" })]);
    const json = JSON.parse(new TextDecoder().decode(files.get(`data/${pageId}.json`)!));
    expect(JSON.stringify(json)).not.toContain("durationMin"); // no se escribe cuando no existe
    const dst = await fresh();
    expect((await restoreFromFiles(files, dst)).ok).toBe(true);
    const rows = await dst.store.query<{ duration_min: number | null }>("SELECT duration_min FROM tasks");
    expect(rows).toEqual([{ duration_min: null }]);
  });
});
