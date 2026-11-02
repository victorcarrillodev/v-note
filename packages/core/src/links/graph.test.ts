// T-365, T-366, T-370 (parte de núcleo) (prueba primero): API del grafo, vista local, filtros y disposición de fuerzas.
import { describe, it, expect, beforeEach } from "vitest";
import { createNodeSqliteStore } from "../../tests/support/nodeSqliteStore";
import { FakeClock } from "../clock";
import { migrate } from "../db/migrate";
import { migrations } from "../db/migrations";
import { PagesRepo } from "../pages/pagesRepo";
import type { SqlStore } from "../ports/sqlStore";
import { GraphService, type GraphData } from "./graph";
import { createLayout, forceLayout } from "./forceLayout";
import { GraphLayoutClient, serveGraphLayout } from "./graphWorker";

let db: SqlStore, repo: PagesRepo, graph: GraphService;
const ids: Record<string, string> = {};
const must = <T,>(r: { ok: boolean; value?: T; error?: { message: string } }): T => { if (!r.ok) throw new Error(r.error?.message); return r.value as T; };
const link = (a: string, b: string) => db.exec("INSERT INTO links(from_page_id, to_page_id) VALUES (?, ?)", [ids[a]!, ids[b]!]);
const names = (g: GraphData) => g.nodes.map((n) => n.title).sort();
const pairs = (g: GraphData) => g.edges.map((e) => `${g.nodes.find((n) => n.id === e.from)!.title}>${g.nodes.find((n) => n.id === e.to)!.title}`).sort();

beforeEach(async () => {
  db = await createNodeSqliteStore(":memory:");
  await migrate(db, migrations);
  const clock = new FakeClock(1_000);
  repo = new PagesRepo(db, clock); graph = new GraphService(db);
  for (const t of ["A", "B", "C", "D", "E"]) ids[t] = must(await repo.create({ title: t, kind: t === "D" ? "board" : "note" })).id;
  await link("A", "B"); await link("B", "C"); await link("C", "A"); // ciclo
  await link("E", "A");
  must(await repo.trash(ids.E!));
});

describe("grafo del espacio (T-365)", () => {
  it("nodos = páginas no eliminadas; aristas = enlaces entre ellas (los ciclos se admiten)", async () => {
    const g = await graph.build({});
    expect(names(g)).toEqual(["A", "B", "C", "D"]);
    expect(pairs(g)).toEqual(["A>B", "B>C", "C>A"]);
    expect(g.nodes.find((n) => n.title === "A")!.degree).toBe(2);
    expect(g.nodes.find((n) => n.title === "D")!.degree).toBe(0);
    expect(g.hasLinks).toBe(true);
  });
  it("incluir la papelera añade las páginas eliminadas y sus enlaces", async () => {
    const g = await graph.build({ includeTrashed: true });
    expect(names(g)).toEqual(["A", "B", "C", "D", "E"]);
    expect(pairs(g)).toContain("E>A");
    expect(g.nodes.find((n) => n.title === "E")!.trashed).toBe(true);
  });
  it("filtros: ocultar huérfanas y por tipo de página", async () => {
    expect(names(await graph.build({ hideOrphans: true }))).toEqual(["A", "B", "C"]);
    expect(names(await graph.build({ kinds: ["board"] }))).toEqual(["D"]);
  });
  it("vista local: la página y sus vecinas (a profundidad 1 o 2), en ambas direcciones", async () => {
    expect(names(await graph.build({ local: { pageId: ids.A!, depth: 1 } }))).toEqual(["A", "B", "C"]);
    const d = await graph.build({ local: { pageId: ids.D!, depth: 2 } });
    expect(names(d)).toEqual(["D"]);
    expect(d.edges).toEqual([]);
    must(await repo.restore(ids.E!));
    expect(names(await graph.build({ local: { pageId: ids.E!, depth: 1 } }))).toEqual(["A", "E"]);
  });
  it("sin ningún enlace entre páginas, hasLinks es falso (la interfaz muestra la guía)", async () => {
    await db.exec("DELETE FROM links");
    const g = await graph.build({});
    expect(g.hasLinks).toBe(false);
    expect(g.edges).toEqual([]);
  });
  it("hasLinks refleja los enlaces del espacio aunque el filtro oculte todos", async () => {
    expect((await graph.build({ kinds: ["board"] })).hasLinks).toBe(true);
  });
});

