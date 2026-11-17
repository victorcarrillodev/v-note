// Limpieza de archivos sin referencia (plan 005, §5.4 y DP-9). Tareas E-057 a E-061.
import { describe, it, expect, beforeEach } from "vitest";
import * as Y from "yjs";
import { createNodeSqliteStore } from "../../tests/support/nodeSqliteStore";
import { migrate } from "../db/migrate";
import { migrations } from "../db/migrations";
import type { SqlStore } from "../ports/sqlStore";
import { PagesRepo } from "../pages/pagesRepo";
import { DocStore } from "../docs/docStore";
import { FakeClock } from "../clock";
import { toYjs } from "../blocks/toYjs";
import { MemoryAssetStore } from "./memoryAssetStore";
import { assetUrl } from "./attach";
import { assetRefsIn, collectAssetRefs, gcAssets } from "./gc";

const must = <T>(r: { ok: boolean; value?: T; error?: unknown }): T => { if (!r.ok) throw new Error(JSON.stringify(r.error)); return r.value as T; };
const bytes = (s: string) => new TextEncoder().encode(s);

let db: SqlStore;
let repo: PagesRepo;
let assets: MemoryAssetStore;
const clock = new FakeClock(1);
beforeEach(async () => {
  db = await createNodeSqliteStore(":memory:");
  await migrate(db, migrations);
  repo = new PagesRepo(db, clock);
  assets = new MemoryAssetStore();
});

const newAsset = async (s: string) => (await assets.put(bytes(s))).hash;
const writeDoc = async (pageId: string, imageHash: string) => {
  const doc = new Y.Doc();
  toYjs([{ id: "img", type: "image", props: { url: assetUrl(imageHash), name: "foto.png" }, content: undefined, children: [] }], doc.getXmlFragment("doc"));
  must(await new DocStore(db, clock).appendUpdate(pageId, Y.encodeStateAsUpdate(doc)));
};
const refs = async () => [...must(await collectAssetRefs(db))].sort();

describe("assetRefsIn", () => {
  it("encuentra referencias con prefijo y en JSON, e ignora lo que no es un hash", () => {
    const [h1, h2] = ["a".repeat(64), "b".repeat(64)];
    const out = new Set<string>();
    assetRefsIn(`{"url":"asset:${h1}"} [{"hash":"${h2}"}] asset:xyz asset:${"C".repeat(64)} ${"e".repeat(63)}`, out);
    expect([...out].sort()).toEqual([h1, h2]);
  });
  it("un hash pegado a otros caracteres hexadecimales también cuenta", () => {
    const h = "0123456789abcdef".repeat(4);
    const out = new Set<string>();
    assetRefsIn(`\u0001a${h}b`, out);
    expect(out.has(h)).toBe(true);
  });
});

