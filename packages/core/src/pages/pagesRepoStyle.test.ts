// Repositorio de páginas: columnas de la spec 005 (plan §4.2, DP-2, DP-6). Tareas E-038 a E-043.
import { describe, it, expect, beforeEach } from "vitest";
import { createNodeSqliteStore } from "../../tests/support/nodeSqliteStore";
import { migrate } from "../db/migrate";
import { migrations } from "../db/migrations";
import { FakeClock } from "../clock";
import { PagesRepo } from "./pagesRepo";
import type { SqlStore } from "../ports/sqlStore";

let db: SqlStore, clock: FakeClock, pages: PagesRepo;
beforeEach(async () => {
  db = await createNodeSqliteStore(":memory:");
  await migrate(db, migrations);
  clock = new FakeClock(1_000);
  pages = new PagesRepo(db, clock);
});
const must = <T>(r: { ok: boolean; value?: T; error?: unknown }): T => { if (!r.ok) throw new Error(JSON.stringify(r.error)); return r.value as T; };
const credit = { source: "unsplash", photoId: "abc", author: "Ana", authorUrl: "https://unsplash.com/@ana", photoUrl: "https://unsplash.com/photos/abc" } as const;

describe("lectura de las columnas nuevas (E-038)", () => {
  it("con NULL: estilo vacío, sin descripción, desbloqueada y sin crédito", async () => {
    const p = must(await pages.create({ title: "A" }));
    expect(p.style).toEqual({});
    expect(p.description).toBeNull();
    expect(p.locked).toBe(false);
    expect(p.coverCredit).toBeNull();
  });
  it("con valores: los lee y valida (un estilo o crédito dañado no rompe la lectura)", async () => {
    const p = must(await pages.create({ title: "A" }));
    await db.exec("UPDATE pages SET style = ?, description = ?, locked = 1, cover_credit = ? WHERE id = ?", ['{"accent":"red"}', "Notas", JSON.stringify(credit), p.id]);
    expect(must(await pages.get(p.id))).toMatchObject({ style: { accent: "red" }, description: "Notas", locked: true, coverCredit: credit });
    await db.exec("UPDATE pages SET style = 'roto', cover_credit = '{}' WHERE id = ?", [p.id]);
    expect(must(await pages.get(p.id))).toMatchObject({ style: {}, coverCredit: null });
  });
});

describe("setters de las columnas nuevas (E-039)", () => {
  it("cada uno guarda su columna y actualiza la fecha de edición", async () => {
    const p = must(await pages.create({ title: "A" }));
    const steps: [string, () => Promise<unknown>, (q: Awaited<ReturnType<typeof pages.get>>) => void][] = [
      ["style", () => pages.setStyle(p.id, { accent: "blue", toc: { floating: true } }), (r) => expect(must(r).style).toEqual({ accent: "blue" })],
      ["description", () => pages.setDescription(p.id, "Resumen"), (r) => expect(must(r).description).toBe("Resumen")],
      ["locked", () => pages.setLocked(p.id, true), (r) => expect(must(r).locked).toBe(true)],
      ["cover+credit", () => pages.setCover(p.id, `asset:${"a".repeat(64)}`, credit), (r) => expect(must(r)).toMatchObject({ cover: `asset:${"a".repeat(64)}`, coverCredit: credit })],
    ];
    for (const [name, run, check] of steps) {
      clock.advance(10);
      const before = must(await pages.get(p.id)).updatedAt;
      await run();
      const after = await pages.get(p.id);
      check(after);
      expect(must(after).updatedAt, name).toBeGreaterThan(before);
    }
  });
  it("el estilo se guarda normalizado: sin tocar = NULL", async () => {
    const p = must(await pages.create({ title: "A" }));
    await pages.setStyle(p.id, { toc: { floating: true } });
    expect(await db.query("SELECT style FROM pages WHERE id = ?", [p.id])).toEqual([{ style: null }]);
  });
  it("los setters devuelven NOT_FOUND con una página inexistente", async () => {
    const r = await pages.setLocked("no-existe", true);
    expect(r.ok === false && r.error.code).toBe("NOT_FOUND");
  });
});

describe("descripción (E-040)", () => {
  it("quita saltos de línea, recorta espacios y a 280 caracteres; vacía = NULL", async () => {
    const p = must(await pages.create({ title: "A" }));
    expect(must(await pages.setDescription(p.id, "  Línea uno\nlínea\r\ndos  ")).description).toBe("Línea uno línea dos");
    expect(must(await pages.setDescription(p.id, "x".repeat(300))).description).toHaveLength(280);
    expect(must(await pages.setDescription(p.id, " \n ")).description).toBeNull();
    expect(must(await pages.setDescription(p.id, null)).description).toBeNull();
  });
});

describe("crédito y portada en la misma escritura (E-041)", () => {
  it("de una imagen con crédito a un color: el crédito se borra", async () => {
    const p = must(await pages.create({ title: "A" }));
    await pages.setCover(p.id, `asset:${"a".repeat(64)}`, credit);
    expect(must(await pages.setCover(p.id, "color:#a1b2c3"))).toMatchObject({ cover: "color:#a1b2c3", coverCredit: null });
  });
  it("un crédito con una portada que no es imagen se ignora", async () => {
    const p = must(await pages.create({ title: "A" }));
    expect(must(await pages.setCover(p.id, "gradient:sky", credit)).coverCredit).toBeNull();
  });
  it("quitar la portada también quita el crédito", async () => {
    const p = must(await pages.create({ title: "A" }));
    await pages.setCover(p.id, `asset:${"a".repeat(64)}`, credit);
    expect(must(await pages.setCover(p.id, null))).toMatchObject({ cover: null, coverCredit: null });
  });
});

describe("duplicar copia las columnas nuevas (E-043)", () => {
  it("estilo, descripción, bloqueo, portada y crédito pasan a la copia (también en las hijas)", async () => {
    const p = must(await pages.create({ title: "A" }));
    const child = must(await pages.create({ title: "Hija", parentId: p.id }));
    for (const id of [p.id, child.id]) {
      await pages.setStyle(id, { accent: "pink", header: { titleOverCover: true } });
      await pages.setDescription(id, "Resumen");
      await pages.setLocked(id, true);
      await pages.setCover(id, `asset:${"c".repeat(64)}`, credit);
    }
    const copy = must(await pages.duplicate(p.id, { withChildren: true }));
    const copyChild = (await db.query<{ id: string }>("SELECT id FROM pages WHERE parent_id = ?", [copy.id]))[0]!;
    for (const id of [copy.id, copyChild.id]) {
      expect(must(await pages.get(id))).toMatchObject({
        style: { accent: "pink", header: { titleOverCover: true } }, description: "Resumen", locked: true, cover: `asset:${"c".repeat(64)}`, coverCredit: credit,
      });
    }
  });
});
