// T-212 a T-217 (prueba primero): leer, validar y restaurar un respaldo; respaldar y restaurar es la identidad.
import { describe, it, expect, beforeEach } from "vitest";
import fc from "fast-check";
import { createNodeSqliteStore } from "../../tests/support/nodeSqliteStore";
import { FakeGithub } from "../../tests/support/fakeGithub";
import { para, updateFor } from "../../tests/support/builders";
import { migrate } from "../db/migrate";
import { migrations } from "../db/migrations";
import { FakeClock } from "../clock";
import { MemoryAssetStore } from "../assets/memoryAssetStore";
import { PageService } from "../pages/pageService";
import { PagesRepo } from "../pages/pagesRepo";
import { SearchIndex } from "../search/searchIndex";
import { GitHubClient } from "./githubClient";
import { runBackup } from "./runBackup";
import { serializeWorkspace } from "./serialize";
import { stableJson } from "./stableJson";
import { listBackups, readBackup, restoreFromFiles } from "./restore";
import type { SqlStore } from "../ports/sqlStore";

const DAY = 86_400_000;
let db: SqlStore;
let assets: MemoryAssetStore;
let gh: FakeGithub;
let client: GitHubClient;
let clock: FakeClock;
let svc: PageService;
beforeEach(async () => {
  db = await createNodeSqliteStore(":memory:");
  await migrate(db, migrations);
  assets = new MemoryAssetStore();
  gh = new FakeGithub();
  client = new GitHubClient({ fetch: gh.fetch, token: gh.token, owner: "yo", repo: "r" });
  clock = new FakeClock(Date.UTC(2026, 9, 1, 12));
  svc = new PageService(db, clock);
});
const must = <T>(r: { ok: boolean; value?: T; error?: unknown }): T => { if (!r.ok) throw new Error(JSON.stringify(r.error)); return r.value as T; };
const backup = () => runBackup({ store: db, assets, client, clock, workspace: { id: "ws", name: "Personal" } }, { onExternalChange: "continue" });
const fresh = async () => { const s = await createNodeSqliteStore(":memory:"); await migrate(s, migrations); return { store: s, assets: new MemoryAssetStore() }; };
async function seed() {
  const a = must(await svc.create({ title: "Proyectos" }));
  await svc.saveUpdate(a.id, updateFor([para("plan general")]));
  const b = must(await svc.create({ title: "Ideas", parentId: a.id }));
  await svc.saveUpdate(b.id, updateFor([para("una idea con tortillas")]));
  const c = must(await svc.create({ title: "Vieja" }));
  await svc.saveUpdate(c.id, updateFor([para("contenido borrado")]));
  const repo = new PagesRepo(db, clock);
  await repo.setIcon(a.id, "📁"); await repo.setFavorite(a.id, true);
  await repo.trash(c.id);
  await assets.put(new TextEncoder().encode("adjunto uno"));
  await assets.put(new Uint8Array([1, 2, 3, 250]));
  return { a, b, c };
}
const filesOf = async (s: SqlStore, a: MemoryAssetStore) => (await serializeWorkspace({ store: s, assets: a }, { id: "ws", name: "Personal" })).files;
const asMap = (f: Map<string, Uint8Array>) => new Map([...f].map(([k, v]) => [k, [...v].join(",")]));

describe("listar respaldos (T-212)", () => {
  it("devuelve los commits por fecha, el más reciente primero", async () => {
    await seed(); await backup();
    clock.advance(DAY); await svc.create({ title: "Otra" }); await backup();
    clock.advance(DAY); await svc.create({ title: "Más" }); await backup();
    const list = must(await listBackups(client, "main"));
    expect(list).toHaveLength(3);
    expect(list[0]!.message).toContain("1 página");
    expect(list.map((x) => x.sha)).toEqual([...list].map((x) => x.sha));
    expect(new Date(list[0]!.date).getTime()).toBeGreaterThanOrEqual(new Date(list[2]!.date).getTime());
  });
  it("un repositorio sin respaldos devuelve una lista vacía", async () => {
    expect(must(await listBackups(client, "main"))).toEqual([]);
  });
});

