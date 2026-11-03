// Respaldo de bases de datos (databases/<id>.json) y de recordatorios (reminders.json): serializar, validar y restaurar.
import { appError, err, ok, type Result } from "../result";
import type { SqlExecutor, SqlStore } from "../ports/sqlStore";
import { PROPERTY_TYPES } from "../databases/values";
import { VIEW_TYPES } from "../databases/viewService";
import { stableJson } from "./stableJson";

export type DbFile = {
  id: string; name: string; pageId: string | null; hostPageId: string | null; createdAt: number; updatedAt: number;
  properties: { id: string; name: string; type: string; position: string; config: Record<string, unknown> }[];
  views: { id: string; name: string; type: string; position: string; config: Record<string, unknown> }[];
  rows: { pageId: string; position: string; createdAt: number; updatedAt: number; values: Record<string, unknown> }[];
  links: { propertyId: string; from: string; to: string }[];
};
export type RemindersFile = {
  tasks: { id: string; source: string; pageId: string; blockId: string | null; databaseId: string | null; title: string; due: string | null; remindAt: string | null; recurrence: unknown; done: boolean; startTime?: string; durationMin?: number }[];
  states: { taskId: string; occurrence: string; state: string; snoozedUntil: string | null }[];
};
const enc = new TextEncoder();
const invalid = (message: string, details?: Record<string, unknown>) => err(appError("INVALID", message, details));

/** Un archivo por base de datos. Los valores calculados (fórmulas, rollups, relaciones, fechas automáticas) no se guardan: se recalculan. */
export async function serializeDatabases(store: SqlStore): Promise<Map<string, Uint8Array>> {
  const out = new Map<string, Uint8Array>();
  const dbs = await store.query<{ id: string; name: string; page_id: string | null; host_page_id: string | null; created_at: number; updated_at: number }>("SELECT * FROM databases ORDER BY id");
  for (const d of dbs) {
    const props = await store.query<{ id: string; name: string; type: string; position: string; config: string }>("SELECT * FROM properties WHERE database_id = ? ORDER BY position, id", [d.id]);
    const views = await store.query<{ id: string; name: string; type: string; position: string; config: string }>("SELECT * FROM views WHERE database_id = ? ORDER BY position, id", [d.id]);
    const rows = await store.query<{ page_id: string; position: string; created_at: number; updated_at: number }>("SELECT * FROM db_rows WHERE database_id = ? ORDER BY position, page_id", [d.id]);
    const cells = await store.query<{ page_id: string; property_id: string; value: string }>("SELECT page_id, property_id, value FROM cell_values WHERE database_id = ? ORDER BY page_id, property_id", [d.id]);
    const byPage = new Map<string, Record<string, unknown>>();
    for (const c of cells) { const m = byPage.get(c.page_id) ?? {}; m[c.property_id] = JSON.parse(c.value); byPage.set(c.page_id, m); }
    const links = await store.query<{ property_id: string; from_page_id: string; to_page_id: string }>(
      "SELECT property_id, from_page_id, to_page_id FROM relation_links WHERE property_id IN (SELECT id FROM properties WHERE database_id = ?) ORDER BY property_id, from_page_id, to_page_id", [d.id]);
    const file: DbFile = {
      id: d.id, name: d.name, pageId: d.page_id, hostPageId: d.host_page_id, createdAt: d.created_at, updatedAt: d.updated_at,
      properties: props.map((p) => ({ id: p.id, name: p.name, type: p.type, position: p.position, config: JSON.parse(p.config) })),
      views: views.map((v) => ({ id: v.id, name: v.name, type: v.type, position: v.position, config: JSON.parse(v.config) })),
      rows: rows.map((r) => ({ pageId: r.page_id, position: r.position, createdAt: r.created_at, updatedAt: r.updated_at, values: byPage.get(r.page_id) ?? {} })),
      links: links.map((l) => ({ propertyId: l.property_id, from: l.from_page_id, to: l.to_page_id })),
    };
    out.set(`databases/${d.id}.json`, enc.encode(stableJson(file)));
  }
  return out;
}

