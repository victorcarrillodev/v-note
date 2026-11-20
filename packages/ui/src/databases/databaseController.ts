import {
  BoardService, moveCardWithUndo, DatabaseService, PageService, TaskService, ViewService, appError, err,
  type Clock, type DatabaseInfo, type Property, type PropertyType, type Result, type SqlStore, type View, type ViewConfig, type ViewResult, type ViewType,
} from "@vnote/core";

const withKeyword = (r: ViewResult, keyword: string): ViewResult =>
  keyword.trim() === "" ? r : { ...r, rows: r.rows.filter((x) => matchesKeyword(x, keyword)), groups: r.groups ? r.groups.map((g) => ({ ...g, rows: g.rows.filter((x) => matchesKeyword(x, keyword)) })) : null };
import { matchesKeyword } from "./toolbar";

export type DatabaseSnapshot = {
  database: DatabaseInfo | null;
  properties: Property[];
  views: View[];
  activeViewId: string | null;
  result: ViewResult | null;
  /** Palabra clave de la barra: filtra por título y texto sin tocar la configuración guardada de la vista. */
  keyword: string;
};

/** Lógica de interfaz de una base de datos: mantiene el estado visible y delega TODO el dominio en el núcleo. */
export class DatabaseController {
  private dbs: DatabaseService;
  private views: ViewService;
  private boards: BoardService;
  private tasks: TaskService;
  private pages: PageService;
  private listeners = new Set<() => void>();
  private snapshot: DatabaseSnapshot = { database: null, properties: [], views: [], activeViewId: null, result: null, keyword: "" };
  private seq = 0;

  constructor(private store: SqlStore, clock: Clock, private dbId: string) {
    this.dbs = new DatabaseService(store, clock);
    this.views = new ViewService(store);
    this.pages = new PageService(store, clock);
    this.boards = new BoardService(this.dbs, this.views);
    this.tasks = new TaskService(store, clock, { async setSchedule() {}, async setDone() {} }, () => new Date(clock.now()).toISOString().slice(0, 16));
  }

  /** Controlador de la base cuya página completa es `pageId`, ya cargado; `null` si esa página no es una base de datos. */
  static async forPage(store: SqlStore, clock: Clock, pageId: string): Promise<DatabaseController | null> {
    const info = await new DatabaseService(store, clock).findByPage(pageId);
    if (!info) return null;
    const c = new DatabaseController(store, clock, info.id);
    await c.refresh();
    return c;
  }

  /** Controlador de una base por su id (para vistas incrustadas en notas); `null` si ya no existe. */
  static async forDatabase(store: SqlStore, clock: Clock, dbId: string): Promise<DatabaseController | null> {
    if (!(await new DatabaseService(store, clock).getDatabase(dbId)).ok) return null;
    const c = new DatabaseController(store, clock, dbId);
    await c.refresh();
    return c;
  }

  /** Ícono y portada de las páginas de las filas (para tarjetas y listas); las que no existen no aparecen. */
  async rowMeta(pageIds: string[]): Promise<Record<string, { icon: string | null; cover: string | null }>> {
    if (pageIds.length === 0) return {};
    const rows = await this.store.query<{ id: string; icon: string | null; cover: string | null }>(`SELECT id, icon, cover FROM pages WHERE id IN (${pageIds.map(() => "?").join(",")})`, pageIds);
    return Object.fromEntries(rows.map((r) => [r.id, { icon: r.icon, cover: r.cover }]));
  }

  subscribe = (fn: () => void): (() => void) => { this.listeners.add(fn); return () => this.listeners.delete(fn); };
  getSnapshot = (): DatabaseSnapshot => this.snapshot;
  private set(patch: Partial<DatabaseSnapshot>) { this.snapshot = { ...this.snapshot, ...patch }; this.listeners.forEach((l) => l()); }
  get databaseId() { return this.dbId; }

  /** Relee todo. Si varias lecturas se solapan, solo cuenta la más reciente. */
  async refresh(): Promise<void> {
    const mine = ++this.seq;
    const [database, properties, views] = await Promise.all([this.dbs.getDatabase(this.dbId), this.dbs.listProperties(this.dbId), this.views.list(this.dbId)]);
    if (mine !== this.seq) return;
    const active = views.find((v) => v.id === this.snapshot.activeViewId)?.id ?? views[0]?.id ?? null;
    const run = active ? await this.views.run(this.dbs, active) : null;
    if (mine !== this.seq) return;
    const result = run && run.ok ? withKeyword(run.value, this.snapshot.keyword) : null;
    this.set({ database: database.ok ? database.value : null, properties, views, activeViewId: active, result });
  }

