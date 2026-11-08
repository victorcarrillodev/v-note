// G-165 (lógica contra servidor falso): respaldo a GitHub y restauración de un espacio con diagramas v1 y v2 y estilos predeterminados.
import { describe, it, expect } from "vitest";
import * as Y from "yjs";
import { FakeGithub } from "../../tests/support/fakeGithub";
import { MemoryConfigStore, MemoryWorkspaceStorage } from "../../tests/support/memoryPorts";
import { FakeClock } from "../clock";
import { MemoryAssetStore } from "../assets/memoryAssetStore";
import { toYjs } from "../blocks/toYjs";
import type { Block } from "../blocks/types";
import { addNode, connect, emptyDiagram, parseDiagram, serializeDiagram, setEdgeStyle, setNodeStyle } from "../diagrams/diagram";
import { loadDiagramDefaults, saveEdgeDefault, saveShapeDefault } from "../diagrams/defaults";
import { completeEdgeStyle, completeNodeStyle } from "../diagrams/style";
import { PageService } from "../pages/pageService";
import { WorkspaceManager } from "../workspaces/workspaceManager";
import { GitHubClient } from "./githubClient";
import { runBackup } from "./runBackup";
import { serializeWorkspace } from "./serialize";
import { readBackup } from "./restore";
import { restoreAsNewWorkspace } from "./restoreFlows";

const must = <T,>(r: { ok: boolean; value?: T; error?: unknown }): T => { if (!r.ok) throw new Error(JSON.stringify(r.error)); return r.value as T; };
const diagramBlock = (data: string): Block => ({ id: "dg", type: "diagram", props: { data }, content: undefined, children: [] });
const docWith = (data: string) => { const d = new Y.Doc(); toYjs([diagramBlock(data)], d.getXmlFragment("doc")); return Y.encodeStateAsUpdate(d); };

describe("respaldo y restauración de diagramas contra el servidor falso (G-165)", () => {
  it("v2 con todos sus datos, un v1 antiguo y los predeterminados vuelven completos y el v1 se abre migrado", async () => {
    const gh = new FakeGithub(), clock = new FakeClock(Date.UTC(2026, 10, 8, 12));
    const mgr = new WorkspaceManager(new MemoryConfigStore(), new MemoryWorkspaceStorage(), clock);
    const client = new GitHubClient({ fetch: gh.fetch, token: gh.token, owner: "yo", repo: "r" });
    const assets = new Map<string, MemoryAssetStore>();
    const assetsFor = (loc: string) => { if (!assets.has(loc)) assets.set(loc, new MemoryAssetStore()); return assets.get(loc)!; };

    let d = emptyDiagram();
    d = addNode(d, { shape: "decision", x: 0, y: 0, id: "a", text: "¿Ok?" }).diagram; d = addNode(d, { shape: "note", x: 400, y: 200, id: "b", text: "Nota" }).diagram;
    d = setNodeStyle(d, ["a"], { fill: "#fff3b0", fillOpacity: 0.6, stroke: "palette:red", strokeWidth: 3, strokeDash: "dashed" });
    d = must(connect(d, { node: "a", anchor: "s" }, { node: "b", anchor: "n" }, { route: "orthogonal" })).diagram;
    d = must(connect(d, { node: "b", anchor: "e" }, { x: 900, y: 400 }, { route: "free" })).diagram;
    d = { ...d, edges: d.edges.map((e, i) => (i === 0 ? { ...e, waypoints: [{ x: 120, y: 150 }] } : { ...e, points: [{ x: 600, y: 300 }], smooth: true })) };
    d = setEdgeStyle(d, [d.edges[0]!.id], { color: "#dc2626", width: "thick", endCap: "diamond" });
    const v2 = serializeDiagram(d);
    const v1 = JSON.stringify({ nodes: [{ id: "x", shape: "process", x: 0, y: 0, w: 140, h: 60, text: "Antiguo", color: "#dcfce7" }, { id: "y", shape: "process", x: 300, y: 0, w: 140, h: 60, text: "Viejo", color: "#dbeafe" }], edges: [{ id: "e", from: "x", to: "y", label: "sí" }] });

    const ws = must(await mgr.create({ name: "Origen" }));
    const { store } = must(await mgr.open(ws.id));
    const svc = new PageService(store, clock);
    const p2 = must(await svc.create({ title: "Nuevo" })); must(await svc.saveUpdate(p2.id, docWith(v2)));
    const p1 = must(await svc.create({ title: "Antiguo" })); must(await svc.saveUpdate(p1.id, docWith(v1)));
    await saveShapeDefault(store, completeNodeStyle("process", { fill: "palette:green" }));
    await saveEdgeDefault(store, completeEdgeStyle({ width: "thick" }), "curved");
    await runBackup({ store, assets: assetsFor(ws.location), client, clock, workspace: { id: ws.id, name: "Origen" } }, { onExternalChange: "continue" });

    const files = must(await readBackup(client, gh.headSha()!));
    expect(files.has("diagram-defaults.json")).toBe(true);
    const r = must(await restoreAsNewWorkspace(mgr, assetsFor, files, { name: "Restaurado" }));
    const dst = must(await mgr.open(r.workspace.id)).store;

    expect(await loadDiagramDefaults(dst)).toEqual(await loadDiagramDefaults(store));
    const files2 = await serializeWorkspace({ store: dst, assets: assetsFor(r.workspace.location) }, { id: r.workspace.id, name: "Restaurado" });
    const read = (id: string) => JSON.parse(new TextDecoder().decode(files2.files.get(`data/${id}.json`)!)).blocks[0].props.data as string;
    expect(read(p2.id)).toBe(v2);
    expect(read(p1.id)).toBe(v1);                                    // el v1 se restaura tal cual, sin reescribirlo
    const opened = must(parseDiagram(read(p1.id)));                  // y al abrirlo se migra
    expect(opened.nodes[0]!.style.fill).toBe("palette:green"); expect(opened.edges[0]).toMatchObject({ from: { node: "x", anchor: "e" }, to: { node: "y", anchor: "w" }, label: "sí" });
    expect(must(parseDiagram(read(p2.id)))).toEqual(d);
  });
});
