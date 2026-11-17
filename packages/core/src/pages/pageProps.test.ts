// Historial de propiedades de página (plan 005, §7.4 y DP-8). Tareas E-047 a E-050.
import { describe, it, expect, beforeEach } from "vitest";
import { createNodeSqliteStore } from "../../tests/support/nodeSqliteStore";
import { migrate } from "../db/migrate";
import { migrations } from "../db/migrations";
import { FakeClock } from "../clock";
import { PagesRepo } from "./pagesRepo";
import { PagePropsHistory, propsOf } from "./pageProps";
import type { SqlStore } from "../ports/sqlStore";

let db: SqlStore, repo: PagesRepo, hist: PagePropsHistory;
beforeEach(async () => {
  db = await createNodeSqliteStore(":memory:");
  await migrate(db, migrations);
  repo = new PagesRepo(db, new FakeClock(1_000));
  hist = new PagePropsHistory(repo);
});
const must = <T>(r: { ok: boolean; value?: T; error?: unknown }): T => { if (!r.ok) throw new Error(JSON.stringify(r.error)); return r.value as T; };
const credit = { source: "unsplash", photoId: "abc", author: "Ana", authorUrl: "https://unsplash.com/@ana", photoUrl: "https://unsplash.com/photos/abc" } as const;
const IMG = `asset:${"d".repeat(64)}`;

describe("setPageProps en una sola escritura (E-047)", () => {
  it("escribe portada, crédito, estilo, descripción y bloqueo juntos", async () => {
    const p = must(await repo.create({ title: "A" }));
    const after = must(await hist.set(p.id, { cover: IMG, coverCredit: credit, style: { accent: "red" }, description: "Hola", locked: true }));
    expect(propsOf(after)).toEqual({ cover: IMG, coverCredit: credit, style: { accent: "red" }, description: "Hola", locked: true });
  });
  it("si la escritura falla no queda nada a medias ni entra al historial", async () => {
    const p = must(await repo.create({ title: "A" }));
    const failing: SqlStore = { ...db, exec: async (sql, params) => { if (sql.startsWith("UPDATE pages")) throw new Error("disco lleno"); return db.exec(sql, params); } };
    const broken = new PagePropsHistory(new PagesRepo(failing, new FakeClock(2_000)));
    await expect(broken.set(p.id, { style: { accent: "red" }, description: "x", locked: true })).rejects.toThrow("disco lleno");
    expect(propsOf(must(await repo.get(p.id)))).toEqual({ cover: null, coverCredit: null, style: {}, description: null, locked: false });
    expect(broken.canUndo(p.id)).toBe(false);
  });
});

describe("deshacer, rehacer y límite (E-048)", () => {
  it("deshacer vuelve al estado anterior en la base y rehacer lo reaplica", async () => {
    const p = must(await repo.create({ title: "A" }));
    await hist.set(p.id, { style: { accent: "red" } });
    await hist.set(p.id, { description: "Hola" });
    expect(propsOf(must((await hist.undo(p.id))!))).toMatchObject({ style: { accent: "red" }, description: null });
    expect(must(await repo.get(p.id)).description).toBeNull();
    expect(propsOf(must((await hist.undo(p.id))!)).style).toEqual({});
    expect(await hist.undo(p.id)).toBeNull();
    expect(propsOf(must((await hist.redo(p.id))!)).style).toEqual({ accent: "red" });
  });
  it("un cambio nuevo después de deshacer descarta lo que había para rehacer", async () => {
    const p = must(await repo.create({ title: "A" }));
    await hist.set(p.id, { locked: true });
    await hist.undo(p.id);
    await hist.set(p.id, { description: "otra" });
    expect(hist.canRedo(p.id)).toBe(false);
  });
  it("con 101 cambios se pueden deshacer 100", async () => {
    const p = must(await repo.create({ title: "A" }));
    for (let i = 1; i <= 101; i++) await hist.set(p.id, { description: `v${i}` });
    let undos = 0;
    while (await hist.undo(p.id)) undos++;
    expect(undos).toBe(100);
    expect(must(await repo.get(p.id)).description).toBe("v1");
  }, 30_000);
  it("cada página tiene su propia pila", async () => {
    const a = must(await repo.create({ title: "A" })), b = must(await repo.create({ title: "B" }));
    await hist.set(a.id, { locked: true });
    expect(hist.canUndo(a.id)).toBe(true);
    expect(hist.canUndo(b.id)).toBe(false);
  });
});

describe("una acción compuesta es una sola entrada (E-049)", () => {
  it("poner portada con crédito y deshacer una vez devuelve las dos cosas", async () => {
    const p = must(await repo.create({ title: "A" }));
    await hist.set(p.id, { cover: "gradient:sky" });
    await hist.set(p.id, { cover: IMG, coverCredit: credit });
    expect(propsOf(must((await hist.undo(p.id))!))).toMatchObject({ cover: "gradient:sky", coverCredit: null });
    expect(propsOf(must((await hist.redo(p.id))!))).toMatchObject({ cover: IMG, coverCredit: credit });
  });
});

describe("restablecer estilo (E-050)", () => {
  it("deja el estilo sin tocar en una entrada y no cambia portada, descripción, bloqueo ni contenido", async () => {
    const p = must(await repo.create({ title: "A" }));
    await hist.set(p.id, { cover: IMG, coverCredit: credit, description: "Hola", locked: true, style: { accent: "red", spacing: { width: "wide" } } });
    const after = must(await hist.resetStyle(p.id));
    expect(propsOf(after)).toEqual({ cover: IMG, coverCredit: credit, description: "Hola", locked: true, style: {} });
    expect(await db.query("SELECT style FROM pages WHERE id = ?", [p.id])).toEqual([{ style: null }]);
    expect(propsOf(must((await hist.undo(p.id))!)).style).toEqual({ accent: "red", spacing: { width: "wide" } });
  });
});
