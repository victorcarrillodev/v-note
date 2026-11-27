// backlog-b7-b11 T-4 y T-6: leer PDF para la búsqueda, notas por zona, respaldo y limpieza.
import { describe, it, expect } from "vitest";
import { assetUrl, AssetNotesService, FakeClock, gcAssets, MemoryAssetStore, migrate, migrations, PageService, restoreFromFiles, SearchIndex, serializeWorkspace, toYjs, type Block } from "@vnote/core";
import * as Y from "yjs";
import { createNodeSqliteStore } from "../../../core/tests/support/nodeSqliteStore";
import { indexPendingPdfs } from "./indexPdfs";

const fresh = async () => { const s = await createNodeSqliteStore(":memory:"); await migrate(s, migrations); return s; };
const update = (blocks: Block[]) => { const d = new Y.Doc(); toYjs(blocks, d.getXmlFragment("doc")); return Y.encodeStateAsUpdate(d); };
const fileBlock = (hash: string): Block => ({ id: "f1", type: "file", props: { name: "apuntes.pdf", url: assetUrl(hash), caption: "", backgroundColor: "default" }, content: undefined, children: [] });

async function setup() {
  const store = await fresh(), assets = new MemoryAssetStore(), clock = new FakeClock(1_000);
  const { hash } = await assets.put(new Uint8Array([1, 2, 3]));
  const pages = new PageService(store, clock);
  const created = await pages.create({ title: "Tema" });
  if (!created.ok) throw new Error("create");
  await pages.saveUpdate(created.value.id, update([fileBlock(hash)]));
  return { store, assets, clock, hash, pageId: created.value.id };
}

describe("adjuntos", () => {
  it("el texto del PDF se puede buscar y se lee una sola vez", async () => {
    const { store, assets, clock } = await setup();
    const search = new SearchIndex(store, clock);
    let reads = 0;
    const read = async () => { reads++; return "teorema de Bayes"; };
    expect(await search.search({ query: "Bayes" })).toEqual([]);
    await indexPendingPdfs(store, assets, clock, read);
    await indexPendingPdfs(store, assets, clock, read);
    expect(reads).toBe(1);
    expect((await search.search({ query: "Bayes" })).map((h) => h.title)).toEqual(["Tema"]);
    await search.rebuildAll();
    expect((await search.search({ query: "Bayes" })).length).toBe(1);
  });
  it("un PDF dañado no rompe nada ni se reintenta", async () => {
    const { store, assets, clock } = await setup();
    let reads = 0;
    const read = async () => { reads++; throw new Error("dañado"); };
    await indexPendingPdfs(store, assets, clock, read);
    await indexPendingPdfs(store, assets, clock, read);
    expect(reads).toBe(1);
  });
  it("las notas viajan en el respaldo y se limpian junto con su archivo", async () => {
    const { store, assets, clock, hash, pageId } = await setup();
    const notes = new AssetNotesService(store, clock);
    const added = await notes.add({ hash, page: 1, rect: { x: 0.1, y: 0.1, w: 0.2, h: 0.2 }, text: " revisar " });
    expect(added.ok).toBe(true);
    await indexPendingPdfs(store, assets, clock, async () => "x");

    const out = await serializeWorkspace({ store, assets }, { id: "ws", name: "P" });
    const target = { store: await fresh(), assets: new MemoryAssetStore() };
    expect((await restoreFromFiles(out.files, target)).ok).toBe(true);
    expect((await new AssetNotesService(target.store, clock).list(hash)).map((n) => n.text)).toEqual(["revisar"]);

    // Con el archivo todavía en uso no se borra; sin la página, el texto y las notas se van con él.
    await gcAssets({ store, assets });
    expect(await assets.has(hash)).toBe(true);
    await store.exec("DELETE FROM page_docs WHERE page_id = ?", [pageId]);
    await store.exec("DELETE FROM page_text");
    await gcAssets({ store, assets });
    expect(await assets.has(hash)).toBe(false);
    expect(await notes.list(hash)).toEqual([]);
  });
});
