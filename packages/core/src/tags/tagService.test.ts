// U-234 a U-236 (RF-5.9, RF-9): catálogo de etiquetas del espacio y su asignación a páginas.
import { describe, it, expect, beforeEach } from "vitest";
import { createNodeSqliteStore } from "../../tests/support/nodeSqliteStore";
import { FakeClock } from "../clock";
import { migrate } from "../db/migrate";
import { migrations } from "../db/migrations";
import { PageService } from "../pages/pageService";
import { PagesRepo } from "../pages/pagesRepo";
import type { SqlStore } from "../ports/sqlStore";
import { TagService, TAG_COLORS } from "./tagService";

let db: SqlStore, tags: TagService, pages: PageService;
beforeEach(async () => {
  db = await createNodeSqliteStore(":memory:");
  await migrate(db, migrations);
  const clock = new FakeClock(1_000);
  tags = new TagService(db, clock);
  pages = new PageService(db, clock);
});
const must = <T>(r: { ok: boolean; value?: T; error?: unknown }): T => { if (!r.ok) throw new Error(JSON.stringify(r.error)); return r.value as T; };
const page = async (title: string) => must(await pages.create({ title })).id;

describe("migración (U-234)", () => {
  it("crea las tablas de etiquetas y de asignación con claves a páginas", async () => {
    const cols = async (t: string) => (await db.query<{ name: string }>(`PRAGMA table_info(${t})`)).map((c) => c.name);
    expect(await cols("tags")).toEqual(["id", "name", "color", "created_at"]);
    expect(await cols("page_tags")).toEqual(["page_id", "tag_id"]);
  });
});

describe("crear, renombrar, recolorear", () => {
  it("crea con nombre y color de la paleta", async () => {
    const t = must(await tags.create({ name: "Urgente", color: "red" }));
    expect(t).toMatchObject({ name: "Urgente", color: "red" });
    expect(await tags.list()).toHaveLength(1);
  });
  it("rechaza nombre vacío, repetido (sin importar mayúsculas) y color fuera de la paleta", async () => {
    must(await tags.create({ name: "Casa", color: "blue" }));
    expect((await tags.create({ name: "  ", color: "blue" })).ok).toBe(false);
    expect((await tags.create({ name: "casa", color: "green" })).ok).toBe(false);
    expect((await tags.create({ name: "X", color: "fucsia" })).ok).toBe(false);
    expect(TAG_COLORS).toHaveLength(9);
  });
  it("renombra y recolorea", async () => {
    const t = must(await tags.create({ name: "A", color: "red" }));
    expect(must(await tags.rename(t.id, "B")).name).toBe("B");
    expect(must(await tags.recolor(t.id, "green")).color).toBe("green");
  });
  it("acepta colores de las paletas de acento (sólido y degradado) y rechaza los inválidos", async () => {
    const t = must(await tags.create({ name: "A", color: "#FF8800" }));
    expect(t.color).toBe("#ff8800");
    expect(must(await tags.recolor(t.id, "#ff8800~#0000ff")).color).toBe("#ff8800~#0000ff");
    expect((await tags.recolor(t.id, "rojo")).ok).toBe(false);
    expect((await tags.recolor(t.id, "#12345")).ok).toBe(false);
  });
  it("renombrar a un nombre que ya existe falla", async () => {
    must(await tags.create({ name: "A", color: "red" }));
    const b = must(await tags.create({ name: "B", color: "red" }));
    expect((await tags.rename(b.id, "a")).ok).toBe(false);
  });
});

describe("asignar y eliminar", () => {
  it("asigna a una página, es idempotente y se puede quitar", async () => {
    const p = await page("Uno");
    const t = must(await tags.create({ name: "A", color: "red" }));
    must(await tags.assign(p, t.id)); must(await tags.assign(p, t.id));
    expect((await tags.forPage(p)).map((x) => x.name)).toEqual(["A"]);
    must(await tags.unassign(p, t.id));
    expect(await tags.forPage(p)).toEqual([]);
  });
  it("eliminar una etiqueta la quita de todas las páginas", async () => {
    const p1 = await page("Uno"), p2 = await page("Dos");
    const t = must(await tags.create({ name: "A", color: "red" }));
    must(await tags.assign(p1, t.id)); must(await tags.assign(p2, t.id));
    must(await tags.remove(t.id));
    expect(await tags.forPage(p1)).toEqual([]);
    expect(await tags.list()).toEqual([]);
    expect((await db.query("SELECT 1 FROM page_tags"))).toEqual([]);
  });
  it("eliminar una página quita sus asignaciones", async () => {
    const p = await page("Uno");
    const t = must(await tags.create({ name: "A", color: "red" }));
    must(await tags.assign(p, t.id));
    await db.exec("DELETE FROM pages WHERE id = ?", [p]);
    expect(await db.query("SELECT 1 FROM page_tags")).toEqual([]);
  });
  it("asignar una etiqueta o página inexistente falla", async () => {
    const p = await page("Uno");
    expect((await tags.assign(p, "nope")).ok).toBe(false);
    const t = must(await tags.create({ name: "A", color: "red" }));
    expect((await tags.assign("nope", t.id)).ok).toBe(false);
  });
});

describe("filtrar por etiqueta (U-236)", () => {
  it("devuelve solo las páginas etiquetadas, sin las de la papelera", async () => {
    const a = await page("Con"), b = await page("Sin"), c = await page("Borrada");
    const t = must(await tags.create({ name: "A", color: "red" }));
    must(await tags.assign(a, t.id)); must(await tags.assign(c, t.id));
    await new PagesRepo(db, new FakeClock(2_000)).trash(c);
    expect(await tags.pagesWith(t.id)).toEqual([a]);
    void b;
  });
  it("con varias etiquetas exige todas (y)", async () => {
    const p1 = await page("Uno"), p2 = await page("Dos");
    const x = must(await tags.create({ name: "X", color: "red" })), y = must(await tags.create({ name: "Y", color: "blue" }));
    must(await tags.assign(p1, x.id)); must(await tags.assign(p1, y.id)); must(await tags.assign(p2, x.id));
    expect(await tags.pagesWithAll([x.id, y.id])).toEqual([p1]);
  });
  it("cuenta el uso de cada etiqueta", async () => {
    const p1 = await page("Uno"), p2 = await page("Dos");
    const x = must(await tags.create({ name: "X", color: "red" }));
    must(await tags.assign(p1, x.id)); must(await tags.assign(p2, x.id));
    expect((await tags.list())[0]).toMatchObject({ uses: 2 });
  });
});
