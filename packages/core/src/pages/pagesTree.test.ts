// T-049 a T-056 (prueba primero): mover, impedir ciclos, reordenar, favoritas, ícono/portada, duplicar y migas de pan.
import { describe, it, expect, beforeEach } from "vitest";
import fc from "fast-check";
import { createNodeSqliteStore } from "../../tests/support/nodeSqliteStore";
import { migrate } from "../db/migrate";
import { migrations } from "../db/migrations";
import { FakeClock } from "../clock";
import { PagesRepo, type Page } from "./pagesRepo";
import type { SqlStore } from "../ports/sqlStore";

let db: SqlStore;
let pages: PagesRepo;
beforeEach(async () => {
  db = await createNodeSqliteStore(":memory:");
  await migrate(db, migrations);
  pages = new PagesRepo(db, new FakeClock(1_000));
});
const mk = async (title: string, parentId: string | null = null): Promise<Page> => {
  const r = await pages.create({ title, parentId });
  if (!r.ok) throw new Error("no se pudo crear");
  return r.value;
};
const titles = (ps: Page[]) => ps.map((p) => p.title);

describe("mover (T-049)", () => {
  it("cambia de padre y los descendientes siguen bajo la página movida", async () => {
    const a = await mk("a"); const b = await mk("b"); const c = await mk("c", a.id); const d = await mk("d", c.id);
    const r = await pages.move(a.id, b.id);
    expect(r.ok).toBe(true);
    expect(titles(await pages.children(b.id))).toEqual(["a"]);
    expect(titles(await pages.children(a.id))).toEqual(["c"]);
    expect(titles(await pages.children(c.id))).toEqual(["d"]);
    expect((await pages.ancestors(d.id)).map((p) => p.title)).toEqual(["b", "a", "c"]);
  });
  it("mover a la raíz", async () => {
    const a = await mk("a"); const b = await mk("b", a.id);
    await pages.move(b.id, null);
    expect(titles(await pages.children(null))).toEqual(["a", "b"]);
  });
  it("mover una página inexistente o a un padre inexistente devuelve NOT_FOUND", async () => {
    const a = await mk("a");
    expect((await pages.move("x", null)).ok).toBe(false);
    const r = await pages.move(a.id, "no-existe");
    expect(r.ok === false && r.error.code).toBe("NOT_FOUND");
  });
});

describe("impedir ciclos (T-050, CL-4)", () => {
  it("no se puede mover una página dentro de sí misma ni de sus descendientes", async () => {
    const a = await mk("a"); const b = await mk("b", a.id); const c = await mk("c", b.id);
    for (const target of [a.id, b.id, c.id]) {
      const r = await pages.move(a.id, target);
      expect(r.ok === false && r.error.code).toBe("CYCLE");
    }
    expect(titles(await pages.children(null))).toEqual(["a"]); // nada cambió
  });
  it("propiedad: tras cualquier secuencia de movimientos el árbol nunca tiene ciclos", async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(fc.tuple(fc.nat({ max: 7 }), fc.integer({ min: -1, max: 7 })), { maxLength: 40 }), async (ops) => {
        const d = await createNodeSqliteStore(":memory:");
        await migrate(d, migrations);
        const repo = new PagesRepo(d, new FakeClock(0));
        const ids: string[] = [];
        for (let i = 0; i < 8; i++) { const r = await repo.create({ title: `p${i}` }); if (!r.ok) throw new Error("x"); ids.push(r.value.id); }
        for (const [from, to] of ops) await repo.move(ids[from]!, to === -1 ? null : ids[to]!);
        for (const id of ids) {
          let cur: string | null = id; let steps = 0;
          while (cur !== null) {
            const p = await repo.get(cur);
            if (!p.ok) throw new Error("huérfana");
            cur = p.value.parentId;
            if (++steps > ids.length) return false; // ciclo
          }
        }
        return true;
      }),
      { numRuns: 60 },
    );
  }, 60_000);
});

