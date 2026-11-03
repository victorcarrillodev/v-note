// U-116 a U-122 (spec 002, RF-10.3, RNF-11, CL-23): ancho completo por página, con migración, respaldo y restauración compatibles hacia atrás.
import { describe, it, expect, beforeEach } from "vitest";
import fc from "fast-check";
import { createNodeSqliteStore } from "../../tests/support/nodeSqliteStore";
import { FakeGithub } from "../../tests/support/fakeGithub";
import { para, updateFor } from "../../tests/support/builders";
import { migrate } from "../db/migrate";
import { migrations } from "../db/migrations";
import { FakeClock } from "../clock";
import { MemoryAssetStore } from "../assets/memoryAssetStore";
import { PageService } from "./pageService";
import { PagesRepo } from "./pagesRepo";
import { serializeWorkspace } from "../backup/serialize";
import { validateBackup, restoreFromFiles } from "../backup/restore";
import type { SqlStore } from "../ports/sqlStore";

let db: SqlStore, clock: FakeClock, svc: PageService, repo: PagesRepo;
beforeEach(async () => {
  db = await createNodeSqliteStore(":memory:");
  await migrate(db, migrations);
  clock = new FakeClock(1_000);
  svc = new PageService(db, clock);
  repo = new PagesRepo(db, clock);
});
const must = <T>(r: { ok: boolean; value?: T; error?: unknown }): T => { if (!r.ok) throw new Error(JSON.stringify(r.error)); return r.value as T; };
const ser = async (store = db) => serializeWorkspace({ store, assets: new MemoryAssetStore() }, { id: "ws", name: "P" });
const json = async (id: string, store = db) => JSON.parse(new TextDecoder().decode((await ser(store)).files.get(`data/${id}.json`)!));

describe("migración (RF-10.3, art. 5)", () => {
  it("añade la columna con valor por defecto falso", async () => {
    const cols = await db.query<{ name: string; dflt_value: string | null; notnull: number }>("PRAGMA table_info(pages)");
    const c = cols.find((x) => x.name === "full_width");
    expect(c).toBeDefined();
    expect(c!.notnull).toBe(1);
    expect(c!.dflt_value).toBe("0");
  });
  it("las páginas que ya existían quedan en ancho normal al migrar", async () => {
    const old = await createNodeSqliteStore(":memory:");
    const upTo = migrations.filter((m) => m.version < 11);
    await migrate(old, upTo);
    await old.exec("INSERT INTO pages(id, position, title, created_at, updated_at) VALUES ('p1', 'a', 'Vieja', 1, 1)");
    await migrate(old, migrations);
    const r = await new PagesRepo(old, clock).get("p1");
    expect(r.ok && r.value.fullWidth).toBe(false);
  });
  it("es idempotente: migrar de nuevo no cambia nada", async () => {
    expect((await migrate(db, migrations)).ok).toBe(true);
  });
});

describe("leer y escribir (RF-10.3)", () => {
  it("una página nueva está en ancho normal", async () => {
    const p = must(await svc.create({ title: "A" }));
    expect(p.fullWidth).toBe(false);
  });
  it("activar y desactivar se guarda y se lee, y actualiza la fecha de edición", async () => {
    const p = must(await svc.create({ title: "A" }));
    clock.advance(5_000);
    const on = must(await repo.setFullWidth(p.id, true));
    expect(on.fullWidth).toBe(true);
    expect(on.updatedAt).toBe(6_000);
    expect(must(await repo.get(p.id)).fullWidth).toBe(true);
    expect(must(await repo.setFullWidth(p.id, false)).fullWidth).toBe(false);
  });
  it("una página inexistente da error", async () => {
    expect((await repo.setFullWidth("nope", true)).ok).toBe(false);
  });
  it("aparece en el árbol", async () => {
    const p = must(await svc.create({ title: "A" }));
    await repo.setFullWidth(p.id, true);
    expect((await repo.tree())[0]!.page.fullWidth).toBe(true);
  });
  it("duplicar una página conserva su ancho completo", async () => {
    const p = must(await svc.create({ title: "A" }));
    await repo.setFullWidth(p.id, true);
    const copy = must(await repo.duplicate(p.id, { withChildren: false }));
    expect(must(await repo.get(copy.id)).fullWidth).toBe(true);
  });
});

