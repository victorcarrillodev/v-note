// Migración 14 «estilo de página» (plan 005, §4.2 y DP-6). Tareas E-035 a E-037.
import { describe, it, expect } from "vitest";
import { createNodeSqliteStore } from "../../tests/support/nodeSqliteStore";
import { migrate } from "./migrate";
import { migrations } from "./migrations";

const upTo = (v: number) => migrations.filter((m) => m.version <= v);
const cols = async (db: Awaited<ReturnType<typeof createNodeSqliteStore>>) =>
  (await db.query<{ name: string; dflt_value: string | null; notnull: number }>("PRAGMA table_info(pages)"));

describe("columnas nuevas (E-035)", () => {
  it("añade style, description, locked y cover_credit; locked vale 0 por defecto", async () => {
    const db = await createNodeSqliteStore(":memory:");
    expect((await migrate(db, upTo(14))).ok).toBe(true);
    const c = await cols(db);
    const names = c.map((x) => x.name);
    for (const n of ["style", "description", "locked", "cover_credit"]) expect(names).toContain(n);
    const locked = c.find((x) => x.name === "locked")!;
    expect(locked.notnull).toBe(1);
    expect(locked.dflt_value).toBe("0");
    await db.exec("INSERT INTO pages(id, position, created_at, updated_at) VALUES ('p','a0',0,0)");
    expect(await db.query("SELECT style, description, locked, cover_credit FROM pages")).toEqual([{ style: null, description: null, locked: 0, cover_credit: null }]);
  });
});

describe("ancho completo → estilo (E-036)", () => {
  it("en una base de la versión 13, full_width = 1 pasa a style con ancho «full»; las demás quedan con style NULL", async () => {
    const db = await createNodeSqliteStore(":memory:");
    await migrate(db, upTo(13));
    await db.exec("INSERT INTO pages(id, position, full_width, created_at, updated_at) VALUES ('ancha','a0',1,0,0), ('normal','a1',0,0,0)");
    expect((await migrate(db, upTo(14))).ok).toBe(true);
    const rows = await db.query<{ id: string; style: string | null }>("SELECT id, style FROM pages ORDER BY id");
    expect(rows).toEqual([{ id: "ancha", style: '{"spacing":{"width":"full"}}' }, { id: "normal", style: null }]);
  });
});

describe("migrar una base real de la versión 13 (E-037)", () => {
  it("hace la copia previa, no toca ningún dato salvo style y deja la versión en 14", async () => {
    const db = await createNodeSqliteStore(":memory:");
    await migrate(db, upTo(13));
    // Datos de las specs anteriores: páginas (con icono, portada, favorita, papelera), meta, etiquetas y bases de datos.
    await db.exec(`INSERT INTO pages(id, parent_id, position, title, icon, cover, kind, favorite, full_width, created_at, updated_at, deleted_at, deleted_root_id)
      VALUES ('raiz', NULL, 'a0', 'Raíz', '📘', 'gradient:sky', 'note', 1, 1, 10, 20, NULL, NULL),
             ('hija', 'raiz', 'a0', 'Hija', NULL, 'color:#a1b2c3', 'note', 0, 0, 11, 21, NULL, NULL),
             ('papelera', NULL, 'a1', 'Borrada', NULL, NULL, 'board', 0, 0, 12, 22, 30, 'papelera')`);
    await db.exec(`INSERT INTO meta(key, value) VALUES ('diagram.default.shape', '{"fill":"palette:blue"}')`);
    await db.exec(`INSERT INTO tags(id, name, color, created_at) VALUES ('t1', 'estudio', 'green', 5)`);
    await db.exec(`INSERT INTO page_tags(page_id, tag_id) VALUES ('hija', 't1')`);
    const tables = (await db.query<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")).map((t) => t.name);
    const sorted = (rows: Record<string, unknown>[]) => rows.map((r) => JSON.stringify(r)).sort().map((r) => JSON.parse(r) as Record<string, unknown>);
    const dump = async () => Object.fromEntries(await Promise.all(tables.map(async (t) => [t, sorted(await db.query(`SELECT * FROM ${t}`))])));
    const before = await dump();

    const calls: { from: number; to: number }[] = [];
    const r = await migrate(db, upTo(14), { beforeMigrate: async (v) => { calls.push(v); } });
    expect(r.ok && r.value).toEqual({ from: 13, to: 14, applied: [14] });
    expect(calls).toEqual([{ from: 13, to: 14 }]);

    const after = await dump();
    const strip = (rows: Record<string, unknown>[]) => rows.map(({ style: _s, description: _d, locked: _l, cover_credit: _c, ...rest }) => rest);
    expect(sorted(strip(after.pages as Record<string, unknown>[]))).toEqual(before.pages);
    for (const t of tables.filter((t) => t !== "pages")) expect(after[t], t).toEqual(before[t]);
    expect(Object.fromEntries((after.pages as { id: string; style: string | null }[]).map((p) => [p.id, p.style]))).toEqual({
      raiz: '{"spacing":{"width":"full"}}', hija: null, papelera: null,
    });
  });
});
