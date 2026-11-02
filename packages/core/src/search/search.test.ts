// T-075 a T-083 (prueba primero): texto derivado, índice de texto completo, búsqueda, recientes y reconstrucción.
import { describe, it, expect, beforeEach } from "vitest";
import * as Y from "yjs";
import { createNodeSqliteStore } from "../../tests/support/nodeSqliteStore";
import { para, updateFor } from "../../tests/support/builders";
import { migrate } from "../db/migrate";
import { migrations } from "../db/migrations";
import { FakeClock } from "../clock";
import { PagesRepo } from "../pages/pagesRepo";
import { DocStore } from "../docs/docStore";
import { blocksToPlainText } from "./plainText";
import { SearchIndex } from "./searchIndex";
import { PageService } from "../pages/pageService";
import { defaultProps, type Block } from "../blocks/types";
import type { SqlExecutor, SqlStore } from "../ports/sqlStore";

const DAY = 86_400_000;
let db: SqlStore;
let clock: FakeClock;
let pages: PagesRepo;
let docs: DocStore;
let index: SearchIndex;
let svc: PageService;
beforeEach(async () => {
  db = await createNodeSqliteStore(":memory:");
  await migrate(db, migrations);
  clock = new FakeClock(100 * DAY);
  pages = new PagesRepo(db, clock);
  docs = new DocStore(db, clock);
  index = new SearchIndex(db, clock);
  svc = new PageService(db, clock);
});
const newPage = async (title: string, body?: string, kind: "note" | "board" | "database" = "note") => {
  const r = await pages.create({ title, kind });
  if (!r.ok) throw new Error("x");
  if (body !== undefined) {
    const s = await svc.saveUpdate(r.value.id, updateFor([para(body)]));
    if (!s.ok) throw new Error("no guardó");
  }
  return r.value;
};

describe("esquema (T-075)", () => {
  it("crea page_text (texto completo) y page_visits", async () => {
    expect((await db.query<{ name: string }>("PRAGMA table_info(page_text)")).map((c) => c.name)).toEqual(["page_id", "title", "body"]);
    expect((await db.query<{ name: string }>("PRAGMA table_info(page_visits)")).map((c) => c.name)).toEqual(["page_id", "visited_at"]);
    const sql = await db.query<{ sql: string }>("SELECT sql FROM sqlite_master WHERE name = 'page_text'");
    expect(sql[0]!.sql).toMatch(/USING fts5/i);
  });
});

describe("texto plano (T-076)", () => {
  const b = (type: string, content: Block["content"], props: Record<string, unknown> = {}, children: Block[] = []): Block => ({ id: "x", type, props, content, children });
  const t = (text: string, styles = {}) => ({ type: "text" as const, text, styles });
  it.each([
    ["párrafo y encabezado", [b("heading", [t("Título")], defaultProps("heading")), b("paragraph", [t("Cuerpo")], defaultProps("paragraph"))], "Título\nCuerpo"],
    ["estilos no cambian el texto", [b("paragraph", [t("a "), t("negrita", { bold: true }), t(" b")])], "a negrita b"],
    ["enlaces aportan su texto", [b("paragraph", [{ type: "link" as const, href: "https://x.test", content: [t("sitio")] }])], "sitio"],
    ["listas y tareas", [b("bulletListItem", [t("uno")]), b("numberedListItem", [t("dos")]), b("checkListItem", [t("tres")])], "uno\ndos\ntres"],
    ["código y cita", [b("codeBlock", [t("const a = 1;")]), b("quote", [t("cita")])], "const a = 1;\ncita"],
    ["divisor no aporta texto", [b("paragraph", [t("a")]), b("divider", undefined), b("paragraph", [t("b")])], "a\nb"],
    ["tabla une celdas por filas", [b("table", { type: "table", rows: [[[t("a1")], [t("b1")]], [[t("a2")], [t("b2")]]] })], "a1 b1\na2 b2"],
    ["imagen y archivo aportan nombre y leyenda", [b("image", undefined, { name: "foto.png", caption: "Mi gato" }), b("file", undefined, { name: "doc.pdf", caption: "" })], "foto.png Mi gato\ndoc.pdf"],
    ["hijos anidados en orden", [b("bulletListItem", [t("padre")], {}, [b("bulletListItem", [t("hijo")])])], "padre\nhijo"],
  ])("%s", (_n, blocks, expected) => {
    expect(blocksToPlainText(blocks as Block[])).toBe(expected);
  });
});

