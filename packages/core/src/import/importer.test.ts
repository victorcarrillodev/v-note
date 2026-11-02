// T-385…T-396, T-399, T-400 (prueba primero): importar Markdown, Obsidian y Notion con informe, atomicidad y sin sobrescribir.
import { describe, it, expect, beforeEach } from "vitest";
import { createNodeSqliteStore } from "../../tests/support/nodeSqliteStore";
import { obsidianVault, notionExport, zipOf, PNG_1X1, NOTION_IDS } from "../../tests/fixtures/importFixtures";
import { MemoryAssetStore } from "../assets/memoryAssetStore";
import { FakeClock } from "../clock";
import { migrate } from "../db/migrate";
import { migrations } from "../db/migrations";
import { fromYjs } from "../blocks/fromYjs";
import { DocStore } from "../docs/docStore";
import { DatabaseService } from "../databases/databaseService";
import { PagesRepo } from "../pages/pagesRepo";
import type { SqlStore, SqlExecutor } from "../ports/sqlStore";
import type { Block } from "../blocks/types";
import { planImport } from "./plan";
import { commitImport, getImportReport } from "./commit";
import { readZip } from "./zip";
import type { SourceFile } from "./types";

let db: SqlStore, assets: MemoryAssetStore, clock: FakeClock, repo: PagesRepo;
const must = <T,>(r: { ok: boolean; value?: T; error?: { message: string } }): T => { if (!r.ok) throw new Error(r.error?.message); return r.value as T; };
beforeEach(async () => {
  db = await createNodeSqliteStore(":memory:");
  expect((await migrate(db, migrations)).ok).toBe(true);
  assets = new MemoryAssetStore(); clock = new FakeClock(10_000); repo = new PagesRepo(db, clock);
});
const run = async (files: SourceFile[], kind: "markdown" | "obsidian" | "notion", name = "Importado", store: SqlStore = db) => {
  const plan = (await planImport(files, { kind, name }))!;
  return { plan, result: await commitImport(plan, { store, assets, clock }) };
};
const titlesUnder = async (id: string | null) => (await repo.children(id)).map((p) => p.title);
const find = async (title: string) => (await db.query<{ id: string }>("SELECT id FROM pages WHERE title = ? ORDER BY created_at", [title]))[0]!.id;
const blocksOf = async (id: string): Promise<Block[]> => fromYjs(must(await new DocStore(db, clock).load(id)).getXmlFragment("doc"));
const flat = (bs: Block[]): Block[] => bs.flatMap((b) => [b, ...flat(b.children)]);
const count = async (t: string) => Number((await db.query<{ n: number }>(`SELECT count(*) AS n FROM ${t}`))[0]!.n);

describe("informe de importación (T-385)", () => {
  it("se guarda con lo importado, lo aproximado, lo omitido y lo roto, y se recupera por contenedor", async () => {
    const { plan, result } = await run(obsidianVault(), "obsidian");
    const id = must(result).containerId;
    const report = await getImportReport(db, id);
    expect(report).toEqual(plan.report);
    expect(report!.imported.length).toBeGreaterThan(0);
    expect(report!.omitted.length).toBeGreaterThan(0);
    expect(report!.brokenLinks.length).toBeGreaterThan(0);
    expect(await getImportReport(db, "no-existe")).toBeNull();
  });
});

describe("importar una carpeta de Markdown (T-389, T-386, T-387, T-399)", () => {
  it("todo cae en una página contenedora nueva con la estructura de carpetas; nada existente se toca", async () => {
    const existing = must(await repo.create({ title: "Existente" }));
    const before = await count("pages");
    const { result } = await run(obsidianVault(), "obsidian", "Mi bóveda");
    const container = must(result).containerId;
    expect(await titlesUnder(null)).toEqual(["Existente", "Mi bóveda"]);
    expect((await titlesUnder(container)).sort()).toEqual(["Ideas", "Inicio", "Proyectos"]);
    const proyectos = await find("Proyectos");
    expect((await titlesUnder(proyectos)).sort()).toEqual(["Notas", "Plan"]);
    expect(await titlesUnder(await find("Notas"))).toEqual(["Reunión"]);
    expect((await repo.get(existing.id)).ok).toBe(true);
    expect(await count("pages")).toBe(before + 7); // contenedor + Inicio, Ideas, Proyectos, Plan, Notas, Reunión
  });
  it("las imágenes locales quedan adjuntas al AssetStore y el bloque apunta a ellas", async () => {
    const { result } = await run(obsidianVault(), "obsidian");
    must(result);
    const img = flat(await blocksOf(await find("Ideas"))).find((b) => b.type === "image")!;
    const url = String(img.props.url);
    expect(url.startsWith("asset:")).toBe(true);
    expect(await assets.get(url.slice("asset:".length))).toEqual(PNG_1X1);
  });
  it("importar dos veces crea dos contenedores independientes (CL-28)", async () => {
    await run(obsidianVault(), "obsidian", "Bóveda");
    await run(obsidianVault(), "obsidian", "Bóveda");
    expect(await titlesUnder(null)).toEqual(["Bóveda", "Bóveda"]);
    expect(await count("pages")).toBe(2 * 7);
  });
  it("los archivos sin equivalente se omiten y se reportan; las tareas y listas se leen bien", async () => {
    const { plan, result } = await run(obsidianVault(), "obsidian");
    must(result);
    expect(plan.report.omitted.map((o) => o.path).sort()).toEqual([".obsidian/app.json", "adjuntos/manual.pdf"]);
    const plan2 = flat(await blocksOf(await find("Plan")));
    expect(plan2.filter((b) => b.type === "checkListItem").map((b) => b.props.checked)).toEqual([false, true]);
  });
});

