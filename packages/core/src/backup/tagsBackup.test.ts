// U-237 (RF-5.9, RNF-11): las etiquetas viajan en el respaldo solo cuando existen; ida y vuelta completa.
import { describe, it, expect } from "vitest";
import { createNodeSqliteStore } from "../../tests/support/nodeSqliteStore";
import { para, updateFor } from "../../tests/support/builders";
import { migrate } from "../db/migrate";
import { migrations } from "../db/migrations";
import { FakeClock } from "../clock";
import { MemoryAssetStore } from "../assets/memoryAssetStore";
import { PageService } from "../pages/pageService";
import { TagService } from "../tags/tagService";
import { serializeWorkspace } from "./serialize";
import { restoreFromFiles, validateBackup } from "./restore";

const fresh = async () => { const s = await createNodeSqliteStore(":memory:"); await migrate(s, migrations); return { store: s, assets: new MemoryAssetStore() }; };
const must = <T>(r: { ok: boolean; value?: T }): T => { if (!r.ok) throw new Error("x"); return r.value as T; };

async function source(withTags: boolean) {
  const src = await fresh();
  const clock = new FakeClock(1_000);
  const svc = new PageService(src.store, clock);
  const p = must(await svc.create({ title: "Uno" }));
  await svc.saveUpdate(p.id, updateFor([para("hola")]));
  if (withTags) {
    const tags = new TagService(src.store, clock);
    const t = must(await tags.create({ name: "Urgente", color: "red" }));
    must(await tags.create({ name: "Sin uso", color: "blue" }));
    must(await tags.assign(p.id, t.id));
  }
  return { out: await serializeWorkspace(src, { id: "ws", name: "Personal" }), pageId: p.id };
}

describe("etiquetas en el respaldo", () => {
  it("sin etiquetas no se escribe tags.json (los archivos existentes no cambian)", async () => {
    const { out } = await source(false);
    expect(out.files.has("tags.json")).toBe(false);
  });
  it("con etiquetas se escribe tags.json con catálogo y asignaciones, de forma determinista", async () => {
    const a = await source(true), b = await source(true);
    const file = (r: typeof a) => new TextDecoder().decode(r.out.files.get("tags.json")!);
    const json = JSON.parse(file(a));
    expect(json.tags.map((t: { name: string }) => t.name)).toEqual(["Sin uso", "Urgente"]);
    expect(json.assignments).toEqual([{ pageId: a.pageId, tagId: json.tags.find((t: { name: string }) => t.name === "Urgente").id }]);
    expect(Object.keys(json.tags[0]).sort()).toEqual(["color", "createdAt", "id", "name"]);
  });
  it("ida y vuelta: las etiquetas y su asignación se restauran", async () => {
    const { out, pageId } = await source(true);
    const dst = await fresh();
    expect((await restoreFromFiles(new Map(out.files), dst)).ok).toBe(true);
    const tags = new TagService(dst.store, new FakeClock(1));
    expect((await tags.list()).map((t) => [t.name, t.color, t.uses])).toEqual([["Sin uso", "blue", 0], ["Urgente", "red", 1]]);
    expect((await tags.forPage(pageId)).map((t) => t.name)).toEqual(["Urgente"]);
  });
  it("un respaldo anterior, sin tags.json, se restaura sin etiquetas", async () => {
    const { out } = await source(false);
    const dst = await fresh();
    expect((await restoreFromFiles(new Map(out.files), dst)).ok).toBe(true);
    expect(await new TagService(dst.store, new FakeClock(1)).list()).toEqual([]);
  });
  it("un tags.json dañado se rechaza antes de escribir nada", async () => {
    const { out } = await source(true);
    const files = new Map(out.files);
    files.set("tags.json", new TextEncoder().encode(JSON.stringify({ tags: [{ id: "t", name: "", color: "fucsia", createdAt: 1 }], assignments: [{ pageId: "no-existe", tagId: "t" }] })));
    expect((await validateBackup(files)).ok).toBe(false);
    const dst = await fresh();
    expect((await restoreFromFiles(files, dst)).ok).toBe(false);
    expect(await dst.store.query("SELECT 1 FROM pages")).toEqual([]);
  });
});