describe("reindexar al guardar (T-077)", () => {
  it("el texto guardado se encuentra al instante", async () => {
    const p = await newPage("Recetas", "tortillas de maiz y frijoles");
    const hits = await index.search({ query: "tortillas" });
    expect(hits.map((h) => h.pageId)).toEqual([p.id]);
  });
  it("es atómico: si falla el reindexado, tampoco queda guardada la actualización", async () => {
    const p = await pages.create({ title: "x" });
    if (!p.ok) throw new Error("x");
    const failing: SqlStore = {
      ...db,
      query: db.query.bind(db),
      exec: db.exec.bind(db),
      close: db.close.bind(db),
      transaction: (fn) =>
        db.transaction((tx) => {
          const wrap: SqlExecutor = {
            query: (s, a) => tx.query(s, a),
            exec: async (s, a) => { if (/page_text/i.test(s)) throw new Error("corte"); return tx.exec(s, a); },
          };
          return fn(wrap);
        }),
    };
    const r = await new PageService(failing, clock).saveUpdate(p.value.id, updateFor([para("hola")]));
    expect(r.ok).toBe(false);
    expect(await db.query("SELECT * FROM page_docs")).toEqual([]);
  });
  it("renombrar actualiza el índice", async () => {
    const p = await newPage("Viejo");
    await svc.rename(p.id, "Nuevo título");
    expect((await index.search({ query: "nuevo" })).map((h) => h.pageId)).toEqual([p.id]);
    expect(await index.search({ query: "viejo" })).toEqual([]);
  });
  it("guardar en una página inexistente devuelve NOT_FOUND", async () => {
    const r = await svc.saveUpdate("no-existe", updateFor([para("x")]));
    expect(r.ok === false && r.error.code).toBe("NOT_FOUND");
  });
});

describe("búsqueda (T-078)", () => {
  it("encuentra por título y por contenido, con fragmento resaltado", async () => {
    const a = await newPage("Tortillas caseras", "se mezcla la masa");
    const b = await newPage("Compras", "comprar tortillas y frijoles");
    const hits = await index.search({ query: "tortillas" });
    expect(hits.map((h) => h.pageId).sort()).toEqual([a.id, b.id].sort());
    const inBody = hits.find((h) => h.pageId === b.id)!;
    expect(inBody.snippet.some((s) => s.match && s.text.toLowerCase() === "tortillas")).toBe(true);
    expect(inBody.snippet.map((s) => s.text).join("")).toContain("comprar");
    expect(inBody.title).toBe("Compras");
  });
  it("busca por prefijo mientras se escribe", async () => {
    const p = await newPage("Notas", "frijoles negros");
    expect((await index.search({ query: "frij" })).map((h) => h.pageId)).toEqual([p.id]);
  });
  it("varias palabras deben aparecer todas (en cualquier orden)", async () => {
    const p = await newPage("A", "tortillas con frijoles");
    await newPage("B", "solo tortillas");
    expect((await index.search({ query: "frijoles tortillas" })).map((h) => h.pageId)).toEqual([p.id]);
  });
  it("tolera caracteres especiales de FTS sin fallar", async () => {
    await newPage("A", "hola mundo");
    for (const q of ['"', "'", "*", "AND", "OR", "NOT", "(", ")", "hola OR", "a:b", "^x", "NEAR(", "--", ";"]) {
      await expect(index.search({ query: q })).resolves.toBeDefined();
    }
  });
  it("una consulta vacía no devuelve nada", async () => {
    await newPage("A", "hola");
    expect(await index.search({ query: "   " })).toEqual([]);
  });
  it("sin coincidencias devuelve una lista vacía", async () => {
    await newPage("A", "hola");
    expect(await index.search({ query: "zzzzz" })).toEqual([]);
  });
  it("ignora acentos y mayúsculas", async () => {
    const p = await newPage("Canción", "Música de México");
    expect((await index.search({ query: "cancion" })).map((h) => h.pageId)).toEqual([p.id]);
    expect((await index.search({ query: "MEXICO" })).map((h) => h.pageId)).toEqual([p.id]);
  });
});

describe("filtros (T-079)", () => {
  it("por tipo de página", async () => {
    const n = await newPage("Nota", "proyecto uno");
    const bd = await newPage("Base", "proyecto dos", "database");
    expect((await index.search({ query: "proyecto", kinds: ["database"] })).map((h) => h.pageId)).toEqual([bd.id]);
    expect((await index.search({ query: "proyecto", kinds: ["note"] })).map((h) => h.pageId)).toEqual([n.id]);
  });
  it("por fecha de modificación", async () => {
    const vieja = await newPage("Vieja", "tema");
    clock.advance(10 * DAY);
    const nueva = await newPage("Nueva", "tema");
    const desde = clock.now() - 5 * DAY;
    expect((await index.search({ query: "tema", modifiedAfter: desde })).map((h) => h.pageId)).toEqual([nueva.id]);
    expect((await index.search({ query: "tema", modifiedBefore: desde })).map((h) => h.pageId)).toEqual([vieja.id]);
  });
});