describe("leer y validar un respaldo (T-213)", () => {
  it("lee del commit exactamente los mismos archivos que se serializaron", async () => {
    await seed(); await backup();
    const files = must(await readBackup(client, gh.headSha()!));
    const needed = new Map([...(await filesOf(db, assets))].filter(([k]) => !k.startsWith("pages/")));
    expect(asMap(files)).toEqual(asMap(needed));
  });
  it("solo descarga los archivos que la restauración necesita (no los Markdown de lectura)", async () => {
    await seed(); await backup();
    const before = gh.requests.length;
    const files = must(await readBackup(client, gh.headSha()!));
    expect([...files.keys()].some((k) => k.startsWith("pages/"))).toBe(false);
    expect(gh.requests.slice(before).filter((r) => /\/git\/blobs\//.test(r.url)).length).toBe(files.size);
  });
});

describe("rechazar sin tocar nada (T-214, CL-23)", () => {
  const dumpAll = async (s: SqlStore) => JSON.stringify([await s.query("SELECT * FROM pages ORDER BY id"), await s.query("SELECT * FROM page_docs"), await s.query("SELECT * FROM meta")]);
  const tamper = async (mut: (f: Map<string, Uint8Array>) => void) => {
    await seed(); await backup();
    const files = must(await readBackup(client, gh.headSha()!));
    mut(files);
    const target = await fresh();
    const before = await dumpAll(target.store);
    const r = await restoreFromFiles(files, target);
    return { r, unchanged: (await dumpAll(target.store)) === before, target };
  };
  const enc = (o: unknown) => new TextEncoder().encode(stableJson(o));
  it("una versión de formato futura se rechaza con UNSUPPORTED_VERSION", async () => {
    const { r, unchanged } = await tamper((f) => f.set("workspace.json", enc({ formatVersion: 99, id: "x", name: "n", pageCount: 0 })));
    expect(r.ok === false && r.error.code).toBe("UNSUPPORTED_VERSION");
    expect(unchanged).toBe(true);
  });
  it("sin workspace.json o con JSON dañado se rechaza como INVALID", async () => {
    const a = await tamper((f) => f.delete("workspace.json"));
    expect(a.r.ok === false && a.r.error.code).toBe("INVALID");
    expect(a.unchanged).toBe(true);
    const b = await tamper((f) => f.set("workspace.json", new TextEncoder().encode("{no es json")));
    expect(b.r.ok === false && b.r.error.code).toBe("INVALID");
  });
  it("una página dañada a mitad de la restauración no deja nada a medias", async () => {
    const { r, unchanged } = await tamper((f) => { const k = [...f.keys()].find((x) => x.startsWith("data/"))!; f.set(k, new TextEncoder().encode("{\"id\": 5")); });
    expect(r.ok === false && r.error.code).toBe("INVALID");
    expect(unchanged).toBe(true);
  });
  it("una página con un padre inexistente se rechaza", async () => {
    const { r, unchanged } = await tamper((f) => {
      const k = [...f.keys()].find((x) => x.startsWith("data/"))!;
      const d = JSON.parse(new TextDecoder().decode(f.get(k)));
      f.set(k, enc({ ...d, parentId: "no-existe" }));
    });
    expect(r.ok === false && r.error.code).toBe("INVALID");
    expect(unchanged).toBe(true);
  });
  it("un adjunto cuyo contenido no coincide con su hash se rechaza", async () => {
    const { r, unchanged, target } = await tamper((f) => { const k = [...f.keys()].find((x) => x.startsWith("assets/"))!; f.set(k, new Uint8Array([9, 9, 9])); });
    expect(r.ok === false && r.error.code).toBe("INVALID");
    expect(unchanged).toBe(true);
    expect(await target.assets.list()).toEqual([]);
  });
  it("nunca restaura sobre un espacio que ya tiene contenido (hay que pedir confirmación antes)", async () => {
    await seed(); await backup();
    const files = must(await readBackup(client, gh.headSha()!));
    const r = await restoreFromFiles(files, { store: db, assets });
    expect(r.ok === false && r.error.code).toBe("NEEDS_CONFIRMATION");
  });
});

describe("reconstruir páginas, jerarquía, adjuntos y papelera (T-215, T-216)", () => {
  it("el espacio restaurado es idéntico al original, byte a byte", async () => {
    await seed(); await backup();
    const files = must(await readBackup(client, gh.headSha()!));
    const target = await fresh();
    expect((await restoreFromFiles(files, target)).ok).toBe(true);
    expect(asMap(await filesOf(target.store, target.assets))).toEqual(asMap(await filesOf(db, assets)));
  });
  it("jerarquía, ícono, favorita, fechas y contenido se conservan", async () => {
    const { a, b } = await seed(); await backup();
    const target = await fresh();
    must(await restoreFromFiles(must(await readBackup(client, gh.headSha()!)), target));
    const repo = new PagesRepo(target.store, clock);
    const tree = await repo.tree();
    expect(tree.map((n) => [n.page.title, n.page.icon, n.page.favorite])).toEqual([["Proyectos", "📁", true]]);
    expect(tree[0]!.children.map((n) => n.page.id)).toEqual([b.id]);
    expect(must(await repo.get(a.id)).createdAt).toBe(must(await new PagesRepo(db, clock).get(a.id)).createdAt);
  });
  it("la búsqueda funciona de inmediato en el espacio restaurado", async () => {
    await seed(); await backup();
    const target = await fresh();
    must(await restoreFromFiles(must(await readBackup(client, gh.headSha()!)), target));
    expect((await new SearchIndex(target.store, clock).search({ query: "tortillas" })).map((h) => h.title)).toEqual(["Ideas"]);
  });
  it("los adjuntos vuelven idénticos y la papelera conserva su fecha de eliminación", async () => {
    const { c } = await seed(); await backup();
    const target = await fresh();
    must(await restoreFromFiles(must(await readBackup(client, gh.headSha()!)), target));
    expect((await target.assets.list()).sort()).toEqual((await assets.list()).sort());
    for (const h of await assets.list()) expect([...(await target.assets.get(h))!]).toEqual([...(await assets.get(h))!]);
    const trash = await new PagesRepo(target.store, clock).trashList();
    expect(trash.map((t) => [t.page.id, t.page.deletedAt])).toEqual([[c.id, clock.now()]]);
  });
  it("el espacio restaurado se puede seguir usando (editar, respaldar de nuevo)", async () => {
    await seed(); await backup();
    const target = await fresh();
    must(await restoreFromFiles(must(await readBackup(client, gh.headSha()!)), target));
    const svc2 = new PageService(target.store, clock);
    const p = must(await svc2.create({ title: "Nueva tras restaurar" }));
    expect((await svc2.saveUpdate(p.id, updateFor([para("sigue funcionando")]))).ok).toBe(true);
  });
});

describe("propiedad: respaldar y restaurar es la identidad (T-217)", () => {
  it("para cualquier espacio, serializar -> restaurar -> serializar da exactamente los mismos bytes", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.record({ title: fc.stringMatching(/^[A-Za-zñé ]{0,10}$/), body: fc.stringMatching(/^[a-z ]{0,25}$/), parent: fc.integer({ min: -1, max: 5 }), trash: fc.boolean(), fav: fc.boolean() }), { minLength: 1, maxLength: 7 }),
        fc.array(fc.uint8Array({ maxLength: 20 }), { maxLength: 3 }),
        async (spec, blobs) => {
          const s = await createNodeSqliteStore(":memory:");
          await migrate(s, migrations);
          const a = new MemoryAssetStore();
          const c = new FakeClock(5000);
          const sv = new PageService(s, c);
          const ids: string[] = [];
          for (let i = 0; i < spec.length; i++) {
            const parent = spec[i]!.parent >= 0 && spec[i]!.parent < i ? ids[spec[i]!.parent]! : null;
            const p = must(await sv.create({ title: spec[i]!.title, parentId: parent }));
            ids.push(p.id);
            if (spec[i]!.body) await sv.saveUpdate(p.id, updateFor([para(spec[i]!.body)]));
            if (spec[i]!.fav) await new PagesRepo(s, c).setFavorite(p.id, true);
          }
          for (let i = 0; i < spec.length; i++) if (spec[i]!.trash) await new PagesRepo(s, c).trash(ids[i]!);
          for (const b of blobs) await a.put(b);
          const first = await serializeWorkspace({ store: s, assets: a }, { id: "w", name: "n" });
          const t = await fresh();
          const restored = await restoreFromFiles(first.files, t);
          if (!restored.ok) return false;
          const second = await serializeWorkspace({ store: t.store, assets: t.assets }, { id: "w", name: "n" });
          return JSON.stringify([...asMap(first.files)]) === JSON.stringify([...asMap(second.files)]);
        },
      ),
      { numRuns: 120 },
    );
  }, 120_000);
});

describe("las menciones sobreviven al respaldo y se reindexan (T-360, RF-6)", () => {
  it("tras restaurar, los retroenlaces vuelven a existir", async () => {
    const { a } = await seed();
    const b = must(await svc.create({ title: "Con enlace" }));
    await svc.saveUpdate(b.id, updateFor([{ ...para("ver"), content: [{ type: "text", text: "ver ", styles: {} }, { type: "mention", pageId: a.id, title: "Proyectos" }] }]));
    await backup();
    const files = must(await readBackup(client, gh.headSha()!));
    const target = await fresh();
    must(await restoreFromFiles(files, target));
    expect(await target.store.query("SELECT from_page_id, to_page_id FROM links")).toEqual([{ from_page_id: b.id, to_page_id: a.id }]);
  });
});