describe("enlaces [[ ]] de Obsidian (T-388) y enlaces rotos (T-394, CL-27)", () => {
  it("se resuelven por ruta o por nombre, con alias; los que no existen quedan como texto y se listan", async () => {
    const { plan, result } = await run(obsidianVault(), "obsidian");
    must(result);
    const inicio = flat(await blocksOf(await find("Inicio")));
    const mentions = inicio.flatMap((b) => (Array.isArray(b.content) ? b.content : [])).filter((i) => i.type === "mention");
    expect(mentions.map((m) => (m as { pageId: string }).pageId).sort()).toEqual([await find("Plan"), await find("Ideas")].sort());
    expect(JSON.stringify(inicio)).toContain("Nota que no existe");
    expect(plan.report.brokenLinks).toEqual([{ path: "Inicio.md", message: expect.stringContaining("Nota que no existe") }]);
    // los enlaces entran al índice: Plan enlaza de vuelta a Inicio
    const rows = await db.query<{ from_page_id: string; to_page_id: string }>("SELECT * FROM links");
    expect(rows.map((r) => `${r.from_page_id}>${r.to_page_id}`)).toContain(`${await find("Plan")}>${await find("Inicio")}`);
  });
});

describe("importar de Notion (T-391, T-392, T-393, T-394)", () => {
  it("reconstruye la jerarquía sin los identificadores de los nombres", async () => {
    const { result } = await run(notionExport(), "notion", "Notion");
    const container = must(result).containerId;
    expect(await titlesUnder(container)).toEqual(["Mi espacio"]);
    expect((await titlesUnder(await find("Mi espacio"))).sort()).toEqual(["Subpágina", "Tareas"]);
    expect(await titlesUnder(await find("Subpágina"))).toEqual(["Nieta"]);
  });
  it("el CSV se vuelve una base de datos con sus columnas y filas, y cada fila conserva el contenido de su página", async () => {
    const { result } = await run(notionExport(), "notion", "Notion");
    must(result);
    const dbs = new DatabaseService(db, clock);
    const info = (await dbs.findByPage(await find("Tareas")))!;
    const props = await dbs.listProperties(info.id);
    expect(props.map((p) => [p.name, p.type])).toEqual([["Estado", "text"], ["Puntos", "number"], ["Hecho", "checkbox"]]); // la primera columna es el título de la página
    const rows = await dbs.getRows(info.id);
    expect(rows.map((r) => r.title)).toEqual(["Primera", "Segunda"]);
    const byName = (r: (typeof rows)[number], n: string) => r.values[props.find((p) => p.name === n)!.id];
    expect([byName(rows[0]!, "Puntos"), byName(rows[1]!, "Puntos")]).toEqual([3, 5]);
    expect([byName(rows[0]!, "Hecho"), byName(rows[1]!, "Hecho")]).toEqual([true, false]);
    expect(JSON.stringify(await blocksOf(rows[0]!.pageId))).toContain("Detalle de la primera tarea");
  });
  it("lo que no tiene equivalente se aproxima o se omite y el informe lo lista; los enlaces rotos también", async () => {
    const { plan, result } = await run(notionExport(), "notion", "Notion");
    must(result);
    expect(plan.report.approximated.some((a) => a.path.endsWith("Mi espacio " + NOTION_IDS.raiz + ".md"))).toBe(true);
    expect(plan.report.omitted.map((o) => o.path)).toEqual([expect.stringContaining("Presentación")]);
    expect(plan.report.brokenLinks.length).toBe(1);
    expect(plan.report.brokenLinks[0]!.message).toContain("Inexistente");
    // el enlace interno válido es una mención
    const raiz = flat(await blocksOf(await find("Mi espacio")));
    const subId = await find("Subpágina");
    expect(raiz.flatMap((b) => (Array.isArray(b.content) ? b.content : [])).some((i) => i.type === "mention" && i.pageId === subId)).toBe(true);
    // la imagen adjunta
    const img = flat(await blocksOf(await find("Subpágina"))).find((b) => b.type === "image")!;
    expect(String(img.props.url).startsWith("asset:")).toBe(true);
  });
});

