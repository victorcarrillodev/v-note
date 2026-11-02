// T-352, T-353, T-354 (prueba primero): diagramas y organizadores se buscan, se respaldan y se restauran sin pérdida.
import { describe, it, expect, vi } from "vitest";
import * as Y from "yjs";
import { createNodeSqliteStore } from "../../tests/support/nodeSqliteStore";
import { FakeClock } from "../clock";
import { MemoryAssetStore } from "../assets/memoryAssetStore";
import { migrate } from "../db/migrate";
import { migrations } from "../db/migrations";
import { toYjs } from "../blocks/toYjs";
import type { Block } from "../blocks/types";
import { addEdge, addNode, emptyDiagram, serializeDiagram, setEdgeLabel } from "../diagrams/diagram";
import { addChild, newTree, serializeTree, toggleCollapsed } from "../diagrams/tree";
import { addEvent, emptyTimeline, serializeTimeline } from "../diagrams/timeline";
import { addItem, serializeMatrix, template2x2 } from "../diagrams/matrix";
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

function blocks(): Block[] {
  let d = emptyDiagram();
  d = addNode(d, { shape: "terminator", x: 0, y: 0, id: "n1", text: "Inicio del flujo" }).diagram;
  d = addNode(d, { shape: "decision", x: 200, y: 0, id: "n2", text: "¿Aprobado?" }).diagram;
  const e = must(addEdge(d, "n1", "n2")); d = setEdgeLabel(e.diagram, e.edge.id, "revisar");
  let t = newTree("Idea central");
  t = must(addChild(t, "root", "Rama uno", "r1")).tree; t = must(addChild(t, "r1", "Detalle oculto", "r1a")).tree; t = toggleCollapsed(t, "r1");
  let org = newTree("Dirección"); org = must(addChild(org, "root", "Finanzas", "f")).tree;
  const tl = must(addEvent(must(addEvent(emptyTimeline(), { date: "2026-05-01", title: "Lanzamiento", id: "e1" })).timeline, { date: "2026-03-01", title: "Prototipo", id: "e2" })).timeline;
  return [blk("b1", "diagram", serializeDiagram(d)), blk("b2", "mindmap", serializeTree(t)), blk("b3", "orgchart", serializeTree(org)), blk("b4", "timeline", serializeTimeline(tl))];
}
function matrixBlock(): Block {
  const base = template2x2();
  const m = must(addItem(base, base.rows[0]!.id, base.cols[0]!.id, "Entregar informe", "i1")).matrix;
  return blk("b5", "matrix", serializeMatrix(m));
}
async function workspace() {
  const store = await newStore();
  const pages = new PageService(store, new FakeClock(1_000));
  const p = must(await pages.create({ title: "Nota con gráficos" }));
  const d = new Y.Doc();
  toYjs([...blocks(), matrixBlock()], d.getXmlFragment("doc"));
  must(await pages.saveUpdate(p.id, Y.encodeStateAsUpdate(d)));
  return { store, pageId: p.id };
}

describe("búsqueda (T-352)", () => {
  it("el texto de formas, conectores y organizadores se encuentra al buscar", async () => {
    const { store } = await workspace();
    const idx = new SearchIndex(store, new FakeClock(1_000));
    for (const [q, label] of [["aprobado", "forma"], ["revisar", "conector"], ["rama", "mapa mental"], ["oculto", "nodo colapsado"], ["finanzas", "organigrama"], ["prototipo", "línea de tiempo"], ["informe", "matriz"], ["urgente", "título de la matriz"]] as const) {
      expect((await idx.search({ query: q })).length, label).toBe(1);
    }
  });
});

describe("respaldo y restauración (T-353)", () => {
  it("los gráficos viajan dentro de la página y se restauran idénticos, con lo colapsado incluido", async () => {
    const { store } = await workspace();
    const files = await ser(store);
    const page = [...files.entries()].find(([k]) => k.startsWith("data/"))!;
    const json = JSON.parse(dec.decode(page[1]));
    expect(json.blocks.map((b: Block) => b.type)).toEqual(["diagram", "mindmap", "orgchart", "timeline", "matrix"]);
    const dst = await newStore();
    expect((await restoreFromFiles(files, { store: dst, assets: new MemoryAssetStore() })).ok).toBe(true);
    const again = await ser(dst);
    expect([...again.keys()].sort()).toEqual([...files.keys()].sort());
    for (const [k, v] of files) expect(dec.decode(again.get(k)!), k).toBe(dec.decode(v));
  });
  it("el Markdown legible describe cada gráfico", async () => {
    const { store } = await workspace();
    const md = dec.decode([...(await ser(store)).entries()].find(([k]) => k.startsWith("pages/"))![1]);
    for (const w of ["Diagrama", "Inicio del flujo", "Mapa mental", "Idea central", "Organigrama", "Finanzas", "Línea de tiempo", "Prototipo", "Matriz", "Entregar informe"]) expect(md, w).toContain(w);
    expect(md.indexOf("Prototipo")).toBeLessThan(md.indexOf("Lanzamiento")); // cronológico
  });
});

describe("archivo dorado con gráficos (T-354, RNF-7)", () => {
  it("la salida para una página con los cinco tipos de gráfico no cambia sin querer", async () => {
    let n = 0;
    const spy = vi.spyOn(globalThis.crypto, "randomUUID").mockImplementation(() => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}` as `${string}-${string}-${string}-${string}-${string}`);
    try {
      const { store } = await workspace();
      const files = await ser(store);
      const snapshot = Object.fromEntries([...files.entries()].filter(([k]) => k.startsWith("data/") || k.startsWith("pages/")).sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, v]) => [k, dec.decode(v)]));
      await expect(JSON.stringify(snapshot, null, 2) + "\n").toMatchFileSnapshot("../../tests/golden/backup-v1-diagrams.json");
    } finally { spy.mockRestore(); }
  });
});