describe("collectAssetRefs", () => {
  it("recoge las portadas de páginas vivas y en la papelera (E-057)", async () => {
    const [a, b] = [await newAsset("a"), await newAsset("b")];
    const live = must(await repo.create({ title: "Viva" }));
    const gone = must(await repo.create({ title: "Papelera" }));
    must(await repo.setCover(live.id, assetUrl(a)));
    must(await repo.setCover(gone.id, assetUrl(b)));
    must(await repo.trash(gone.id));
    expect(await refs()).toEqual([a, b].sort());
  });
  it("recoge las imágenes del contenido de los documentos Yjs (E-058)", async () => {
    const h = await newAsset("img");
    const page = must(await repo.create({ title: "Con imagen" }));
    await writeDoc(page.id, h);
    expect(await refs()).toEqual([h]);
  });
  it("recoge las referencias de bases de datos y de meta (E-059)", async () => {
    const [cell, view, meta] = [await newAsset("celda"), await newAsset("vista"), await newAsset("meta")];
    const row = must(await repo.create({ title: "Fila" }));
    await db.exec("INSERT INTO databases(id, name, created_at, updated_at) VALUES ('d1', 'Base', 1, 1)");
    await db.exec("INSERT INTO properties(id, database_id, name, type, position) VALUES ('p1', 'd1', 'Archivos', 'files', 'a0')");
    await db.exec("INSERT INTO db_rows(database_id, page_id, position, created_at, updated_at) VALUES ('d1', ?, 'a0', 1, 1)", [row.id]);
    await db.exec("INSERT INTO cell_values(database_id, page_id, property_id, value) VALUES ('d1', ?, 'p1', ?)", [row.id, JSON.stringify([{ hash: cell, name: "x.pdf", size: 4 }])]);
    await db.exec("INSERT INTO views(id, database_id, name, type, position, config) VALUES ('v1', 'd1', 'Galería', 'gallery', 'a0', ?)", [JSON.stringify({ cover: assetUrl(view) })]);
    await db.exec("INSERT INTO meta(key, value) VALUES ('algo', ?)", [JSON.stringify({ image: assetUrl(meta) })]);
    expect(await refs()).toEqual([cell, view, meta].sort());
  });
  it("una página con portada y estilo en la papelera los conserva al restaurarse, y su archivo no se limpia mientras tanto (CL-6)", async () => {
    const h = await newAsset("portada");
    const page = must(await repo.create({ title: "Con portada" }));
    must(await repo.setProps(page.id, { cover: assetUrl(h), style: { accent: "blue" }, description: "Resumen" }));
    must(await repo.trash(page.id));
    must(await gcAssets({ store: db, assets }));
    expect(await assets.list()).toEqual([h]); // sigue en el almacén
    const back = must(await repo.restore(page.id));
    expect(back).toMatchObject({ cover: assetUrl(h), style: { accent: "blue" }, description: "Resumen" });
  });
  it("falla si un documento no se puede leer", async () => {
    const page = must(await repo.create({ title: "Dañada" }));
    await db.exec("INSERT INTO page_docs(page_id, seq, kind, data, created_at) VALUES (?, 99, 'update', ?, 1)", [page.id, new Uint8Array([255, 255, 255])]);
    expect((await collectAssetRefs(db)).ok).toBe(false);
  });
});

describe("gcAssets", () => {
  it("borra los huérfanos y conserva los referenciados (E-060)", async () => {
    const [kept, orphan] = [await newAsset("usada"), await newAsset("huérfana")];
    must(await repo.setCover(must(await repo.create({ title: "A" })).id, assetUrl(kept)));
    expect(must(await gcAssets({ store: db, assets })).removed).toEqual([orphan]);
    expect((await assets.list()).sort()).toEqual([kept]);
  });
  it("la misma imagen en dos páginas no se borra al quitarla de una (CL-5)", async () => {
    const h = await newAsset("compartida");
    const [a, b] = [must(await repo.create({ title: "A" })), must(await repo.create({ title: "B" }))];
    must(await repo.setCover(a.id, assetUrl(h)));
    must(await repo.setCover(b.id, assetUrl(h)));
    must(await repo.setCover(a.id, null));
    must(await gcAssets({ store: db, assets }));
    expect(await assets.list()).toEqual([h]);
  });
  it("es idempotente", async () => {
    const kept = await newAsset("usada");
    await newAsset("huérfana");
    await writeDoc(must(await repo.create({ title: "A" })).id, kept);
    must(await gcAssets({ store: db, assets }));
    expect(must(await gcAssets({ store: db, assets })).removed).toEqual([]);
    expect(await assets.list()).toEqual([kept]);
  });
  it("no borra nada si falla cualquier lectura (E-061)", async () => {
    await newAsset("huérfana");
    const page = must(await repo.create({ title: "Dañada" }));
    await db.exec("INSERT INTO page_docs(page_id, seq, kind, data, created_at) VALUES (?, 99, 'update', ?, 1)", [page.id, new Uint8Array([255, 255, 255])]);
    const before = (await assets.list()).sort();
    expect((await gcAssets({ store: db, assets })).ok).toBe(false);
    expect((await assets.list()).sort()).toEqual(before);
  });
  it("no borra nada si falla la lista del almacén", async () => {
    const failing = Object.assign(Object.create(assets) as MemoryAssetStore, { list: async () => { throw new Error("sin acceso"); } });
    expect((await gcAssets({ store: db, assets: failing })).ok).toBe(false);
  });
});