describe("ZIP y archivos dañados (T-390, T-395)", () => {
  it("lee el contenido de un ZIP de ejemplo (sin carpetas ni basura del sistema)", () => {
    const files = must(readZip(zipOf([...notionExport(), { path: "__MACOSX/._x", data: new Uint8Array([1]) }])));
    expect(files.map((f) => f.path)).toContain(`Mi espacio ${NOTION_IDS.raiz}.md`);
    expect(files.some((f) => f.path.startsWith("__MACOSX"))).toBe(false);
  });
  it("un ZIP dañado devuelve un error claro", () => {
    const r = readZip(new Uint8Array([80, 75, 3, 4, 1, 2, 3, 4, 5]));
    expect(r.ok).toBe(false);
    expect(readZip(new Uint8Array([1, 2, 3])).ok).toBe(false);
  });
  it("un archivo .md corrupto (binario) o un CSV ilegible se omite y se reporta; el resto entra", async () => {
    const files: SourceFile[] = [
      { path: "bien.md", data: new TextEncoder().encode("# Bien\n\nhola") },
      { path: "roto.md", data: new Uint8Array([0, 1, 2, 0, 255, 0, 0, 0, 7]) },
      { path: "Base abc.csv", data: new TextEncoder().encode("\"sin cerrar,1\n") },
    ];
    const { plan, result } = await run(files, "markdown");
    must(result);
    expect(plan.report.omitted.map((o) => o.path).sort()).toEqual(["Base abc.csv", "roto.md"]);
    expect(await titlesUnder(must(result).containerId)).toEqual(["bien"]);
  });
});

describe("atomicidad y cancelación (T-396)", () => {
  /** Almacén que falla en la exec número `n` (contando solo las que ocurren dentro de la importación). */
  const failingStore = (inner: SqlStore, n: number): SqlStore => {
    let calls = 0;
    const wrap = (e: SqlExecutor): SqlExecutor => ({
      exec: async (sql, p) => { if (++calls === n) throw new Error("fallo inyectado"); return e.exec(sql, p); },
      query: (sql, p) => e.query(sql, p),
    });
    return { ...wrap(inner), transaction: (fn) => inner.transaction((tx) => fn(wrap(tx))), close: () => inner.close() } as SqlStore;
  };
  const snapshot = async () => JSON.stringify([await count("pages"), await count("page_docs"), await count("databases"), await count("properties"), await count("db_rows"), await count("cell_values"), await count("links"), await count("import_reports"), (await assets.list()).length]);

  it("un fallo en cualquier punto no deja nada a medias (ni páginas, ni bases, ni adjuntos, ni informe)", async () => {
    const files = [...obsidianVault(), ...notionExport().map((f) => ({ ...f, path: "N/" + f.path }))];
    const plan = (await planImport(files, { kind: "notion", name: "X" }))!;
    const before = await snapshot();
    for (const n of [1, 2, 5, 12, 25, 40, 70]) {
      const r = await commitImport(plan, { store: failingStore(db, n), assets, clock });
      expect(r.ok, `fallo en exec ${n}`).toBe(false);
      expect(await snapshot(), `estado tras fallo en ${n}`).toBe(before);
    }
    // y sin fallos funciona con el mismo plan
    expect((await commitImport(plan, { store: db, assets, clock })).ok).toBe(true);
    expect(await count("import_reports")).toBe(1);
  });
  it("cancelar durante la escritura revierte todo", async () => {
    const plan = (await planImport(obsidianVault(), { kind: "obsidian", name: "X" }))!;
    const before = await snapshot();
    const ac = new AbortController();
    const r = await commitImport(plan, { store: db, assets, clock, signal: ac.signal, onProgress: (done) => { if (done >= 3) ac.abort(); } });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("CANCELLED");
    expect(await snapshot()).toBe(before);
  });
  it("cancelar durante el análisis no escribe nada y devuelve null", async () => {
    const ac = new AbortController();
    const p = planImport(obsidianVault(), { kind: "obsidian", name: "X", signal: ac.signal, onProgress: () => ac.abort() });
    expect(await p).toBeNull();
    expect(await count("pages")).toBe(0);
  });
  it("informa el progreso de forma creciente hasta el total", async () => {
    const seen: number[] = [];
    const plan = (await planImport(obsidianVault(), { kind: "obsidian", name: "X" }))!;
    let total = 0;
    must(await commitImport(plan, { store: db, assets, clock, onProgress: (d, t) => { seen.push(d); total = t; } }));
    expect(seen).toEqual([...seen].sort((a, b) => a - b));
    expect(seen.at(-1)).toBe(total);
    expect(total).toBe(plan.pageCount);
  });
});
