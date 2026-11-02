// T-371 (RNF-11): el grafo de un espacio con 5 000 páginas y 15 000 enlaces se construye y se dispone dentro del presupuesto.
import { describe, it, expect } from "vitest";
import { createNodeSqliteStore } from "../../tests/support/nodeSqliteStore";
import { migrate } from "../db/migrate";
import { migrations } from "../db/migrations";
import { LinkService } from "./linkService";
import { GraphService } from "./graph";
import { forceLayout } from "./forceLayout";

const PAGES = 5000, LINKS = 15000;
describe("grafo grande (T-371)", () => {
  it("construir, filtrar, disponer y consultar retroenlaces con 5 000 páginas", async () => {
    const db = await createNodeSqliteStore(":memory:");
    await migrate(db, migrations);
    await db.transaction(async (tx) => {
      for (let i = 0; i < PAGES; i++) await tx.exec("INSERT INTO pages(id, position, title, kind, created_at, updated_at) VALUES (?,?,?,?,0,0)", [`p${i}`, `a${String(i).padStart(5, "0")}`, `Página ${i}`, i % 50 === 0 ? "board" : "note"]);
      for (let i = 0; i < LINKS; i++) {
        const a = i % PAGES, b = (i * 7919 + 13 + Math.floor(i / PAGES) * 1013) % PAGES;
        if (a !== b) await tx.exec("INSERT OR IGNORE INTO links(from_page_id, to_page_id) VALUES (?,?)", [`p${a}`, `p${b}`]);
      }
    });
    const graph = new GraphService(db);

    let t0 = Date.now();
    const all = await graph.build({});
    const buildMs = Date.now() - t0;
    expect(all.nodes.length).toBe(PAGES);
    expect(all.edges.length).toBeGreaterThan(14000);
    expect(buildMs).toBeLessThan(2000);

    t0 = Date.now();
    const local = await graph.build({ local: { pageId: "p1", depth: 2 } });
    const localMs = Date.now() - t0;
    expect(local.nodes.length).toBeGreaterThan(1);
    expect(local.nodes.length).toBeLessThan(PAGES);
    expect(localMs).toBeLessThan(2000);

    t0 = Date.now();
    const pos = forceLayout(all);
    const layoutMs = Date.now() - t0;
    expect(pos.size).toBe(PAGES);
    expect(layoutMs).toBeLessThan(60_000); // ≈3 s en solitario; con toda la suite en paralelo llega a ≈20 s. Corre en un worker: no bloquea la interfaz

    t0 = Date.now();
    const back = await new LinkService(db).backlinks("p13");
    const backMs = Date.now() - t0;
    expect(Array.isArray(back)).toBe(true);
    expect(backMs).toBeLessThan(200);
    console.log(`T-371 build=${buildMs}ms local=${localMs}ms layout=${layoutMs}ms backlinks=${backMs}ms nodes=${all.nodes.length} edges=${all.edges.length}`);
  }, 120_000);
});