describe("disposición de fuerzas (T-366)", () => {
  const big = (n: number): GraphData => ({
    hasLinks: true,
    nodes: Array.from({ length: n }, (_, i) => ({ id: `n${i}`, title: `P${i}`, kind: "note" as const, trashed: false, degree: 2 })),
    edges: Array.from({ length: n * 2 }, (_, i) => ({ from: `n${i % n}`, to: `n${(i * 7 + 3) % n}` })).filter((e) => e.from !== e.to),
  });
  it("termina con 1 000 nodos en tiempo razonable, con posiciones finitas y distintas", () => {
    const t0 = Date.now();
    const pos = forceLayout(big(1000));
    expect(Date.now() - t0).toBeLessThan(15_000);
    expect(pos.size).toBe(1000);
    for (const p of pos.values()) { expect(Number.isFinite(p.x)).toBe(true); expect(Number.isFinite(p.y)).toBe(true); }
    expect(new Set([...pos.values()].map((p) => `${Math.round(p.x)},${Math.round(p.y)}`)).size).toBeGreaterThan(900);
  }, 30_000);
  it("es determinista: la misma entrada da las mismas posiciones", () => {
    const g = big(60);
    expect([...forceLayout(g)]).toEqual([...forceLayout(g)]);
  });
  it("grafo vacío, un nodo y ciclos no fallan", () => {
    expect(forceLayout({ hasLinks: false, nodes: [], edges: [] }).size).toBe(0);
    expect(forceLayout({ hasLinks: false, nodes: [{ id: "x", title: "X", kind: "note", trashed: false, degree: 0 }], edges: [] }).size).toBe(1);
    const cyc: GraphData = { hasLinks: true, nodes: ["a", "b", "c"].map((id) => ({ id, title: id, kind: "note" as const, trashed: false, degree: 2 })), edges: [{ from: "a", to: "b" }, { from: "b", to: "c" }, { from: "c", to: "a" }] };
    expect(forceLayout(cyc).size).toBe(3);
  });
  it("se puede cancelar entre pasos", () => {
    const ac = new AbortController();
    let calls = 0;
    const r = forceLayout(big(300), { onStep: () => { if (++calls === 5) ac.abort(); }, signal: ac.signal });
    expect(r.size).toBe(0);
    expect(calls).toBe(5);
  });
});

describe("disposición en un worker (T-366)", () => {
  const sample = (n: number): GraphData => ({
    hasLinks: true,
    nodes: Array.from({ length: n }, (_, i) => ({ id: `n${i}`, title: `P${i}`, kind: "note" as const, trashed: false, degree: 2 })),
    edges: Array.from({ length: n }, (_, i) => ({ from: `n${i}`, to: `n${(i + 1) % n}` })),
  });
  it("el cliente recibe las mismas posiciones que el cálculo directo", async () => {
    const { MessageChannel } = await import("node:worker_threads");
    const ch = new MessageChannel();
    const wrap = (p: import("node:worker_threads").MessagePort) => ({ postMessage: (m: unknown) => p.postMessage(m), addEventListener: (_: "message", fn: (e: { data: unknown }) => void) => p.on("message", (data) => fn({ data })), start: () => p.start() });
    serveGraphLayout(wrap(ch.port1)); const client = new GraphLayoutClient(wrap(ch.port2));
    const g = sample(80);
    const r = await client.layout(g);
    expect(r.status).toBe("done");
    const direct = createLayout(g); direct.step(direct.total);
    if (r.status === "done") expect([...r.positions]).toEqual([...direct.positions()]);
    ch.port1.close(); ch.port2.close();
  });
  it("cancelar a medio cálculo devuelve «cancelled» sin posiciones", async () => {
    const { MessageChannel } = await import("node:worker_threads");
    const ch = new MessageChannel();
    const wrap = (p: import("node:worker_threads").MessagePort) => ({ postMessage: (m: unknown) => p.postMessage(m), addEventListener: (_: "message", fn: (e: { data: unknown }) => void) => p.on("message", (data) => fn({ data })), start: () => p.start() });
    serveGraphLayout(wrap(ch.port1)); const client = new GraphLayoutClient(wrap(ch.port2));
    const ac = new AbortController();
    const pending = client.layout(sample(1500), { signal: ac.signal, chunk: 1 });
    setTimeout(() => ac.abort(), 20);
    expect((await pending).status).toBe("cancelled");
    ch.port1.close(); ch.port2.close();
  });
});
