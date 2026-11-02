// T-360, T-361, T-362, T-363 (parte de núcleo), T-364 (prueba primero): índice de enlaces, retroenlaces, renombrar, enlaces rotos y ciclos.
import { describe, it, expect, beforeEach } from "vitest";
import { createNodeSqliteStore } from "../../tests/support/nodeSqliteStore";
import * as Y from "yjs";
import { toYjs } from "../blocks/toYjs";
import { para } from "../../tests/support/builders";
import { FakeClock } from "../clock";
import { migrate } from "../db/migrate";
import { migrations } from "../db/migrations";
import { defaultProps, type Block } from "../blocks/types";
import { PageService } from "../pages/pageService";
import { PagesRepo } from "../pages/pagesRepo";
import type { SqlStore } from "../ports/sqlStore";
import { LinkService } from "./linkService";

let db: SqlStore, pages: PageService, repo: PagesRepo, links: LinkService;
const must = <T,>(r: { ok: boolean; value?: T; error?: { message: string } }): T => { if (!r.ok) throw new Error(r.error?.message); return r.value as T; };
let n = 0;
const mentioning = (...targets: { id: string; title: string }[]): Block => ({
  id: `m${++n}`, type: "paragraph", props: defaultProps("paragraph"), children: [],
  content: targets.map((t) => ({ type: "mention" as const, pageId: t.id, title: t.title })),
});
const docs = new Map<string, Y.Doc>();
/** Edición real: reemplaza el contenido del documento de la página y guarda solo la actualización incremental. */
const save = async (page: string, blocks: Block[]) => {
  const doc = docs.get(page) ?? new Y.Doc(); docs.set(page, doc);
  let update: Uint8Array | null = null;
  const on = (u: Uint8Array) => { update = u; };
  doc.on("update", on);
  doc.transact(() => { const f = doc.getXmlFragment("doc"); f.delete(0, f.length); toYjs(blocks, f); });
  doc.off("update", on);
  must(await pages.saveUpdate(page, update!));
};
let a: { id: string; title: string }, b: { id: string; title: string }, c: { id: string; title: string };
beforeEach(async () => {
  docs.clear();
  db = await createNodeSqliteStore(":memory:");
  await migrate(db, migrations);
  const clock = new FakeClock(1_000);
  pages = new PageService(db, clock); repo = new PagesRepo(db, clock); links = new LinkService(db);
  const mk = async (title: string) => { const p = must(await pages.create({ title })); return { id: p.id, title }; };
  a = await mk("A"); b = await mk("B"); c = await mk("C");
});
const rows = async () => (await db.query<{ from_page_id: string; to_page_id: string }>("SELECT * FROM links ORDER BY from_page_id, to_page_id")).map((r) => `${r.from_page_id}>${r.to_page_id}`);

describe("extraer enlaces al guardar (T-360)", () => {
  it("agregar y quitar menciones actualiza la tabla", async () => {
    await save(a.id, [mentioning(b, c)]);
    expect(await rows()).toEqual([`${a.id}>${b.id}`, `${a.id}>${c.id}`].sort());
    await save(a.id, [mentioning(b)]);
    expect(await rows()).toEqual([`${a.id}>${b.id}`]);
    await save(a.id, [para("sin enlaces")]);
    expect(await rows()).toEqual([]);
  });
  it("varias menciones al mismo destino cuentan una vez; las de la propia página se ignoran; las anidadas se encuentran", async () => {
    const nested: Block = { ...para("padre"), children: [mentioning(b, b, a)] };
    await save(a.id, [nested]);
    expect(await rows()).toEqual([`${a.id}>${b.id}`]);
  });
});

describe("retroenlaces (T-361)", () => {
  it("lista las páginas que enlazan, con su título, sin las eliminadas", async () => {
    await save(a.id, [mentioning(c)]); await save(b.id, [mentioning(c)]);
    expect((await links.backlinks(c.id)).map((p) => p.title).sort()).toEqual(["A", "B"]);
    must(await repo.trash(a.id));
    expect((await links.backlinks(c.id)).map((p) => p.title)).toEqual(["B"]);
  });
  it("una página sin enlaces entrantes devuelve una lista vacía", async () => {
    expect(await links.backlinks(a.id)).toEqual([]);
  });
});

describe("renombrar mantiene los enlaces (T-362)", () => {
  it("el enlace sigue y se resuelve con el título nuevo", async () => {
    await save(a.id, [mentioning(b)]);
    must(await pages.rename(b.id, "B renombrada"));
    expect(await rows()).toEqual([`${a.id}>${b.id}`]);
    expect(await links.resolve(b.id)).toEqual({ state: "ok", id: b.id, title: "B renombrada" });
    expect((await links.backlinks(b.id)).map((p) => p.id)).toEqual([a.id]);
  });
});

describe("enlace roto (T-363, CL-5)", () => {
  it("destino en la papelera: se marca y se puede restaurar; eliminado para siempre: no existe", async () => {
    await save(a.id, [mentioning(b, c)]);
    must(await repo.trash(b.id));
    expect(await links.resolve(b.id)).toEqual({ state: "trashed", id: b.id, title: "B" });
    must(await repo.restore(b.id));
    expect((await links.resolve(b.id)).state).toBe("ok");
    must(await repo.trash(c.id));
    must(await pages.deletePermanently(c.id, { confirm: true }));
    expect(await links.resolve(c.id)).toEqual({ state: "missing", id: c.id, title: "" });
  });
});

describe("enlaces circulares (T-364, CL-6)", () => {
  it("A enlaza a B y B a A: ambos retroenlaces existen y no hay bucles", async () => {
    await save(a.id, [mentioning(b)]); await save(b.id, [mentioning(a)]);
    expect((await links.backlinks(a.id)).map((p) => p.id)).toEqual([b.id]);
    expect((await links.backlinks(b.id)).map((p) => p.id)).toEqual([a.id]);
  });
});