export async function serializeReminders(store: SqlStore): Promise<Uint8Array | null> {
  const tasks = await store.query<{ id: string; source: string; page_id: string; block_id: string | null; database_id: string | null; title: string; due: string | null; remind_at: string | null; recurrence: string | null; done: number; start_time: string | null; duration_min: number | null }>("SELECT * FROM tasks ORDER BY id");
  const states = await store.query<{ task_id: string; occurrence: string; state: string; snoozed_until: string | null }>("SELECT * FROM reminder_state ORDER BY task_id");
  if (tasks.length === 0 && states.length === 0) return null;
  const file: RemindersFile = {
    tasks: tasks.map((t) => ({ id: t.id, source: t.source, pageId: t.page_id, blockId: t.block_id, databaseId: t.database_id, title: t.title, due: t.due, remindAt: t.remind_at, recurrence: t.recurrence ? JSON.parse(t.recurrence) : null, done: t.done === 1, ...(t.start_time ? { startTime: t.start_time } : {}), ...(t.duration_min ? { durationMin: t.duration_min } : {}) })),
    states: states.map((s) => ({ taskId: s.task_id, occurrence: s.occurrence, state: s.state, snoozedUntil: s.snoozed_until })),
  };
  return enc.encode(stableJson(file));
}

const isObj = (v: unknown): v is Record<string, any> => !!v && typeof v === "object" && !Array.isArray(v); // eslint-disable-line @typescript-eslint/no-explicit-any

/** Valida las bases de datos y los recordatorios del respaldo contra las páginas que traen. No escribe nada. */
export function validateDatabases(parsed: { path: string; data: unknown }[], reminders: unknown | undefined, pageIds: Set<string>): Result<{ databases: DbFile[]; reminders: RemindersFile | null }> {
  const databases: DbFile[] = [];
  const propIds = new Set<string>();
  const dbIds = new Set<string>();
  for (const { path, data } of parsed) {
    const d = data;
    if (!isObj(d) || typeof d.id !== "string" || path !== `databases/${d.id}.json`) return invalid(`La ruta ${path} no coincide con el id de la base de datos`);
    if (dbIds.has(d.id)) return invalid(`La base de datos ${d.id} está repetida`);
    dbIds.add(d.id);
    if (typeof d.name !== "string" || typeof d.createdAt !== "number" || typeof d.updatedAt !== "number") return invalid(`${path} tiene campos inválidos`);
    for (const ref of [d.pageId, d.hostPageId]) if (ref !== null && ref !== undefined && (typeof ref !== "string" || !pageIds.has(ref))) return invalid(`${path} apunta a una página que no existe`, { page: ref });
    if (!Array.isArray(d.properties) || !Array.isArray(d.views) || !Array.isArray(d.rows) || !Array.isArray(d.links)) return invalid(`${path} está incompleto`);
    const myProps = new Set<string>();
    for (const p of d.properties) {
      if (!isObj(p) || typeof p.id !== "string" || typeof p.name !== "string" || typeof p.position !== "string" || !isObj(p.config)) return invalid(`${path} tiene una propiedad inválida`);
      if (!PROPERTY_TYPES.includes(p.type)) return invalid(`${path} tiene una propiedad de tipo desconocido («${String(p.type)}»)`);
      if (propIds.has(p.id)) return invalid(`La propiedad ${p.id} está repetida`);
      propIds.add(p.id); myProps.add(p.id);
    }
    for (const v of d.views) {
      if (!isObj(v) || typeof v.id !== "string" || typeof v.name !== "string" || typeof v.position !== "string" || !isObj(v.config)) return invalid(`${path} tiene una vista inválida`);
      if (!VIEW_TYPES.includes(v.type)) return invalid(`${path} tiene una vista de tipo desconocido («${String(v.type)}»)`);
    }
    const rowPages = new Set<string>();
    for (const r of d.rows) {
      if (!isObj(r) || typeof r.pageId !== "string" || typeof r.position !== "string" || typeof r.createdAt !== "number" || typeof r.updatedAt !== "number" || !isObj(r.values)) return invalid(`${path} tiene una fila inválida`);
      if (!pageIds.has(r.pageId)) return invalid(`${path} tiene una fila cuya página no existe`, { page: r.pageId });
      if (rowPages.has(r.pageId)) return invalid(`${path} repite una fila`);
      rowPages.add(r.pageId);
      for (const k of Object.keys(r.values)) if (!myProps.has(k)) return invalid(`${path} tiene un valor de una propiedad que no existe`, { property: k });
    }
    for (const l of d.links) if (!isObj(l) || typeof l.propertyId !== "string" || !myProps.has(l.propertyId) || !pageIds.has(l.from) || !pageIds.has(l.to)) return invalid(`${path} tiene un vínculo inválido`);
    databases.push(d as DbFile);
  }
  let rem: RemindersFile | null = null;
  if (reminders !== undefined) {
    const r = reminders;
    if (!isObj(r) || !Array.isArray(r.tasks) || !Array.isArray(r.states)) return invalid("reminders.json está incompleto");
    for (const t of r.tasks) {
      if (!isObj(t) || typeof t.id !== "string" || !["checkbox", "card", "row"].includes(t.source) || typeof t.pageId !== "string" || !pageIds.has(t.pageId) || typeof t.title !== "string") return invalid("reminders.json tiene una tarea inválida");
      if ((t.startTime !== undefined && typeof t.startTime !== "string") || (t.durationMin !== undefined && (!Number.isInteger(t.durationMin) || t.durationMin <= 0))) return invalid("reminders.json tiene una hora o duración de tarea inválida");
      if (t.databaseId != null && !dbIds.has(t.databaseId)) return invalid("reminders.json tiene una tarea de una base que no existe");
    }
    for (const s of r.states) if (!isObj(s) || typeof s.taskId !== "string" || typeof s.occurrence !== "string" || !["fired", "snoozed", "dismissed"].includes(s.state)) return invalid("reminders.json tiene un estado de aviso inválido");
    rem = r as RemindersFile;
  }
  return ok({ databases, reminders: rem });
}