describe("papelera (T-080)", () => {
  it("se excluye por defecto y se incluye si se pide, marcada como eliminada", async () => {
    const p = await newPage("Borrar", "contenido secreto");
    await pages.trash(p.id);
    expect(await index.search({ query: "secreto" })).toEqual([]);
    const hits = await index.search({ query: "secreto", includeTrashed: true });
    expect(hits).toHaveLength(1);
    expect(hits[0]).toMatchObject({ pageId: p.id, trashed: true });
  });
  it("tras el borrado definitivo no quedan restos en el índice", async () => {
    const p = await newPage("Borrar", "contenido secreto");
    await pages.trash(p.id);
    await svc.deletePermanently(p.id, { confirm: true });
    expect(await index.search({ query: "secreto", includeTrashed: true })).toEqual([]);
    expect(await db.query("SELECT * FROM page_text")).toEqual([]);
  });
});

describe("recientes (T-081)", () => {
  it("devuelve las últimas 10 distintas, la más reciente primero", async () => {
    const ids: string[] = [];
    for (let i = 0; i < 12; i++) { ids.push((await newPage(`p${i}`)).id); clock.advance(1000); await index.recordVisit(ids[i]!); }
    const r = await index.recent();
    expect(r.map((p) => p.title)).toEqual(["p11", "p10", "p9", "p8", "p7", "p6", "p5", "p4", "p3", "p2"]);
  });
  it("volver a visitar una página la sube al principio sin duplicarla", async () => {
    const a = await newPage("a"); const b = await newPage("b");
    await index.recordVisit(a.id); clock.advance(1000); await index.recordVisit(b.id); clock.advance(1000); await index.recordVisit(a.id);
    expect((await index.recent()).map((p) => p.title)).toEqual(["a", "b"]);
  });
  it("no incluye páginas en la papelera", async () => {
    const a = await newPage("a"); await index.recordVisit(a.id); await pages.trash(a.id);
    expect(await index.recent()).toEqual([]);
  });
});

describe("reconstrucción (T-082)", () => {
  it("reconstruir da el mismo índice que el incremental", async () => {
    const a = await newPage("Alfa", "uno dos tres");
    await newPage("Beta", "cuatro cinco");
    await svc.saveUpdate(a.id, (() => { const d = new Y.Doc(); Y.applyUpdate(d, updateFor([para("uno dos tres")])); return Y.encodeStateAsUpdate(d); })());
    const dump = async () => (await db.query<{ page_id: string; title: string; body: string }>("SELECT page_id, title, body FROM page_text ORDER BY page_id"));
    const incremental = await dump();
    await db.exec("DELETE FROM page_text");
    expect(await dump()).toEqual([]);
    await index.rebuildAll();
    expect(await dump()).toEqual(incremental);
  });
});

describe("rendimiento con 5 000 páginas (T-083)", () => {
  it("abrir una página < 100 ms y buscar < 100 ms", async () => {
    const big = await createNodeSqliteStore(":memory:");
    await migrate(big, migrations);
    const c = new FakeClock(1);
    await big.transaction(async (tx) => {
      for (let i = 0; i < 5000; i++) {
        await tx.exec("INSERT INTO pages(id, position, title, created_at, updated_at) VALUES (?, ?, ?, 1, 1)", [`id${i}`, `a${String(i).padStart(5, "0")}`, `Página ${i}`]);
        await tx.exec("INSERT INTO page_text(page_id, title, body) VALUES (?, ?, ?)", [`id${i}`, `Página ${i}`, `contenido ${i} ${i % 50 === 0 ? "tortillas" : "relleno"} texto variado`]);
      }
    });
    const ds = new DocStore(big, c);
    await ds.appendUpdate("id2500", updateFor(Array.from({ length: 50 }, (_, i) => para(`bloque ${i}`))));
    let t = performance.now();
    const loaded = await ds.load("id2500");
    const openMs = performance.now() - t;
    expect(loaded.ok).toBe(true);
    t = performance.now();
    const hits = await new SearchIndex(big, c).search({ query: "tortillas", limit: 500 });
    const searchMs = performance.now() - t;
    console.log(`BENCH 5000 páginas: abrir=${openMs.toFixed(1)}ms buscar=${searchMs.toFixed(1)}ms (${hits.length} resultados)`);
    expect(openMs).toBeLessThan(100);
    expect(searchMs).toBeLessThan(100);
    expect(hits.length).toBe(100);
  }, 60_000);
});
