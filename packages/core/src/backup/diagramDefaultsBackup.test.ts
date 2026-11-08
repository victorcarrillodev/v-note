// G-146, G-147, G-158, G-159 (prueba primero): los estilos predeterminados y los diagramas v2 viajan en el respaldo y se restauran.
import { describe, it, expect } from "vitest";
import { createNodeSqliteStore } from "../../tests/support/nodeSqliteStore";
import { MemoryAssetStore } from "../assets/memoryAssetStore";
import { migrate } from "../db/migrate";
import { migrations } from "../db/migrations";
import { loadDiagramDefaults, saveEdgeDefault, saveShapeDefault } from "../diagrams/defaults";
import { completeEdgeStyle, completeNodeStyle } from "../diagrams/style";
import { addNode, connect, emptyDiagram, parseDiagram, serializeDiagram, setNodeStyle, setEdgeStyle } from "../diagrams/diagram";
import { toYjs } from "../blocks/toYjs";
import * as Y from "yjs";
import { systemClock } from "../clock";
import { PageService } from "../pages/pageService";
import type { Block } from "../blocks/types";
import { restoreFromFiles } from "./restore";
import { serializeWorkspace } from "./serialize";

const dec = new TextDecoder(), enc = new TextEncoder();
const newStore = async () => { const d = await createNodeSqliteStore(":memory:"); await migrate(d, migrations); return d; };
const ser = async (store: Awaited<ReturnType<typeof newStore>>) => (await serializeWorkspace({ store, assets: new MemoryAssetStore() }, { id: "w1", name: "Espacio" })).files;
const must = <T,>(r: { ok: boolean; value?: T; error?: { message: string } }): T => { if (!r.ok) throw new Error(r.error?.message); return r.value as T; };

async function withDiagram(store: Awaited<ReturnType<typeof newStore>>, data: string) {
  const p = must(await new PageService(store, systemClock).create({ title: "Flujo" }));
  const block: Block = { id: "dg", type: "diagram", props: { data }, content: undefined, children: [] };
  const doc = new Y.Doc(); toYjs([block], doc.getXmlFragment("doc"));
  must(await new PageService(store, systemClock).saveUpdate(p.id, Y.encodeStateAsUpdate(doc)));
  return p.id;
}

describe("diagram-defaults.json (G-146, G-147)", () => {
  it("sin predeterminados el archivo no existe", async () => {
    const files = await ser(await newStore());
    expect(files.has("diagram-defaults.json")).toBe(false);
  });
  it("con predeterminados se escribe, determinista (los mismos bytes en dos respaldos)", async () => {
    const s = await newStore();
    await saveShapeDefault(s, completeNodeStyle("process", { fill: "palette:green" }));
    await saveEdgeDefault(s, completeEdgeStyle({ width: "thick" }), "curved");
    const a = (await ser(s)).get("diagram-defaults.json")!, b = (await ser(s)).get("diagram-defaults.json")!;
    expect(dec.decode(a)).toBe(dec.decode(b));
    expect(JSON.parse(dec.decode(a))).toMatchObject({ shape: { fill: "palette:green" }, edge: { route: "curved", style: { width: "thick" } } });
  });
  it("al restaurar vuelven a la base del espacio nuevo", async () => {
    const src = await newStore();
    await saveShapeDefault(src, completeNodeStyle("process", { fill: "palette:green", stroke: "#b45309" }));
    await saveEdgeDefault(src, completeEdgeStyle({ color: "#dc2626" }), "free");
    const files = await ser(src);
    const dst = await newStore();
    expect((await restoreFromFiles(files, { store: dst, assets: new MemoryAssetStore() })).ok).toBe(true);
    expect(await loadDiagramDefaults(dst)).toEqual(await loadDiagramDefaults(src));
  });
  it("un respaldo sin el archivo se restaura con los estilos del sistema", async () => {
    const files = await ser(await newStore());
    const dst = await newStore();
    expect((await restoreFromFiles(files, { store: dst, assets: new MemoryAssetStore() })).ok).toBe(true);
    expect(await loadDiagramDefaults(dst)).toEqual({});
  });
  it("un archivo inválido rechaza la restauración y no escribe nada", async () => {
    const files = await ser(await newStore());
    files.set("diagram-defaults.json", enc.encode(JSON.stringify({ shape: { fill: "rojo" } })));
    const dst = await newStore();
    expect((await restoreFromFiles(files, { store: dst, assets: new MemoryAssetStore() })).ok).toBe(false);
    expect(await loadDiagramDefaults(dst)).toEqual({});
  });
});

describe("diagrama v2 completo en el respaldo (G-158)", () => {
  it("estilos, trazados, puntos y extremos libres viajan sin pérdida y vuelven idénticos", async () => {
    let d = emptyDiagram();
    d = addNode(d, { shape: "decision", x: 0, y: 0, id: "a", text: "¿Ok?" }).diagram; d = addNode(d, { shape: "note", x: 400, y: 200, id: "b", text: "Nota" }).diagram;
    d = setNodeStyle(d, ["a"], { fill: "#fff3b0", fillOpacity: 0.5, stroke: "palette:red", strokeWidth: 3, strokeDash: "dashed", textColor: "#222222" });
    d = must(connect(d, { node: "a", anchor: "s" }, { node: "b", anchor: "n" }, { route: "orthogonal" })).diagram;
    d = must(connect(d, { node: "b", anchor: "e" }, { x: 900, y: 400 }, { route: "free" })).diagram;
    d = { ...d, edges: d.edges.map((e, i) => (i === 0 ? { ...e, waypoints: [{ x: 120, y: 150 }] } : { ...e, points: [{ x: 600, y: 300 }], smooth: true })) };
    d = setEdgeStyle(d, [d.edges[0]!.id], { color: "#dc2626", width: "thick", dash: "dotted", startCap: "circle", endCap: "diamond" });
    const text = serializeDiagram(d);
    const src = await newStore();
    const pageId = await withDiagram(src, text);
    const files = await ser(src);
    const dst = await newStore();
    expect((await restoreFromFiles(files, { store: dst, assets: new MemoryAssetStore() })).ok).toBe(true);
    const again = await ser(dst);
    const page = JSON.parse(dec.decode(again.get(`data/${pageId}.json`)!));
    expect(page.blocks[0].props.data).toBe(text);
    expect(must(parseDiagram(page.blocks[0].props.data))).toEqual(d);
    for (const [k, v] of files) expect(dec.decode(again.get(k)!), k).toBe(dec.decode(v));
  });
});
