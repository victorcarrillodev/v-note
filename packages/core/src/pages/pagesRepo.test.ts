// T-044, T-045, T-046, T-047, T-048 (prueba primero): repositorio de páginas y árbol.
import { describe, it, expect, beforeEach } from "vitest";
import fc from "fast-check";
import { createNodeSqliteStore } from "../../tests/support/nodeSqliteStore";
import { migrate } from "../db/migrate";
import { migrations } from "../db/migrations";
import { FakeClock } from "../clock";
import { PagesRepo, isUntitled } from "./pagesRepo";
import type { SqlStore } from "../ports/sqlStore";

let db: SqlStore;
let clock: FakeClock;
let pages: PagesRepo;
beforeEach(async () => {
  db = await createNodeSqliteStore(":memory:");
  await migrate(db, migrations);
  clock = new FakeClock(1_000);
  pages = new PagesRepo(db, clock);
});
const must = <T>(r: { ok: boolean; value?: T; error?: unknown }): T => {
  if (!r.ok) throw new Error(JSON.stringify(r.error));
  return r.value as T;
};

describe("crear, leer y renombrar (T-044)", () => {
  it("crea una página en la raíz con valores por defecto", async () => {
    const p = must(await pages.create({ title: "Inicio" }));
    expect(p).toMatchObject({ title: "Inicio", parentId: null, kind: "note", favorite: false, createdAt: 1_000, updatedAt: 1_000, deletedAt: null });
    expect(must(await pages.get(p.id))).toEqual(p);
  });
  it("renombrar actualiza el título y la fecha de edición", async () => {
    const p = must(await pages.create({ title: "A" }));
    clock.advance(500);
    const r = must(await pages.rename(p.id, "B"));
    expect(r.title).toBe("B");
    expect(r.updatedAt).toBe(1_500);
    expect(r.createdAt).toBe(1_000);
  });
  it("get y rename sobre una página inexistente devuelven NOT_FOUND", async () => {
    const g = await pages.get("no-existe");
    const r = await pages.rename("no-existe", "x");
    expect(g.ok === false && g.error.code).toBe("NOT_FOUND");
    expect(r.ok === false && r.error.code).toBe("NOT_FOUND");
  });
  it("crear con un padre inexistente falla con NOT_FOUND", async () => {
    const r = await pages.create({ parentId: "no-existe" });
    expect(r.ok === false && r.error.code).toBe("NOT_FOUND");
  });
});

describe("títulos (T-045)", () => {
  it("CL-2: un título vacío se guarda y se reconoce como sin título", async () => {
    const p = must(await pages.create({}));
    expect(p.title).toBe("");
    expect(isUntitled(p.title)).toBe(true);
    expect(isUntitled("   ")).toBe(true);
    expect(isUntitled("Hola")).toBe(false);
  });
  it("CL-1: dos páginas con el mismo título coexisten con ids distintos", async () => {
    const a = must(await pages.create({ title: "Igual" }));
    const b = must(await pages.create({ title: "Igual" }));
    expect(a.id).not.toBe(b.id);
    expect((await pages.children(null)).length).toBe(2);
  });
  it("CL-3: una página sin título ni contenido se conserva", async () => {
    const p = must(await pages.create({}));
    expect(must(await pages.get(p.id)).id).toBe(p.id);
  });
});

describe("árbol (T-046, T-047, T-048)", () => {
  it("las hijas salen en el orden de creación y cada nivel es independiente", async () => {
    const r = must(await pages.create({ title: "raíz" }));
    const a = must(await pages.create({ parentId: r.id, title: "a" }));
    const b = must(await pages.create({ parentId: r.id, title: "b" }));
    const c = must(await pages.create({ parentId: a.id, title: "c" }));
    expect((await pages.children(r.id)).map((p) => p.title)).toEqual(["a", "b"]);
    expect((await pages.children(a.id)).map((p) => p.title)).toEqual(["c"]);
    expect(await pages.children(b.id)).toEqual([]);
    const tree = await pages.tree();
    expect(tree).toEqual([
      { page: expect.objectContaining({ title: "raíz" }), children: [
        { page: expect.objectContaining({ title: "a" }), children: [{ page: expect.objectContaining({ id: c.id }), children: [] }] },
        { page: expect.objectContaining({ title: "b" }), children: [] },
      ] },
    ]);
  });
  it("soporta 1 000 niveles de profundidad", async () => {
    let parent: string | null = null;
    for (let i = 0; i < 1000; i++) parent = must(await pages.create({ parentId: parent, title: `n${i}` })).id;
    const tree = await pages.tree();
    let depth = 0;
    let node = tree[0];
    while (node) { depth++; node = node.children[0]; }
    expect(depth).toBe(1000);
  }, 60_000);
  it("las posiciones entre hermanas son estables y estrictamente crecientes", async () => {
    for (let i = 0; i < 30; i++) await pages.create({ title: `p${i}` });
    const pos = (await pages.children(null)).map((p) => p.position);
    expect([...pos].sort()).toEqual(pos);
    expect(new Set(pos).size).toBe(pos.length);
  });
});

describe("posiciones fraccionarias (T-047)", () => {
  it("insertar entre dos posiciones siempre queda estrictamente en medio", async () => {
    const { positionBetween } = await import("./positions");
    fc.assert(
      fc.property(fc.array(fc.nat({ max: 5 }), { minLength: 1, maxLength: 60 }), (choices) => {
        const list: string[] = [positionBetween(null, null)];
        for (const c of choices) {
          const i = c % (list.length + 1); // posición de inserción 0..n
          const before = i === 0 ? null : list[i - 1]!;
          const after = i === list.length ? null : list[i]!;
          list.splice(i, 0, positionBetween(before, after));
        }
        const sorted = [...list].sort();
        return JSON.stringify(sorted) === JSON.stringify(list) && new Set(list).size === list.length;
      }),
      { numRuns: 300 },
    );
  });
});
