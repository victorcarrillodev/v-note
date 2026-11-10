// R-171 a R-173, R-176, R-177 (spec 004, Hito 4): los campos nuevos de mapas y diagramas viajan en el respaldo sin cambiar el formato.
import { describe, it, expect } from "vitest";
import * as Y from "yjs";
import { createNodeSqliteStore } from "../../tests/support/nodeSqliteStore";
import { FakeClock } from "../clock";
import { MemoryAssetStore } from "../assets/memoryAssetStore";
import { migrate } from "../db/migrate";
import { migrations } from "../db/migrations";
import { toYjs } from "../blocks/toYjs";
import type { Block } from "../blocks/types";
import { addNode, emptyDiagram, serializeDiagram } from "../diagrams/diagram";
import { addChild, newTree, serializeTree, treeText, parseTree } from "../diagrams/tree";
import { moveBranch, setTreeNodeStyle } from "../diagrams/mindmap";
import { PageService } from "../pages/pageService";
import { SearchIndex } from "../search/searchIndex";
import type { SqlStore } from "../ports/sqlStore";
import { restoreFromFiles } from "./restore";
import { serializeWorkspace } from "./serialize";

const must = <T,>(r: { ok: boolean; value?: T; error?: { message: string } }): T => { if (!r.ok) throw new Error(r.error?.message); return r.value as T; };
const dec = new TextDecoder();
const newStore = async () => { const d = await createNodeSqliteStore(":memory:"); await migrate(d, migrations); return d; };
const ser = async (store: SqlStore) => (await serializeWorkspace({ store, assets: new MemoryAssetStore() }, { id: "w1", name: "Espacio" })).files;
const blk = (id: string, type: string, data: string): Block => ({ id, type, props: { data }, content: undefined, children: [] });

function newMap() {
  let t = newTree("Idea central");
  t = must(addChild(t, "root", "Rama uno", "r1")).tree; t = must(addChild(t, "r1", "Detalle", "r1a")).tree;
  t = moveBranch(t, "r1", { x: 260, y: 80 }, { snap: true });
  t = must(setTreeNodeStyle(t, "r1", "fill", "palette:green")); t = must(setTreeNodeStyle(t, "r1a", "line", "#336699"));
  return { ...t, view: { height: 480 } };
}
async function workspace(extra: Block[]) {
  const store = await newStore();
  const pages = new PageService(store, new FakeClock(1_000));
  const p = must(await pages.create({ title: "Nota" }));
  const d = new Y.Doc();
  toYjs(extra, d.getXmlFragment("doc"));
  must(await pages.saveUpdate(p.id, Y.encodeStateAsUpdate(d)));
  return { store };
}
const dataOf = (files: Map<string, Uint8Array>): Block[] => JSON.parse(dec.decode([...files.entries()].find(([k]) => k.startsWith("data/"))![1])).blocks;

describe("respaldo y restauración con los campos nuevos (R-171, R-173)", () => {
  const blocks = () => [blk("m", "mindmap", serializeTree(newMap())), blk("d", "diagram", serializeDiagram({ ...addNode(emptyDiagram(), { shape: "process", x: 0, y: 0, id: "a", text: "A" }).diagram, view: { height: 600 } }))];
  it("conserva off, style y view del mapa y view del diagrama", async () => {
    const { store } = await workspace(blocks());
    const files = await ser(store);
    const bs = dataOf(files);
    const map = must(parseTree(String(bs[0]!.props.data)));
    expect(map.view).toEqual({ height: 480 });
    expect(map.root.children[0]!.off).toEqual({ x: expect.any(Number), y: expect.any(Number) });
    expect(map.root.children[0]!.style).toEqual({ fill: "palette:green" });
    expect(JSON.parse(String(bs[1]!.props.data)).view).toEqual({ height: 600 });
    const dst = await newStore();
    expect((await restoreFromFiles(files, { store: dst, assets: new MemoryAssetStore() })).ok).toBe(true);
    const again = await ser(dst);
    for (const [k, v] of files) expect(dec.decode(again.get(k)!), k).toBe(dec.decode(v));
  });
  it("dos respaldos seguidos son idénticos (R-173)", async () => {
    const { store } = await workspace(blocks());
    const a = await ser(store), b = await ser(store);
    expect([...a.keys()].sort()).toEqual([...b.keys()].sort());
    for (const [k, v] of a) expect(dec.decode(b.get(k)!), k).toBe(dec.decode(v));
  });
});

describe("búsqueda y texto (R-176) y organigrama (R-177)", () => {
  it("treeText no cambia con los campos nuevos", () => {
    const plain = must(addChild(newTree("Idea central"), "root", "Rama uno", "r1")).tree;
    const fancy = moveBranch(must(setTreeNodeStyle(plain, "r1", "fill", "#ff0000")), "r1", { x: 300, y: 40 }, { snap: false });
    expect(treeText({ ...fancy, view: { height: 500 } })).toBe(treeText(plain));
  });
  it("el texto del mapa se encuentra al buscar aunque tenga posiciones y colores", async () => {
    const { store } = await workspace([blk("m", "mindmap", serializeTree(newMap()))]);
    expect((await new SearchIndex(store, new FakeClock(1_000)).search({ query: "detalle" })).length).toBe(1);
  });
  it("un organigrama con los campos nuevos se guarda tal cual y su serialización limpia los vacíos", () => {
    const org = must(addChild(newTree("Dirección"), "root", "Finanzas", "f")).tree;
    expect(serializeTree(org)).not.toContain("off");
    expect(serializeTree(org)).not.toContain("style");
  });
});
