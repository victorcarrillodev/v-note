// Predeterminado del espacio (plan 005, §4.4 y DP-7). Tareas E-044 a E-046.
import { describe, it, expect, beforeEach } from "vitest";
import { createNodeSqliteStore } from "../../tests/support/nodeSqliteStore";
import { migrate } from "../db/migrate";
import { migrations } from "../db/migrations";
import { loadPageDefaultStyle, savePageDefaultStyle, PAGE_DEFAULT_STYLE_KEY } from "./pageDefaults";
import type { SqlStore } from "../ports/sqlStore";
import { PagesRepo } from "./pagesRepo";
import { PageService } from "./pageService";
import { FakeClock } from "../clock";

let db: SqlStore;
beforeEach(async () => { db = await createNodeSqliteStore(":memory:"); await migrate(db, migrations); });

describe("leer y escribir el predeterminado (E-044)", () => {
  it("sin predeterminado devuelve {}", async () => {
    expect(await loadPageDefaultStyle(db)).toEqual({});
  });
  it("guarda el estilo normalizado bajo su clave y lo vuelve a leer", async () => {
    await savePageDefaultStyle(db, { accent: "blue", spacing: { width: "wide" }, toc: { floating: true } });
    expect(await db.query("SELECT value FROM meta WHERE key = ?", [PAGE_DEFAULT_STYLE_KEY])).toEqual([{ value: '{"accent":"blue","spacing":{"width":"wide"}}' }]);
    expect(await loadPageDefaultStyle(db)).toEqual({ accent: "blue", spacing: { width: "wide" } });
  });
  it("guardar un estilo sin tocar borra la clave", async () => {
    await savePageDefaultStyle(db, { accent: "blue" });
    await savePageDefaultStyle(db, {});
    expect(await db.query("SELECT value FROM meta WHERE key = ?", [PAGE_DEFAULT_STYLE_KEY])).toEqual([]);
  });
  it("un valor dañado se ignora", async () => {
    await db.exec("INSERT INTO meta(key, value) VALUES (?, 'no es json')", [PAGE_DEFAULT_STYLE_KEY]);
    expect(await loadPageDefaultStyle(db)).toEqual({});
  });
});

const must = <T>(r: { ok: boolean; value?: T; error?: unknown }): T => { if (!r.ok) throw new Error(JSON.stringify(r.error)); return r.value as T; };

describe("las páginas nuevas parten del predeterminado (E-045)", () => {
  it("sin predeterminado, una página nueva queda en el estilo clásico", async () => {
    expect(must(await new PagesRepo(db, new FakeClock(1)).create({ title: "A" })).style).toEqual({});
  });
  it("con predeterminado, se copia al crearla (también desde el servicio de páginas)", async () => {
    await savePageDefaultStyle(db, { header: { titleOverCover: true }, accent: "green" });
    expect(must(await new PagesRepo(db, new FakeClock(1)).create({ title: "A" })).style).toEqual({ header: { titleOverCover: true }, accent: "green" });
    expect(must(await new PageService(db, new FakeClock(1)).create({ title: "B" })).style).toEqual({ header: { titleOverCover: true }, accent: "green" });
  });
});

describe("cambiar el predeterminado no altera las páginas existentes (E-046)", () => {
  it("la página creada antes conserva su estilo", async () => {
    const repo = new PagesRepo(db, new FakeClock(1));
    await savePageDefaultStyle(db, { accent: "green" });
    const before = must(await repo.create({ title: "Antes" }));
    await savePageDefaultStyle(db, { accent: "red" });
    expect(must(await repo.get(before.id)).style).toEqual({ accent: "green" });
    expect(must(await repo.create({ title: "Después" })).style).toEqual({ accent: "red" });
  });
});
