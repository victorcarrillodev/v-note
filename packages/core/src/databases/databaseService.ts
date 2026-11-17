import { appError, err, ok, type Result } from "../result";
import type { Clock } from "../clock";
import { newId } from "../ids";
import type { SqlStore } from "../ports/sqlStore";
import { PageService } from "../pages/pageService";
import { PagesRepo } from "../pages/pagesRepo";
import { positionBetween } from "../pages/positions";
import { FormulaEngine, type EngineInput, type ErrorValue } from "../formulas/engine";
import { tryAddDefinition, type PropDef } from "../formulas/dependencies";
import { parse } from "../formulas/parser";
import { referencedNames } from "../formulas/dependencies";
import { PROPERTY_TYPES, defaultConfig, validateValue, type CellValue, type PropertyConfig, type PropertyType } from "./values";

export type DatabaseInfo = { id: string; name: string; pageId: string | null; hostPageId: string | null; createdAt: number; updatedAt: number };
export type Property = { id: string; databaseId: string; name: string; type: PropertyType; position: string; config: PropertyConfig };
export const ROLLUP_FUNCTIONS = ["count", "sum", "avg", "min", "max"] as const;
export type RollupFunction = (typeof ROLLUP_FUNCTIONS)[number];
/** `locked` solo aparece cuando la página de la fila está bloqueada: su título es de solo lectura, sus propiedades siguen editables (RF-8.1.1). */
export type DbRow = { pageId: string; title: string; position: string; values: Record<string, CellValue | ErrorValue | null>; locked?: true };

type PropRow = { id: string; database_id: string; name: string; type: PropertyType; position: string; config: string };
const toProp = (r: PropRow): Property => ({ id: r.id, databaseId: r.database_id, name: r.name, type: r.type, position: r.position, config: JSON.parse(r.config) as PropertyConfig });
type DbRowRaw = { id: string; name: string; page_id: string | null; host_page_id: string | null; created_at: number; updated_at: number };
const toDb = (r: DbRowRaw): DatabaseInfo => ({ id: r.id, name: r.name, pageId: r.page_id, hostPageId: r.host_page_id, createdAt: r.created_at, updatedAt: r.updated_at });

