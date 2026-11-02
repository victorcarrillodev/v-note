// T-222 (RNF-11): con 5 000 páginas, las operaciones habituales se mantienen dentro del presupuesto.
// Presupuestos (en el equipo de desarrollo, SQLite en memoria): se miden con margen amplio para no depender de la máquina.
import { describe, it, expect, beforeAll } from "vitest";
import { createNodeSqliteStore } from "../../tests/support/nodeSqliteStore";
import { FakeClock } from "../clock";
import { migrate } from "../db/migrate";
import { migrations } from "../db/migrations";
import { PageService } from "./pageService";
import { PagesRepo } from "./pagesRepo";
import { SearchIndex } from "../search/searchIndex";
import type { SqlStore } from "../ports/sqlStore";

const N = 5000;
let db: SqlStore, svc: PageService, repo: PagesRepo, search: SearchIndex;
const time = async <T,>(f: () => Promise<T>): Promise<[T, number]> => { const t = performance.now(); const r = await f(); return [r, performance.now() - t]; };

beforeAll(async () => {
  db = await createNodeSqliteStore(":memory:");
  await migrate(db, migrations);
  const clock = new FakeClock(1_000);
  svc = new PageService(db, clock);
  repo = new PagesRepo(db, clock);
  search = new SearchIndex(db, clock);
  // 50 carpetas de 100 páginas: un árbol realista de dos niveles, con título distinto para buscar
  for (let f = 0; f < 50; f++) {
    const folder = await svc.create({ title: `Carpeta ${f}` });
    if (!folder.ok) throw new Error("x");
    for (let i = 0; i < 99; i++) {
      const r = await svc.create({ parentId: folder.value.id, title: `Nota ${f}-${i} ${i % 10 === 0 ? "presupuesto" : "diario"}` });
      if (!r.ok) throw new Error("x");
    }
  }
}, 240_000);

describe(`escala de ${N} páginas (RNF-11)`, () => {
  it("hay 5 000 páginas", async () => {
    const [rows] = await time(() => db.query<{ n: number }>("SELECT COUNT(*) AS n FROM pages"));
    expect(rows[0]!.n).toBe(N);
  });
  it("cargar el árbol completo tarda menos de 1 s", async () => {
    const [tree, ms] = await time(() => repo.tree());
    expect(tree.length).toBe(50);
    expect(tree[0]!.children.length).toBe(99);
    expect(ms).toBeLessThan(1000);
  });
  it("buscar tarda menos de 200 ms (mediana de 20 consultas)", async () => {
    const times: number[] = [];
    for (let i = 0; i < 20; i++) { const [hits, ms] = await time(() => search.search({ query: "presupuesto" })); expect(hits.length).toBeGreaterThan(0); times.push(ms); }
    times.sort((a, b) => a - b);
    expect(times[10]!).toBeLessThan(200);
  });
  it("crear una página con 5 000 existentes tarda menos de 100 ms", async () => {
    const [r, ms] = await time(() => svc.create({ title: "Una más" }));
    expect(r.ok).toBe(true);
    expect(ms).toBeLessThan(100);
  });
  it("mover una carpeta con 99 hijas tarda menos de 200 ms", async () => {
    const tree = await repo.tree();
    const [r, ms] = await time(() => repo.move(tree[1]!.page.id, tree[0]!.page.id));
    expect(r.ok).toBe(true);
    expect(ms).toBeLessThan(200);
  });
  it("llevar una carpeta a la papelera y restaurarla (100 páginas) tarda menos de 500 ms", async () => {
    const tree = await repo.tree();
    const id = tree.at(-1)!.page.id;
    const [t1, ms1] = await time(() => repo.trash(id));
    expect(t1.ok).toBe(true);
    const [t2, ms2] = await time(() => repo.restore(id));
    expect(t2.ok).toBe(true);
    expect(ms1).toBeLessThan(500);
    expect(ms2).toBeLessThan(500);
  });
});
