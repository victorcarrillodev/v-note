// T-063 a T-067 (prueba primero): documentos Yjs por página, guardado atómico, compactación y resistencia a cortes.
import { describe, it, expect, beforeEach } from "vitest";
import * as Y from "yjs";
import { createNodeSqliteStore } from "../../tests/support/nodeSqliteStore";
import { migrate } from "../db/migrate";
import { migrations } from "../db/migrations";
import { FakeClock } from "../clock";
import { PagesRepo } from "../pages/pagesRepo";
import { DocStore } from "./docStore";
import type { SqlExecutor, SqlStore } from "../ports/sqlStore";

let db: SqlStore;
let pages: PagesRepo;
let docs: DocStore;
let pageId: string;
beforeEach(async () => {
  db = await createNodeSqliteStore(":memory:");
  await migrate(db, migrations);
  const clock = new FakeClock(1);
  pages = new PagesRepo(db, clock);
  docs = new DocStore(db, clock);
  const p = await pages.create({ title: "p" });
  if (!p.ok) throw new Error("x");
  pageId = p.value.id;
});

/** Crea un documento fuente y devuelve las actualizaciones incrementales que va generando. */
function source() {
  const doc = new Y.Doc();
  const updates: Uint8Array[] = [];
  doc.on("update", (u: Uint8Array) => updates.push(u));
  const text = doc.getText("t");
  return { doc, updates, text };
}
const textOf = (d: Y.Doc) => d.getText("t").toString();

describe("migración 002 (T-063)", () => {
  it("crea page_docs y la borra en cascada con la página", async () => {
    const cols = (await db.query<{ name: string }>("PRAGMA table_info(page_docs)")).map((c) => c.name);
    expect(cols).toEqual(["page_id", "seq", "kind", "data", "created_at"]);
    const s = source(); s.text.insert(0, "hola");
    await docs.appendUpdate(pageId, s.updates[0]!);
    await pages.trash(pageId);
    await pages.deletePermanently(pageId, { confirm: true });
    expect(await db.query("SELECT * FROM page_docs")).toEqual([]);
  });
});

describe("guardar y cargar (T-064, T-065)", () => {
  it("lo guardado se reconstruye idéntico, en orden", async () => {
    const s = source();
    s.text.insert(0, "Hola"); s.text.insert(4, " mundo"); s.text.insert(0, ">> ");
    for (const u of s.updates) expect((await docs.appendUpdate(pageId, u)).ok).toBe(true);
    const loaded = await docs.load(pageId);
    expect(loaded.ok && textOf(loaded.value)).toBe(">> Hola mundo");
  });
  it("una página sin documento carga como documento vacío", async () => {
    const loaded = await docs.load(pageId);
    expect(loaded.ok && textOf(loaded.value)).toBe("");
  });
  it("guardar en una página inexistente devuelve NOT_FOUND", async () => {
    const s = source(); s.text.insert(0, "x");
    const r = await docs.appendUpdate("no-existe", s.updates[0]!);
    expect(r.ok === false && r.error.code).toBe("NOT_FOUND");
  });
  it("las actualizaciones fuera de orden o repetidas convergen al mismo documento (Yjs es idempotente)", async () => {
    const s = source();
    s.text.insert(0, "a"); s.text.insert(1, "b"); s.text.insert(2, "c");
    for (const u of [s.updates[2]!, s.updates[0]!, s.updates[1]!, s.updates[1]!]) await docs.appendUpdate(pageId, u);
    const loaded = await docs.load(pageId);
    expect(loaded.ok && textOf(loaded.value)).toBe("abc");
  });
});

describe("compactación (T-066)", () => {
  it("el documento no cambia tras compactar y quedan menos filas", async () => {
    const s = source();
    for (let i = 0; i < 20; i++) s.text.insert(i, String(i % 10));
    for (const u of s.updates) await docs.appendUpdate(pageId, u);
    const before = textOf((await docs.load(pageId) as { value: Y.Doc }).value);
    const rowsBefore = (await db.query("SELECT * FROM page_docs")).length;
    expect((await docs.compact(pageId)).ok).toBe(true);
    const rowsAfter = (await db.query("SELECT * FROM page_docs")).length;
    expect(rowsBefore).toBe(20);
    expect(rowsAfter).toBe(1);
    expect(textOf((await docs.load(pageId) as { value: Y.Doc }).value)).toBe(before);
    // y se puede seguir guardando después de compactar
    s.text.insert(0, "Z");
    await docs.appendUpdate(pageId, s.updates.at(-1)!);
    expect(textOf((await docs.load(pageId) as { value: Y.Doc }).value)).toBe("Z" + before);
  });
});

/** Envoltorio que simula un corte (excepción) en la N-ésima escritura dentro de una transacción. */
function failingStore(real: SqlStore, failOnInsertNumber: number): SqlStore {
  let inserts = 0;
  const wrap = (ex: SqlExecutor): SqlExecutor => ({
    query: (sql, params) => ex.query(sql, params),
    exec: async (sql, params) => {
      if (/INSERT INTO page_docs/i.test(sql) && ++inserts === failOnInsertNumber) throw new Error("corte simulado");
      return ex.exec(sql, params);
    },
  });
  return { ...wrap(real), transaction: (fn) => real.transaction((tx) => fn(wrap(tx))), close: () => real.close() };
}

describe("inyección de fallos (T-067)", () => {
  it("un corte al guardar una actualización deja el documento íntegro con lo anterior", async () => {
    const s = source();
    s.text.insert(0, "uno"); s.text.insert(3, "dos"); s.text.insert(6, "tres");
    const flaky = new DocStore(failingStore(db, 2), new FakeClock(1));
    expect((await flaky.appendUpdate(pageId, s.updates[0]!)).ok).toBe(true);
    const r = await flaky.appendUpdate(pageId, s.updates[1]!); // aquí se corta
    expect(r.ok).toBe(false);
    const loaded = await docs.load(pageId);
    expect(loaded.ok && textOf(loaded.value)).toBe("uno"); // intacto, sin media actualización
    expect(await docs.appendUpdate(pageId, s.updates[1]!)).toEqual({ ok: true, value: undefined }); // y se puede reintentar
  });
  it("un corte durante la compactación conserva todas las filas originales", async () => {
    const s = source();
    for (let i = 0; i < 5; i++) s.text.insert(i, "x");
    for (const u of s.updates) await docs.appendUpdate(pageId, u);
    const flaky = new DocStore(failingStore(db, 1), new FakeClock(1));
    const r = await flaky.compact(pageId);
    expect(r.ok).toBe(false);
    expect((await db.query("SELECT * FROM page_docs")).length).toBe(5);
    expect(textOf((await docs.load(pageId) as { value: Y.Doc }).value)).toBe("xxxxx");
  });
});