/** Sustituye prop("viejo") por prop("nuevo") en una fórmula, respetando las comillas y los escapes. */
function rewriteReference(expression: string, oldName: string, newName: string): string {
  const escape = (n: string) => n.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return expression.replace(/prop\(\s*(["'])((?:\\.|(?!\1)[^\\])*)\1\s*\)/g, (all, _q: string, inner: string) => {
    const name = inner.replace(/\\(.)/g, "$1");
    return name === oldName ? `prop("${escape(newName)}")` : all;
  });
}

const notFound = (what: string, id: string) => err(appError("NOT_FOUND", `${what} no existe`, { id }));

/** Bases de datos: definición, propiedades, filas (que son páginas) y valores de celda. Cada fila pertenece a una o varias bases (CL-34). */
export class DatabaseService {
  private pages: PagesRepo;
  private pageSvc: PageService;
  constructor(private db: SqlStore, private clock: Clock) {
    this.pages = new PagesRepo(db, clock);
    this.pageSvc = new PageService(db, clock);
  }

  // ---- Bases ----

  async getDatabase(id: string): Promise<Result<DatabaseInfo>> {
    const r = (await this.db.query<DbRowRaw>("SELECT * FROM databases WHERE id = ?", [id]))[0];
    return r ? ok(toDb(r)) : notFound("La base de datos", id);
  }

  /** La base de datos que tiene a esta página como página completa (si la hay). */
  async findByPage(pageId: string): Promise<DatabaseInfo | null> {
    const r = (await this.db.query<DbRowRaw>("SELECT * FROM databases WHERE page_id = ?", [pageId]))[0];
    return r ? toDb(r) : null;
  }

  /** Sin `hostPageId` es una página completa (se crea la página); con él, vive dentro de esa nota. */
  async createDatabase(input: { name?: string; hostPageId?: string | null; parentId?: string | null; pageKind?: "database" | "board" }): Promise<Result<DatabaseInfo>> {
    const name = (input.name ?? "").trim();
    const now = this.clock.now();
    const id = newId();
    let pageId: string | null = null;
    if (input.hostPageId) {
      const host = await this.pages.get(input.hostPageId);
      if (!host.ok) return host;
    } else {
      const page = await this.pageSvc.create({ parentId: input.parentId ?? null, title: name, kind: input.pageKind ?? "database" });
      if (!page.ok) return page;
      pageId = page.value.id;
    }
    try {
      await this.db.transaction(async (tx) => {
        await tx.exec("INSERT INTO databases(id, name, page_id, host_page_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)", [id, name, pageId, input.hostPageId ?? null, now, now]);
        await tx.exec("INSERT INTO views(id, database_id, name, type, position, config) VALUES (?, ?, 'Tabla', 'table', ?, '{}')", [newId(), id, positionBetween(null, null)]);
      });
    } catch (e) {
      if (pageId) await this.pages.deletePermanently(pageId, { confirm: true });
      return err(appError("STORAGE", "No se pudo crear la base de datos", { cause: String(e) }));
    }
    return this.getDatabase(id);
  }

  private async parentFor(dbId: string): Promise<string | null> {
    const d = await this.getDatabase(dbId);
    return d.ok ? (d.value.pageId ?? d.value.hostPageId) : null;
  }

  // ---- Propiedades ----

  async listProperties(dbId: string): Promise<Property[]> {
    return (await this.db.query<PropRow>("SELECT * FROM properties WHERE database_id = ? ORDER BY position", [dbId])).map(toProp);
  }

  private async nameTaken(dbId: string, name: string, exceptId?: string): Promise<boolean> {
    const rows = await this.db.query<{ id: string }>("SELECT id FROM properties WHERE database_id = ? AND lower(name) = lower(?)", [dbId, name]);
    return rows.some((r) => r.id !== exceptId);
  }

  async addProperty(dbId: string, input: { name: string; type: PropertyType; config?: PropertyConfig }): Promise<Result<Property>> {
    const db = await this.getDatabase(dbId);
    if (!db.ok) return db;
    const name = input.name.trim();
    if (name === "") return err(appError("INVALID", "La propiedad necesita un nombre", { reason: "NAME" }));
    if (!PROPERTY_TYPES.includes(input.type)) return err(appError("INVALID", "Tipo de propiedad desconocido", { reason: "TYPE" }));
    if (await this.nameTaken(dbId, name)) return err(appError("CONFLICT", "Ya existe una propiedad con ese nombre", { reason: "DUPLICATE_NAME" }));
    const config = { ...defaultConfig(input.type), ...(input.config ?? {}) };
    const last = (await this.listProperties(dbId)).at(-1)?.position ?? null;
    const id = newId();
    await this.db.exec("INSERT INTO properties(id, database_id, name, type, position, config) VALUES (?, ?, ?, ?, ?, ?)", [id, dbId, name, input.type, positionBetween(last, null), JSON.stringify(config)]);
    // Las filas existentes de estado arrancan en la primera opción
    if (input.type === "status") {
      const first = config.options?.[0]?.id;
      if (first) await this.db.exec("INSERT INTO cell_values(database_id, page_id, property_id, value) SELECT database_id, page_id, ?, ? FROM db_rows WHERE database_id = ?", [id, JSON.stringify(first), dbId]);
    }
    return this.getProperty(id);
  }

  async getProperty(id: string): Promise<Result<Property>> {
    const r = (await this.db.query<PropRow>("SELECT * FROM properties WHERE id = ?", [id]))[0];
    return r ? ok(toProp(r)) : notFound("La propiedad", id);
  }

  async renameProperty(id: string, name: string): Promise<Result<Property>> {
    const p = await this.getProperty(id);
    if (!p.ok) return p;
    const n = name.trim();
    if (n === "") return err(appError("INVALID", "La propiedad necesita un nombre", { reason: "NAME" }));
    if (await this.nameTaken(p.value.databaseId, n, id)) return err(appError("CONFLICT", "Ya existe una propiedad con ese nombre", { reason: "DUPLICATE_NAME" }));
    const oldName = p.value.name;
    await this.db.transaction(async (tx) => {
      await tx.exec("UPDATE properties SET name = ? WHERE id = ?", [n, id]);
      // Las fórmulas de la misma base que citan el nombre antiguo pasan a citar el nuevo
      const formulas = await tx.query<PropRow>("SELECT * FROM properties WHERE database_id = ? AND type = 'formula'", [p.value.databaseId]);
      for (const f of formulas) {
        const cfg = JSON.parse(f.config) as PropertyConfig;
        const expr = String(cfg.expression ?? "");
        const next = rewriteReference(expr, oldName, n);
        if (next !== expr) await tx.exec("UPDATE properties SET config = ? WHERE id = ?", [JSON.stringify({ ...cfg, expression: next }), f.id]);
      }
    });
    return this.getProperty(id);
  }

  /** `afterId`: undefined = al final, null = al inicio, id = justo después de esa propiedad. */
  async moveProperty(id: string, afterId?: string | null): Promise<Result<Property>> {
    const p = await this.getProperty(id);
    if (!p.ok) return p;
    const others = (await this.listProperties(p.value.databaseId)).filter((x) => x.id !== id);
    let before: string | null, after: string | null;
    if (afterId === undefined) { before = others.at(-1)?.position ?? null; after = null; }
    else if (afterId === null) { before = null; after = others[0]?.position ?? null; }
    else {
      const i = others.findIndex((x) => x.id === afterId);
      if (i === -1) return notFound("La propiedad de referencia", afterId);
      before = others[i]!.position; after = others[i + 1]?.position ?? null;
    }
    await this.db.exec("UPDATE properties SET position = ? WHERE id = ?", [positionBetween(before, after), id]);
    return this.getProperty(id);
  }

  async deleteProperty(id: string): Promise<Result<void>> {
    const p = await this.getProperty(id);
    if (!p.ok) return p;
    // Una relación es una pareja de propiedades: se borran las dos (los vínculos y valores se van en cascada)
    const paired = p.value.type === "relation" ? (p.value.config.pairedPropertyId as string | undefined) : undefined;
    await this.db.transaction(async (tx) => {
      await tx.exec("DELETE FROM properties WHERE id = ?", [id]);
      if (paired && paired !== id) await tx.exec("DELETE FROM properties WHERE id = ?", [paired]);
    });
    return ok(undefined);
  }

  /** Cambia las opciones de una selección; los valores que usaban una opción eliminada se limpian. */
  async updatePropertyConfig(id: string, config: PropertyConfig): Promise<Result<Property>> {
    const p = await this.getProperty(id);
    if (!p.ok) return p;
    if (config.options) {
      const ids = config.options.map((o) => o.id);
      if (new Set(ids).size !== ids.length || config.options.some((o) => !o.id || o.name.trim() === "")) {
        return err(appError("INVALID", "Las opciones necesitan un id único y un nombre", { reason: "OPTIONS" }));
      }
    }
    const next = { ...p.value.config, ...config };
    await this.db.transaction(async (tx) => {
      await tx.exec("UPDATE properties SET config = ? WHERE id = ?", [JSON.stringify(next), id]);
      if (next.options && (p.value.type === "select" || p.value.type === "status" || p.value.type === "multi_select")) {
        const valid = new Set(next.options.map((o) => o.id));
        const cells = await tx.query<{ database_id: string; page_id: string; value: string }>("SELECT database_id, page_id, value FROM cell_values WHERE property_id = ?", [id]);
        for (const c of cells) {
          const v = JSON.parse(c.value) as string | string[];
          const keep = Array.isArray(v) ? v.filter((x) => valid.has(x)) : valid.has(v) ? v : null;
          const empty = keep === null || (Array.isArray(keep) && keep.length === 0);
          if (empty) await tx.exec("DELETE FROM cell_values WHERE database_id = ? AND page_id = ? AND property_id = ?", [c.database_id, c.page_id, id]);
          else if (Array.isArray(v) && Array.isArray(keep) && keep.length !== v.length) await tx.exec("UPDATE cell_values SET value = ? WHERE database_id = ? AND page_id = ? AND property_id = ?", [JSON.stringify(keep), c.database_id, c.page_id, id]);
        }
      }
    });
    return this.getProperty(id);
  }

  // ---- Filas y celdas ----

  private async lastRowPosition(dbId: string): Promise<string | null> {
    return (await this.db.query<{ position: string }>("SELECT position FROM db_rows WHERE database_id = ? ORDER BY position DESC LIMIT 1", [dbId]))[0]?.position ?? null;
  }

  /** Crea la página de la fila y la añade a la base. Si algún valor inicial es inválido no se crea nada. */
  async addRow(dbId: string, input: { title?: string; values?: Record<string, unknown> } = {}): Promise<Result<{ pageId: string }>> {
    const d = await this.getDatabase(dbId);
    if (!d.ok) return d;
    const props = await this.listProperties(dbId);
    const initial = new Map<string, CellValue>();
    for (const [propId, raw] of Object.entries(input.values ?? {})) {
      const p = props.find((x) => x.id === propId);
      if (!p) return notFound("La propiedad", propId);
      const v = validateValue(p.type, p.config, raw);
      if (!v.ok) return v;
      if (v.value !== null) initial.set(propId, v.value);
    }
    const page = await this.pageSvc.create({ parentId: d.value.pageId ?? d.value.hostPageId, title: input.title ?? "" });
    if (!page.ok) return page;
    const now = this.clock.now();
    const position = positionBetween(await this.lastRowPosition(dbId), null);
    try {
      await this.db.transaction(async (tx) => {
        await tx.exec("INSERT INTO db_rows(database_id, page_id, position, created_at, updated_at) VALUES (?, ?, ?, ?, ?)", [dbId, page.value.id, position, now, now]);
        for (const p of props) {
          const v = initial.has(p.id) ? initial.get(p.id)! : p.type === "status" ? (p.config.options?.[0]?.id ?? null) : null;
          if (v !== null) await tx.exec("INSERT INTO cell_values(database_id, page_id, property_id, value) VALUES (?, ?, ?, ?)", [dbId, page.value.id, p.id, JSON.stringify(v)]);
        }
      });
    } catch (e) {
      await this.pages.deletePermanently(page.value.id, { confirm: true });
      return err(appError("STORAGE", "No se pudo crear la fila", { cause: String(e) }));
    }
    return ok({ pageId: page.value.id });
  }

  /** Coloca una fila en otra posición: `after` undefined = al final, null = al inicio, id = justo después de esa fila. */
  async placeRow(dbId: string, pageId: string, after?: string | null): Promise<Result<void>> {
    if (!(await this.isRowOf(dbId, pageId))) return notFound("La fila", pageId);
    const others = (await this.db.query<{ page_id: string; position: string }>("SELECT page_id, position FROM db_rows WHERE database_id = ? AND page_id != ? ORDER BY position", [dbId, pageId]));
    let before: string | null, next: string | null;
    if (after === undefined) { before = others.at(-1)?.position ?? null; next = null; }
    else if (after === null) { before = null; next = others[0]?.position ?? null; }
    else {
      const i = others.findIndex((x) => x.page_id === after);
      if (i === -1) return notFound("La fila de referencia", after);
      before = others[i]!.position; next = others[i + 1]?.position ?? null;
    }
    await this.db.exec("UPDATE db_rows SET position = ? WHERE database_id = ? AND page_id = ?", [positionBetween(before, next), dbId, pageId]);
    return ok(undefined);
  }

  /** Añade una página que ya existe a otra base (estado y propiedades propios en cada una). */
  async addExistingPage(dbId: string, pageId: string): Promise<Result<void>> {
    const d = await this.getDatabase(dbId);
    if (!d.ok) return d;
    const page = await this.pages.get(pageId);
    if (!page.ok) return page;
    if ((await this.db.query("SELECT 1 FROM db_rows WHERE database_id = ? AND page_id = ?", [dbId, pageId])).length > 0) {
      return err(appError("CONFLICT", "La página ya está en esta base de datos", { reason: "ALREADY_MEMBER" }));
    }
    const props = await this.listProperties(dbId);
    const now = this.clock.now();
    const position = positionBetween(await this.lastRowPosition(dbId), null);
    await this.db.transaction(async (tx) => {
      await tx.exec("INSERT INTO db_rows(database_id, page_id, position, created_at, updated_at) VALUES (?, ?, ?, ?, ?)", [dbId, pageId, position, now, now]);
      for (const p of props) {
        if (p.type === "status" && p.config.options?.[0]) {
          await tx.exec("INSERT INTO cell_values(database_id, page_id, property_id, value) VALUES (?, ?, ?, ?)", [dbId, pageId, p.id, JSON.stringify(p.config.options[0].id)]);
        }
      }
    });
    return ok(undefined);
  }

  async removeFromDatabase(dbId: string, pageId: string): Promise<Result<void>> {
    const found = await this.db.query("SELECT 1 FROM db_rows WHERE database_id = ? AND page_id = ?", [dbId, pageId]);
    if (found.length === 0) return notFound("La fila", pageId);
    await this.db.transaction(async (tx) => {
      await tx.exec("DELETE FROM db_rows WHERE database_id = ? AND page_id = ?", [dbId, pageId]);
      // Los vínculos de esta fila (propios y los que apuntan a ella desde otras bases) dejan de existir
      await tx.exec("DELETE FROM relation_links WHERE property_id IN (SELECT id FROM properties WHERE database_id = ?) AND from_page_id = ?", [dbId, pageId]);
      await tx.exec("DELETE FROM relation_links WHERE to_page_id = ? AND property_id IN (SELECT id FROM properties WHERE type = 'relation' AND json_extract(config, '$.targetDatabaseId') = ?)", [pageId, dbId]);
    });
    return ok(undefined);
  }

  // ---- Relaciones y rollups ----

  /** Crea una relación bidireccional: una propiedad en esta base y su pareja en la base destino (que puede ser la misma). */
  async addRelation(dbId: string, input: { name: string; targetDatabaseId: string; pairedName: string }): Promise<Result<{ property: Property; paired: Property }>> {
    const target = await this.getDatabase(input.targetDatabaseId);
    if (!target.ok) return target;
    const a = await this.addProperty(dbId, { name: input.name, type: "relation", config: { targetDatabaseId: input.targetDatabaseId } });
    if (!a.ok) return a;
    const b = await this.addProperty(input.targetDatabaseId, { name: input.pairedName, type: "relation", config: { targetDatabaseId: dbId, pairedPropertyId: a.value.id } });
    if (!b.ok) { await this.db.exec("DELETE FROM properties WHERE id = ?", [a.value.id]); return b; }
    await this.db.exec("UPDATE properties SET config = ? WHERE id = ?", [JSON.stringify({ ...a.value.config, pairedPropertyId: b.value.id }), a.value.id]);
    const [pa, pb] = [await this.getProperty(a.value.id), await this.getProperty(b.value.id)];
    return pa.ok && pb.ok ? ok({ property: pa.value, paired: pb.value }) : err(appError("STORAGE", "No se pudo crear la relación"));
  }

  private async isRowOf(dbId: string, pageId: string): Promise<boolean> {
    return (await this.db.query("SELECT 1 FROM db_rows WHERE database_id = ? AND page_id = ?", [dbId, pageId])).length > 0;
  }

  /** Vincula `fromPage` (fila de la base de la propiedad) con `toPage` (fila de la base destino); el vínculo se ve desde ambos lados. */
  async linkRows(propId: string, fromPage: string, toPage: string): Promise<Result<void>> {
    const p = await this.getProperty(propId);
    if (!p.ok) return p;
    if (p.value.type !== "relation") return err(appError("INVALID", "La propiedad no es una relación", { reason: "NOT_RELATION" }));
    const targetDb = p.value.config.targetDatabaseId as string;
    const paired = p.value.config.pairedPropertyId as string;
    if (!(await this.isRowOf(p.value.databaseId, fromPage))) return notFound("La fila de origen", fromPage);
    if (!(await this.isRowOf(targetDb, toPage))) return err(appError("INVALID", "La fila destino no pertenece a la base de datos relacionada", { reason: "WRONG_DATABASE" }));
    await this.db.transaction(async (tx) => {
      await tx.exec("INSERT OR IGNORE INTO relation_links(property_id, from_page_id, to_page_id) VALUES (?, ?, ?)", [propId, fromPage, toPage]);
      await tx.exec("INSERT OR IGNORE INTO relation_links(property_id, from_page_id, to_page_id) VALUES (?, ?, ?)", [paired, toPage, fromPage]);
    });
    return ok(undefined);
  }

  async unlinkRows(propId: string, fromPage: string, toPage: string): Promise<Result<void>> {
    const p = await this.getProperty(propId);
    if (!p.ok) return p;
    if (p.value.type !== "relation") return err(appError("INVALID", "La propiedad no es una relación", { reason: "NOT_RELATION" }));
    const paired = p.value.config.pairedPropertyId as string;
    await this.db.transaction(async (tx) => {
      await tx.exec("DELETE FROM relation_links WHERE property_id = ? AND from_page_id = ? AND to_page_id = ?", [propId, fromPage, toPage]);
      await tx.exec("DELETE FROM relation_links WHERE property_id = ? AND from_page_id = ? AND to_page_id = ?", [paired, toPage, fromPage]);
    });
    return ok(undefined);
  }

  /** Rollup: calcula sobre las filas relacionadas. Contar no necesita propiedad; el resto exige una propiedad numérica de la base relacionada. */
  async addRollup(dbId: string, input: { name: string; relationPropertyId: string; targetPropertyId?: string; fn: RollupFunction }): Promise<Result<Property>> {
    if (!ROLLUP_FUNCTIONS.includes(input.fn)) return err(appError("INVALID", "Función de rollup desconocida", { reason: "FUNCTION" }));
    const rel = await this.getProperty(input.relationPropertyId);
    if (!rel.ok) return rel;
    if (rel.value.type !== "relation" || rel.value.databaseId !== dbId) return err(appError("INVALID", "El rollup necesita una relación de esta base de datos", { reason: "RELATION" }));
    if (input.fn !== "count") {
      if (!input.targetPropertyId) return err(appError("INVALID", "Elige la propiedad que se va a calcular", { reason: "TARGET" }));
      const t = await this.getProperty(input.targetPropertyId);
      if (!t.ok) return t;
      if (t.value.databaseId !== rel.value.config.targetDatabaseId) return err(appError("INVALID", "La propiedad no pertenece a la base relacionada", { reason: "TARGET" }));
      if (t.value.type !== "number" && t.value.type !== "formula" && t.value.type !== "rollup") return err(appError("INVALID", "Solo se puede calcular sobre propiedades numéricas, fórmulas o rollups", { reason: "TARGET_TYPE" }));
    }
    const cfg = { relationPropertyId: input.relationPropertyId, fn: input.fn, ...(input.targetPropertyId ? { targetPropertyId: input.targetPropertyId } : {}) };
    const cyc = tryAddDefinition(await this.allDefs(), { id: "(nuevo)", name: input.name.trim(), databaseId: dbId, type: "rollup", config: cfg });
    if (!cyc.ok) return err(appError("CYCLE", cyc.error.message, { reason: "CYCLE" }));
    return this.addProperty(dbId, { name: input.name, type: "rollup", config: { relationPropertyId: input.relationPropertyId, fn: input.fn, ...(input.targetPropertyId ? { targetPropertyId: input.targetPropertyId } : {}) } });
  }

  // ---- Fórmulas ----

  private async allDefs(): Promise<PropDef[]> {
    return (await this.db.query<PropRow>("SELECT * FROM properties")).map((r) => ({ id: r.id, name: r.name, databaseId: r.database_id, type: r.type, config: JSON.parse(r.config) as Record<string, unknown> }));
  }

  private async checkFormula(dbId: string, expression: string, selfId?: string, name?: string): Promise<Result<void>> {
    const parsed = parse(expression);
    if (!parsed.ok) return err(appError("INVALID", parsed.error.message, { reason: "SYNTAX", pos: parsed.error.pos }));
    const props = await this.listProperties(dbId);
    for (const n of referencedNames(expression)) {
      if (!props.some((x) => x.name === n)) return err(appError("INVALID", `No existe la propiedad «${n}» en esta base de datos`, { reason: "UNKNOWN_PROPERTY", name: n }));
    }
    const defs = await this.allDefs();
    const self = selfId ? defs.find((d) => d.id === selfId) : undefined;
    const cyc = tryAddDefinition(defs, { id: selfId ?? "(nuevo)", name: name ?? self?.name ?? "(nuevo)", databaseId: dbId, type: "formula", config: { expression } });
    return cyc.ok ? ok(undefined) : err(appError("CYCLE", cyc.error.message, { reason: "CYCLE" }));
  }

  /**
   * Vista previa de una fórmula antes de guardarla: valida (sintaxis, propiedades, ciclos) y la evalúa sobre la primera fila.
   * Devuelve `value: undefined` si la base no tiene filas (solo se validó).
   */
  async previewFormula(dbId: string, expression: string): Promise<Result<{ value: unknown; hasRow: boolean }>> {
    const checked = await this.checkFormula(dbId, expression);
    if (!checked.ok) return checked;
    const props = await this.listProperties(dbId);
    const rows = await this.loadRows(dbId, props);
    if (rows.length === 0) return ok({ value: undefined, hasRow: false });
    const engineRows = await this.engineValues(dbId, rows, new Map(), { id: "__preview", name: "__preview", databaseId: dbId, type: "formula", config: { expression } });
    return ok({ value: engineRows.get(rows[0]!.pageId), hasRow: true });
  }

  /** Propiedad calculada con una fórmula. Se rechaza al definirla si tiene errores de sintaxis, cita propiedades que no existen o crea una referencia circular. */
  async addFormula(dbId: string, input: { name: string; expression: string }): Promise<Result<Property>> {
    const d = await this.getDatabase(dbId);
    if (!d.ok) return d;
    const checked = await this.checkFormula(dbId, input.expression, undefined, input.name.trim());
    if (!checked.ok) return checked;
    return this.addProperty(dbId, { name: input.name, type: "formula", config: { expression: input.expression } });
  }

  async updateFormula(propId: string, expression: string): Promise<Result<Property>> {
    const p = await this.getProperty(propId);
    if (!p.ok) return p;
    if (p.value.type !== "formula") return err(appError("INVALID", "La propiedad no es una fórmula", { reason: "NOT_FORMULA" }));
    const checked = await this.checkFormula(p.value.databaseId, expression, propId);
    if (!checked.ok) return checked;
    await this.db.exec("UPDATE properties SET config = ? WHERE id = ?", [JSON.stringify({ ...p.value.config, expression }), propId]);
    return this.getProperty(propId);
  }

  /** Bases que intervienen en el cálculo de `dbId`: ella misma y las que alcanza por relaciones. */
  private async calcClosure(dbId: string): Promise<string[]> {
    const seen = new Set([dbId]);
    const queue = [dbId];
    while (queue.length) {
      const cur = queue.pop()!;
      for (const p of await this.listProperties(cur)) {
        const t = p.type === "relation" ? (p.config.targetDatabaseId as string | undefined) : undefined;
        if (t && !seen.has(t)) { seen.add(t); queue.push(t); }
      }
    }
    return [...seen];
  }

  /** Construye y calcula el motor para `dbId` (y las bases que alcanza por relaciones). `extra` añade una propiedad virtual (vista previa). */
  private async buildEngine(dbId: string, rows: DbRow[], baseCache: Map<string, DbRow[]>, extra?: PropDef): Promise<{ engine: FormulaEngine; defs: PropDef[] }> {
    const dbs = await this.calcClosure(dbId);
    const defs = (await this.allDefs()).filter((d) => dbs.includes(d.databaseId));
    if (extra) defs.push(extra);
    const input: EngineInput = { props: defs, rows: {}, links: {}, now: () => this.clock.now() };
    for (const id of dbs) {
      const list = id === dbId ? rows : (baseCache.get(id) ?? (await this.loadRows(id, await this.listProperties(id))));
      input.rows[id] = Object.fromEntries(list.map((r) => [r.pageId, { ...(r.values as Record<string, unknown>) }]));
    }
    for (const p of defs.filter((d) => d.type === "relation")) {
      const links = await this.db.query<{ from_page_id: string; to_page_id: string }>(
        "SELECT l.from_page_id, l.to_page_id FROM relation_links l JOIN pages f ON f.id = l.from_page_id JOIN pages t ON t.id = l.to_page_id WHERE l.property_id = ? AND f.deleted_at IS NULL AND t.deleted_at IS NULL ORDER BY l.rowid", [p.id]);
      const m: Record<string, string[]> = {};
      for (const l of links) (m[l.from_page_id] ??= []).push(l.to_page_id);
      input.links[p.id] = m;
    }
    const engine = new FormulaEngine(input);
    await engine.computeAll({ chunk: 100_000 });
    return { engine, defs };
  }

  /** Valor de una propiedad virtual (la vista previa de una fórmula) por fila. */
  private async engineValues(dbId: string, rows: DbRow[], baseCache: Map<string, DbRow[]>, extra: PropDef): Promise<Map<string, unknown>> {
    const { engine } = await this.buildEngine(dbId, rows, baseCache, extra);
    return new Map(rows.map((r) => [r.pageId, engine.get(dbId, r.pageId, extra.id)]));
  }

  /** Calcula con el motor las propiedades de relación, rollup y fórmula y las vuelca en las filas. */
  private async applyEngine(dbId: string, rows: DbRow[], baseCache: Map<string, DbRow[]>): Promise<void> {
    const { engine, defs } = await this.buildEngine(dbId, rows, baseCache);
    const mine = defs.filter((d) => d.databaseId === dbId && (d.type === "formula" || d.type === "rollup" || d.type === "relation"));
    for (const r of rows) {
      for (const p of mine) {
        const v = engine.get(dbId, r.pageId, p.id);
        if (v === null || v === undefined || (Array.isArray(v) && v.length === 0)) delete r.values[p.id];
        else r.values[p.id] = v as never;
      }
    }
  }

  async setCell(dbId: string, pageId: string, propId: string, raw: unknown): Promise<Result<CellValue | null>> {
    if ((await this.db.query("SELECT 1 FROM db_rows WHERE database_id = ? AND page_id = ?", [dbId, pageId])).length === 0) return notFound("La fila", pageId);
    const p = await this.getProperty(propId);
    if (!p.ok) return p;
    if (p.value.databaseId !== dbId) return err(appError("INVALID", "La propiedad no pertenece a esta base de datos", { reason: "FOREIGN_PROPERTY" }));
    const v = validateValue(p.value.type, p.value.config, raw);
    if (!v.ok) return v;
    await this.db.transaction(async (tx) => {
      if (v.value === null) await tx.exec("DELETE FROM cell_values WHERE database_id = ? AND page_id = ? AND property_id = ?", [dbId, pageId, propId]);
      else await tx.exec("INSERT OR REPLACE INTO cell_values(database_id, page_id, property_id, value) VALUES (?, ?, ?, ?)", [dbId, pageId, propId, JSON.stringify(v.value)]);
      await tx.exec("UPDATE db_rows SET updated_at = ? WHERE database_id = ? AND page_id = ?", [this.clock.now(), dbId, pageId]);
    });
    return ok(v.value);
  }

  /** Filas visibles (las de páginas en la papelera no se muestran), en orden, con sus valores guardados y las fechas automáticas. */
  private async loadRows(dbId: string, props: Property[]): Promise<DbRow[]> {
    const rows = await this.db.query<{ page_id: string; title: string; locked: number; position: string; row_updated: number; page_created: number; page_updated: number }>(
      `SELECT r.page_id, p.title, p.locked, r.position, r.updated_at AS row_updated, p.created_at AS page_created, p.updated_at AS page_updated
         FROM db_rows r JOIN pages p ON p.id = r.page_id WHERE r.database_id = ? AND p.deleted_at IS NULL ORDER BY r.position`,
      [dbId],
    );
    const cells = await this.db.query<{ page_id: string; property_id: string; value: string }>("SELECT page_id, property_id, value FROM cell_values WHERE database_id = ?", [dbId]);
    const byPage = new Map<string, Record<string, CellValue | null>>();
    for (const c of cells) {
      const m = byPage.get(c.page_id) ?? {};
      m[c.property_id] = JSON.parse(c.value) as CellValue;
      byPage.set(c.page_id, m);
    }
    return rows.map((r) => {
      const values = byPage.get(r.page_id) ?? {};
      for (const p of props) {
        if (p.type === "created_time") values[p.id] = new Date(r.page_created).toISOString();
        if (p.type === "last_edited_time") values[p.id] = new Date(Math.max(r.row_updated, r.page_updated)).toISOString();
      }
      return { pageId: r.page_id, title: r.title, position: r.position, values, ...(r.locked === 1 ? { locked: true as const } : {}) };
    });
  }

  /** Filas visibles con todos sus valores: los guardados, las fechas automáticas y lo calculado (relaciones, rollups y fórmulas). */
  async getRows(dbId: string): Promise<DbRow[]> {
    const props = await this.listProperties(dbId);
    const rows = await this.loadRows(dbId, props);
    if (props.some((p) => p.type === "formula" || p.type === "rollup" || p.type === "relation")) await this.applyEngine(dbId, rows, new Map());
    return rows;
  }

  async databasesOf(pageId: string): Promise<{ id: string; name: string }[]> {
    return this.db.query<{ id: string; name: string }>("SELECT d.id AS id, COALESCE((SELECT title FROM pages WHERE id = d.page_id), d.name) AS name FROM db_rows r JOIN databases d ON d.id = r.database_id WHERE r.page_id = ? ORDER BY d.created_at, d.id", [pageId]);
  }

  /** Antes de eliminar una página: en qué bases está. Con más de una hay que advertir (RF-22). */
  async describePageRemoval(pageId: string): Promise<Result<{ databases: { id: string; name: string }[]; needsWarning: boolean }>> {
    const page = await this.pages.get(pageId);
    if (!page.ok) return page;
    const databases = await this.databasesOf(pageId);
    return ok({ databases, needsWarning: databases.length > 1 });
  }
}