describe("respaldo determinista (RF-10.3, RNF-11)", () => {
  it("solo se escribe cuando es verdadero: las páginas en ancho normal no cambian de bytes", async () => {
    const p = must(await svc.create({ title: "A" }));
    await svc.saveUpdate(p.id, updateFor([para("x")]));
    const before = (await ser()).files.get(`data/${p.id}.json`)!;
    expect(await json(p.id)).not.toHaveProperty("fullWidth");
    await repo.setFullWidth(p.id, true);
    expect(await json(p.id)).toMatchObject({ fullWidth: true });
    await repo.setFullWidth(p.id, false);
    clock.advance(1);
    const after = (await ser()).files.get(`data/${p.id}.json`)!;
    expect(new TextDecoder().decode(after).replace(/"updatedAt":\d+/, "")).toBe(new TextDecoder().decode(before).replace(/"updatedAt":\d+/, ""));
  });
  it("dos respaldos del mismo contenido dan los mismos bytes", async () => {
    const p = must(await svc.create({ title: "A" }));
    await repo.setFullWidth(p.id, true);
    const a = await ser(), b = await ser();
    expect(new TextDecoder().decode(a.files.get(`data/${p.id}.json`)!)).toBe(new TextDecoder().decode(b.files.get(`data/${p.id}.json`)!));
  });
});

describe("restauración (RF-10.3, CL-23)", () => {
  async function restore(files: Map<string, Uint8Array>) {
    const target = await createNodeSqliteStore(":memory:");
    await migrate(target, migrations);
    const r = await restoreFromFiles(files, { store: target, assets: new MemoryAssetStore() });
    expect(r.ok).toBe(true);
    return target;
  }
  it("un respaldo con ancho completo lo restaura", async () => {
    const p = must(await svc.create({ title: "A" }));
    await repo.setFullWidth(p.id, true);
    const target = await restore((await ser()).files);
    expect(must(await new PagesRepo(target, clock).get(p.id)).fullWidth).toBe(true);
  });
  it("un respaldo anterior a esta spec (sin el campo) deja las páginas en ancho normal", async () => {
    const p = must(await svc.create({ title: "A" }));
    const files = new Map((await ser()).files);
    const j = JSON.parse(new TextDecoder().decode(files.get(`data/${p.id}.json`)!));
    delete j.fullWidth;
    files.set(`data/${p.id}.json`, new TextEncoder().encode(JSON.stringify(j)));
    expect((await validateBackup(files)).ok).toBe(true);
    const target = await restore(files);
    expect(must(await new PagesRepo(target, clock).get(p.id)).fullWidth).toBe(false);
  });
  it("un valor que no es booleano verdadero se ignora (queda en ancho normal)", async () => {
    const p = must(await svc.create({ title: "A" }));
    const files = new Map((await ser()).files);
    const j = JSON.parse(new TextDecoder().decode(files.get(`data/${p.id}.json`)!));
    j.fullWidth = "sí";
    files.set(`data/${p.id}.json`, new TextEncoder().encode(JSON.stringify(j)));
    const target = await restore(files);
    expect(must(await new PagesRepo(target, clock).get(p.id)).fullWidth).toBe(false);
  });
});

describe("propiedad de ida y vuelta con ancho completo (RNF-11)", () => {
  it("serializar → restaurar → serializar da exactamente los mismos bytes, con cualquier combinación de anchos", async () => {
    await fc.assert(fc.asyncProperty(fc.array(fc.boolean(), { minLength: 1, maxLength: 6 }), async (flags) => {
      const a = await createNodeSqliteStore(":memory:"); await migrate(a, migrations);
      const sa = new PageService(a, new FakeClock(1_000)); const ra = new PagesRepo(a, new FakeClock(1_000));
      for (const [i, f] of flags.entries()) { const p = must(await sa.create({ title: `P${i}` })); if (f) await ra.setFullWidth(p.id, true); }
      const first = await ser(a);
      const b = await createNodeSqliteStore(":memory:"); await migrate(b, migrations);
      expect((await restoreFromFiles(first.files, { store: b, assets: new MemoryAssetStore() })).ok).toBe(true);
      const second = await ser(b);
      for (const [path, bytes] of first.files) if (path.startsWith("data/")) expect(new TextDecoder().decode(second.files.get(path)!)).toBe(new TextDecoder().decode(bytes));
    }), { numRuns: 100 });
  }, 60_000);
});

describe("documentación del formato (U-122)", () => {
  it("backup-format.md describe el campo, su regla de escritura y la compatibilidad", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const doc = readFileSync(resolve(__dirname, "../../../../docs/backup-format.md"), "utf8");
    expect(doc).toContain("fullWidth");
    expect(doc).toMatch(/solo cuando es `true`/);
    expect(doc).toMatch(/formatVersion` sigue en 1/);
    expect(doc).toMatch(/anterior a esta spec/);
  });
});