export async function insertDatabases(tx: SqlExecutor, databases: DbFile[], reminders: RemindersFile | null): Promise<void> {
  for (const d of databases) await tx.exec("INSERT INTO databases(id, name, page_id, host_page_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)", [d.id, d.name, d.pageId ?? null, d.hostPageId ?? null, d.createdAt, d.updatedAt]);
  for (const d of databases) {
    for (const p of d.properties) await tx.exec("INSERT INTO properties(id, database_id, name, type, position, config) VALUES (?, ?, ?, ?, ?, ?)", [p.id, d.id, p.name, p.type, p.position, JSON.stringify(p.config)]);
    for (const v of d.views) await tx.exec("INSERT INTO views(id, database_id, name, type, position, config) VALUES (?, ?, ?, ?, ?, ?)", [v.id, d.id, v.name, v.type, v.position, JSON.stringify(v.config)]);
    for (const r of d.rows) {
      await tx.exec("INSERT INTO db_rows(database_id, page_id, position, created_at, updated_at) VALUES (?, ?, ?, ?, ?)", [d.id, r.pageId, r.position, r.createdAt, r.updatedAt]);
      for (const [propId, value] of Object.entries(r.values)) await tx.exec("INSERT INTO cell_values(database_id, page_id, property_id, value) VALUES (?, ?, ?, ?)", [d.id, r.pageId, propId, JSON.stringify(value)]);
    }
  }
  for (const d of databases) for (const l of d.links) await tx.exec("INSERT INTO relation_links(property_id, from_page_id, to_page_id) VALUES (?, ?, ?)", [l.propertyId, l.from, l.to]);
  if (reminders) {
    for (const t of reminders.tasks) {
      await tx.exec("INSERT INTO tasks(id, source, page_id, block_id, database_id, title, due, remind_at, recurrence, done, updated_at, start_time, duration_min) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)",
        [t.id, t.source, t.pageId, t.blockId ?? null, t.databaseId ?? null, t.title, t.due ?? null, t.remindAt ?? null, t.recurrence ? JSON.stringify(t.recurrence) : null, t.done ? 1 : 0, t.startTime ?? null, t.durationMin ?? null]);
    }
    for (const s of reminders.states) await tx.exec("INSERT INTO reminder_state(task_id, occurrence, state, snoozed_until, updated_at) VALUES (?, ?, ?, ?, 0)", [s.taskId, s.occurrence, s.state, s.snoozedUntil ?? null]);
  }
}