  /** Tras cada cambio: se relee el estado y se mantiene al día el índice de tareas de esta base (tarjetas y filas con fecha). */
  private async after<T>(r: Result<T>): Promise<Result<T>> {
    if (r.ok) await this.tasks.indexDatabase(this.dbs, this.dbId).catch(() => {});
    await this.refresh();
    return r;
  }

  /** Tareas del espacio (casillas, tarjetas y filas) ya indexadas. */
  listTasks() { return this.tasks.list(); }

  async setKeyword(keyword: string): Promise<void> { this.set({ keyword }); await this.refresh(); }
  async setActiveView(id: string): Promise<void> { this.set({ activeViewId: id }); await this.refresh(); }

  async addRow(title = "", values?: Record<string, unknown>): Promise<Result<{ pageId: string }>> { return this.after(await this.dbs.addRow(this.dbId, { title, ...(values ? { values: values as never } : {}) })); }
  async setTitle(pageId: string, title: string) { return this.after(await this.pages.rename(pageId, title)); }
  async setCell(pageId: string, propId: string, raw: unknown) { return this.after(await this.dbs.setCell(this.dbId, pageId, propId, raw)); }
  async removeRow(pageId: string) { return this.after(await this.dbs.removeFromDatabase(this.dbId, pageId)); }

  async addProperty(input: { name: string; type: PropertyType; config?: Property["config"] }) { return this.after(await this.dbs.addProperty(this.dbId, input)); }
  async addFormula(name: string, expression: string) { return this.after(await this.dbs.addFormula(this.dbId, { name, expression })); }
  /** Vista previa de una fórmula sin guardarla: valida y la evalúa sobre la primera fila. */
  previewFormula(expression: string) { return this.dbs.previewFormula(this.dbId, expression); }
  async updateFormula(propId: string, expression: string) { return this.after(await this.dbs.updateFormula(propId, expression)); }
  async renameProperty(id: string, name: string) { return this.after(await this.dbs.renameProperty(id, name)); }
  async deleteProperty(id: string) { return this.after(await this.dbs.deleteProperty(id)); }
  async updatePropertyConfig(id: string, config: Property["config"]) { return this.after(await this.dbs.updatePropertyConfig(id, config)); }

  async createView(type: ViewType, name: string) { return this.after(await this.views.create(this.dbId, { name, type })); }
  async deleteView(id: string) {
    const r = await this.views.delete(id);
    if (r.ok && this.snapshot.activeViewId === id) this.snapshot = { ...this.snapshot, activeViewId: null };
    return this.after(r);
  }
  async renameView(id: string, name: string) { return this.after(await this.views.update(id, { name })); }

  /** Cambia la configuración de la vista activa (filtro, orden, agrupación, columnas...). `undefined` quita ese campo. */
  async updateViewConfig(patch: Partial<Record<keyof ViewConfig, unknown>>): Promise<Result<View>> {
    const id = this.snapshot.activeViewId;
    const view = this.snapshot.views.find((v) => v.id === id);
    if (!view) return err(appError("NOT_FOUND", "No hay una vista activa"));
    const config: Record<string, unknown> = { ...view.config };
    for (const [k, v] of Object.entries(patch)) { if (v === undefined) delete config[k]; else config[k] = v; }
    return this.after(await this.views.update(view.id, { config: config as ViewConfig }));
  }

  // ---- Tablero (kanban) ----
  async addCard(title: string, columnId?: string) { return this.after(await this.boards.createCard(this.dbId, { title, ...(columnId ? { columnId } : {}) })); }
  async moveCard(pageId: string, columnId: string, afterPageId?: string | null) { return this.after(await this.boards.moveCard(this.dbId, pageId, columnId, afterPageId)); }
  /** Mover tarjeta ofreciendo la operación inversa (RF-11.1). */
  async moveCardUndoable(pageId: string, columnId: string, afterPageId?: string | null): Promise<Result<{ undo: () => Promise<void> }>> {
    const r = await moveCardWithUndo(this.boards, this.dbId, pageId, columnId, afterPageId);
    await this.refresh();
    return r.ok ? { ok: true, value: { undo: async () => { await r.value.undo(); await this.refresh(); } } } : r;
  }
  async addColumn(name: string) { return this.after(await this.boards.addColumn(this.dbId, name)); }
  async renameColumn(id: string, name: string) { return this.after(await this.boards.renameColumn(this.dbId, id, name)); }
  async deleteColumn(id: string, opts: { moveTo?: string } = {}) { return this.after(await this.boards.deleteColumn(this.dbId, id, opts)); }
  describeColumnDeletion(id: string) { return this.boards.describeColumnDeletion(this.dbId, id); }

  /** Para quien necesite el resultado de otra vista sin activarla (p. ej. un bloque enlazado). */
  async runView(viewId: string): Promise<Result<ViewResult>> { return this.views.run(this.dbs, viewId); }
}