describe("reordenar (T-051)", () => {
  it("coloca la página después de otra, al inicio o al final", async () => {
    const a = await mk("a"); const b = await mk("b"); const c = await mk("c");
    await pages.move(c.id, null, { afterId: null }); // al inicio
    expect(titles(await pages.children(null))).toEqual(["c", "a", "b"]);
    await pages.move(c.id, null, { afterId: a.id }); // después de a
    expect(titles(await pages.children(null))).toEqual(["a", "c", "b"]);
    await pages.move(a.id, null); // al final
    expect(titles(await pages.children(null))).toEqual(["c", "b", "a"]);
  });
});

describe("favoritas, ícono y portada (T-052, T-053)", () => {
  it("marca, desmarca y lista solo las favoritas", async () => {
    const a = await mk("a"); await mk("b"); const c = await mk("c");
    await pages.setFavorite(a.id, true); await pages.setFavorite(c.id, true);
    expect(titles(await pages.favorites())).toEqual(["a", "c"]);
    await pages.setFavorite(a.id, false);
    expect(titles(await pages.favorites())).toEqual(["c"]);
  });
  it("guarda y lee ícono y portada, y permite quitarlos", async () => {
    const a = await mk("a");
    await pages.setIcon(a.id, "📓"); await pages.setCover(a.id, "asset:abc123");
    const g = await pages.get(a.id);
    expect(g.ok && g.value).toMatchObject({ icon: "📓", cover: "asset:abc123" });
    await pages.setIcon(a.id, null);
    const h = await pages.get(a.id);
    expect(h.ok && h.value.icon).toBeNull();
  });
});

describe("duplicar (T-054, T-055)", () => {
  it("sin hijas: copia con id nuevo, mismos datos, justo después de la original", async () => {
    const a = await mk("a"); const b = await mk("b");
    await pages.setIcon(a.id, "⭐");
    await mk("hija", a.id);
    const r = await pages.duplicate(a.id, { withChildren: false });
    expect(r.ok).toBe(true);
    const copy = r.ok ? r.value : (null as never);
    expect(copy.id).not.toBe(a.id);
    expect(copy).toMatchObject({ title: "a", icon: "⭐", parentId: null });
    expect(titles(await pages.children(null))).toEqual(["a", "a", "b"]);
    expect((await pages.children(null))[1]!.id).toBe(copy.id);
    expect(await pages.children(copy.id)).toEqual([]);
    expect(b.id).toBeTruthy();
  });
  it("con hijas: copia todo el subárbol con ids nuevos; las copias solo apuntan a copias", async () => {
    const a = await mk("a"); const b = await mk("b", a.id); const c = await mk("c", b.id); const d = await mk("d", a.id);
    const r = await pages.duplicate(a.id, { withChildren: true });
    if (!r.ok) throw new Error("falló");
    const original = new Set([a.id, b.id, c.id, d.id]);
    const subtree = async (id: string): Promise<Page[]> => {
      const kids = await pages.children(id);
      return [...kids, ...(await Promise.all(kids.map((k) => subtree(k.id)))).flat()];
    };
    const copies = await subtree(r.value.id);
    expect(copies.map((p) => p.title).sort()).toEqual(["b", "c", "d"]);
    for (const p of [r.value, ...copies]) {
      expect(original.has(p.id)).toBe(false);
      expect(original.has(p.parentId ?? "")).toBe(false);
    }
    expect(titles(await pages.children(a.id))).toEqual(["b", "d"]); // la original intacta
  });
});

describe("migas de pan (T-056)", () => {
  it("devuelve la ruta de ancestros de la raíz al padre, y vacía para una raíz", async () => {
    const a = await mk("a"); const b = await mk("b", a.id); const c = await mk("c", b.id);
    expect((await pages.ancestors(c.id)).map((p) => p.title)).toEqual(["a", "b"]);
    expect(await pages.ancestors(a.id)).toEqual([]);
  });
});
