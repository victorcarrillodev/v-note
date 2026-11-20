import {
  BoardService, DatabaseService, PagePropsHistory, type PageProps, pageStats, applyStylePatch, type StylePatch, fromYjs, savePageDefaultStyle, loadPageDefaultStyle, type PageStats, collectExportPages, databaseViewProvider, exportHtml, GraphService, LinkService, QuickCapture, ViewService, DocSession, DocStore, PagesRepo, PageService, SearchIndex, appError, err, ok,
  type AssetStore, type Backlink, type DocSessionOptions, type Clock, type ExportOutcome, type ExportPalette, type GraphData, type GraphOptions, type LinkTarget, type Page, type PageKind, type PageStyle, type RecentPage, type SearchHit, type PageNode, type Result, type SqlStore, type TrashEntry, trashWithUndo, TagService, duplicateWithUndo, moveWithUndo } from "@vnote/core";

import { DatabaseController } from "../databases/databaseController";

export type WorkspaceSnapshot = {
  tree: PageNode[];
  favorites: Page[];
  trash: TrashEntry[];
  expanded: ReadonlySet<string>;
  selectedId: string | null;
  breadcrumbs: Page[];
  /** Aviso transitorio para la persona usuaria (código; la interfaz lo traduce). */
  notice: "MOVE_TO_DESCENDANT" | null;
};

/** Lógica de interfaz de un espacio de trabajo: mantiene el estado visible y delega TODO el dominio en el núcleo. */
export class WorkspaceController {
  private pages: PagesRepo;
  private svc: PageService;
  private docs: DocStore;
  private searchIndex: SearchIndex;
  private propsHistory: PagePropsHistory;
  private links: LinkService;
  private graph: GraphService;
  /** Etiquetas del espacio (RF-5.9). */
  readonly tags: TagService;
  private listeners = new Set<() => void>();
  private snapshot: WorkspaceSnapshot = { tree: [], favorites: [], trash: [], expanded: new Set(), selectedId: null, breadcrumbs: [], notice: null };

  constructor(readonly store: SqlStore, private clock: Clock) {
    this.pages = new PagesRepo(store, clock);
    this.svc = new PageService(store, clock);
    this.docs = new DocStore(store, clock);
    this.searchIndex = new SearchIndex(store, clock);
    this.propsHistory = new PagePropsHistory(this.pages);
    this.links = new LinkService(store);
    this.graph = new GraphService(store);
    this.tags = new TagService(store, clock);
  }

  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  getSnapshot = (): WorkspaceSnapshot => this.snapshot;

  private set(patch: Partial<WorkspaceSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch };
    this.listeners.forEach((l) => l());
  }

  private refreshSeq = 0;

  /**
   * Relee el árbol, favoritos y papelera (y purga lo que ya cumplió 30 días).
   * Si varias recargas se solapan, solo se aplica el resultado de la MÁS RECIENTE: una antigua que termina tarde no pisa datos nuevos.
   */
  async refresh(): Promise<void> {
    const mine = ++this.refreshSeq;
    await this.pages.purgeExpired();
    const [tree, favorites, trash] = await Promise.all([this.pages.tree(), this.pages.favorites(), this.pages.trashList()]);
    if (mine !== this.refreshSeq) return;
    const selectedId = this.snapshot.selectedId; // se lee al final: refleja selecciones hechas mientras se recargaba
    const alive = selectedId ? await this.pages.get(selectedId) : null;
    if (mine !== this.refreshSeq) return;
    const stillThere = alive !== null && alive.ok && alive.value.deletedAt === null;
    const breadcrumbs = stillThere ? await this.pages.ancestors(selectedId!) : [];
    if (mine !== this.refreshSeq) return;
    this.set({ tree, favorites, trash, selectedId: stillThere ? selectedId : null, breadcrumbs });
  }

  select = async (id: string | null): Promise<void> => {
    this.refreshSeq++; // cualquier recarga en vuelo quedó obsoleta respecto a esta selección
    this.set({ selectedId: id, breadcrumbs: id ? await this.pages.ancestors(id) : [] });
    if (id) await this.searchIndex.recordVisit(id).catch(() => {}); // los recientes son una comodidad: nunca bloquean la navegación
  };

  /** Búsqueda de texto completo del espacio abierto (nunca cruza espacios). `withinDays` limita a lo modificado en los últimos N días. */
  async search(o: { query: string; kind?: PageKind; withinDays?: number; includeTrashed?: boolean; tagIds?: string[] }): Promise<SearchHit[]> {
    const tagIds = o.tagIds ?? [];
    if (tagIds.length === 0) return this.searchText(o);
    const allowed = new Set(await this.tags.pagesWithAll(tagIds));
    if (o.query.trim() !== "") return (await this.searchText(o)).filter((h) => allowed.has(h.pageId));
    // Sin texto, las etiquetas solas listan las páginas que las tienen (más recientes primero).
    const cutoff = o.withinDays ? this.clock.now() - o.withinDays * 86_400_000 : 0;
    const hits: SearchHit[] = [];
    for (const id of allowed) {
      const r = await this.pages.get(id);
      if (!r.ok || (o.kind && r.value.kind !== o.kind) || r.value.updatedAt < cutoff) continue;
      hits.push({ pageId: id, title: r.value.title, kind: r.value.kind, updatedAt: r.value.updatedAt, trashed: false, snippet: [] });
    }
    return hits.sort((a, b) => b.updatedAt - a.updatedAt);
  }
  private searchText(o: { query: string; kind?: PageKind; withinDays?: number; includeTrashed?: boolean }): Promise<SearchHit[]> {
    return this.searchIndex.search({
      query: o.query,
      ...(o.kind ? { kinds: [o.kind] } : {}),
      ...(o.withinDays ? { modifiedAfter: this.clock.now() - o.withinDays * 86_400_000 } : {}),
      ...(o.includeTrashed ? { includeTrashed: true } : {}),
    });
  }

  /** Una página por id, o `null` si no existe. */
  async getPage(id: string): Promise<Page | null> {
    const r = await this.pages.get(id);
    return r.ok ? r.value : null;
  }

  recent(limit = 8): Promise<RecentPage[]> {
    return this.searchIndex.recent(limit);
  }

  /** Abre una sesión de edición del documento de una página; guarda automáticamente y avisa si algo falla (RF-4). */
  openDocument(pageId: string, onError?: (message: string) => void, onStatus?: DocSessionOptions["onStatus"]): Promise<DocSession> {
    return DocSession.open(this.svc, this.docs, pageId, { ...(onError ? { onError } : {}), ...(onStatus ? { onStatus } : {}) });
  }

  /** Exporta la página (y, si se pide, sus hijas) a un documento HTML autocontenido (RF-24). Se puede cancelar y informa el avance. */
  async exportPages(pageId: string, o: { withChildren: boolean; viewId?: string; assets: AssetStore; signal?: AbortSignal; onProgress?: (done: number, total: number) => void; palette?: ExportPalette }): Promise<Result<ExportOutcome>> {
    const pages = await collectExportPages(this.store, pageId, { withChildren: o.withChildren, ...(o.viewId ? { viewId: o.viewId } : {}) });
    if (!pages.ok) return pages;
    return ok(await exportHtml({ pages: pages.value }, { assets: o.assets, databaseView: databaseViewProvider(this.store, this.clock) }, { ...(o.signal ? { signal: o.signal } : {}), ...(o.onProgress ? { onProgress: o.onProgress } : {}), ...(o.palette ? { palette: o.palette } : {}) }));
  }

  /** Las vistas que se pueden elegir al exportar una página de base de datos o tablero (vacío si es una nota). */
  async exportViews(pageId: string): Promise<{ id: string; name: string }[]> {
    const dbs = new DatabaseService(this.store, this.clock);
    const d = await dbs.findByPage(pageId);
    return d ? (await new ViewService(this.store).list(d.id)).map((v) => ({ id: v.id, name: v.name })) : [];
  }

  /** Ruta de ancestros de una página (de la raíz al padre), para mostrarla junto a un resultado de búsqueda. */
  async ancestorsOf(pageId: string): Promise<Page[]> {
    return this.pages.ancestors(pageId);
  }

  dismissNotice = (): void => this.set({ notice: null });

  toggleExpanded = (id: string): void => {
    const next = new Set(this.snapshot.expanded);
    next.has(id) ? next.delete(id) : next.add(id);
    this.set({ expanded: next });
  };

  private expand(id: string | null) {
    if (id) this.set({ expanded: new Set(this.snapshot.expanded).add(id) });
  }

  async createPage(parentId: string | null, title = "", kind?: PageKind): Promise<Result<Page>> {
    const r = await this.svc.create({ parentId, title, ...(kind ? { kind } : {}) });
    if (!r.ok) return r;
    this.expand(parentId);
    await this.refresh();
    await this.select(r.value.id);
    return r;
  }

  /** Crea una base de datos como página completa (o un tablero) y la abre. */
  async createDatabase(parentId: string | null, kind: "database" | "board" = "database"): Promise<Result<Page>> {
    const dbs = new DatabaseService(this.store, this.clock);
    let pageId: string;
    if (kind === "board") {
      const r = await new BoardService(dbs, new ViewService(this.store)).createBoard({ name: "", parentId });
      if (!r.ok) return r;
      pageId = r.value.pageId;
    } else {
      const r = await dbs.createDatabase({ name: "", parentId });
      if (!r.ok) return r;
      pageId = r.value.pageId!;
    }
    this.expand(parentId);
    await this.refresh();
    await this.select(pageId);
    return this.pages.get(pageId);
  }

  /** Antes de eliminar una página: ¿está en varias bases de datos o tableros? (RF-22). */
  async describeRemoval(pageId: string): Promise<{ needsWarning: boolean; databases: { id: string; name: string }[] }> {
    const r = await new DatabaseService(this.store, this.clock).describePageRemoval(pageId);
    return r.ok ? r.value : { needsWarning: false, databases: [] };
  }

  /** Bases de datos del espacio (para elegir cuál mostrar dentro de una nota). */
  async listDatabases(): Promise<{ id: string; name: string }[]> {
    const rows = await this.store.query<{ id: string; name: string }>(
      "SELECT d.id AS id, COALESCE((SELECT title FROM pages WHERE id = d.page_id), d.name) AS name FROM databases d LEFT JOIN pages p ON p.id = d.page_id WHERE p.deleted_at IS NULL OR d.page_id IS NULL ORDER BY d.created_at, d.id");
    return rows;
  }
  openDatabaseById(id: string) { return DatabaseController.forDatabase(this.store, this.clock, id); }

  /** Controlador de la base de datos de una página (si lo es). */
  openDatabase(pageId: string) { return DatabaseController.forPage(this.store, this.clock, pageId); }

  async movePage(id: string, newParentId: string | null, opts: { afterId?: string | null } = {}): Promise<Result<Page>> {
    const r = await this.pages.move(id, newParentId, opts);
    if (r.ok) { this.expand(newParentId); this.set({ notice: null }); await this.refresh(); }
    else if (r.error.code === "CYCLE") this.set({ notice: "MOVE_TO_DESCENDANT" });
    return r;
  }

  async renamePage(id: string, title: string) { const r = await this.svc.rename(id, title); await this.refresh(); return r; }
  async setIcon(id: string, icon: string | null) { const r = await this.pages.setIcon(id, icon); await this.refresh(); return r; }
  async setCover(id: string, cover: string | null) { const r = await this.pages.setCover(id, cover); await this.refresh(); return r; }

  /**
   * Cambia varias propiedades de la página en una sola entrada del historial (spec 005, RF-4.6): portada y crédito,
   * estilo, descripción o bloqueo. Es la vía de la cabecera, la portada y el menú de opciones.
   */
  async setPageProps(id: string, patch: Partial<PageProps>): Promise<Result<Page>> {
    return this.serialProps(async () => { const r = await this.propsHistory.set(id, patch); await this.refresh(); return r; });
  }
  /**
   * Cambia una parte del estilo sobre el estilo ACTUAL de la página (no sobre el que tenía la pantalla al dibujarse): dos cambios
   * seguidos se suman en vez de pisarse, aunque el primero aún no haya llegado a la pantalla.
   */
  async patchPageStyle(id: string, patch: StylePatch): Promise<Result<Page>> {
    return this.serialProps(async () => {
      const cur = await this.pages.get(id);
      if (!cur.ok) return cur;
      const r = await this.propsHistory.set(id, { style: applyStylePatch(cur.value.style, patch) });
      await this.refresh();
      return r;
    });
  }
  private propsQueue: Promise<unknown> = Promise.resolve();
  /** Las escrituras de propiedades de página van una tras otra: cada una parte del resultado de la anterior. */
  private serialProps<T>(run: () => Promise<T>): Promise<T> {
    const next = this.propsQueue.then(run, run);
    this.propsQueue = next.catch(() => {});
    return next;
  }
  canUndoPageProps = (id: string): boolean => this.propsHistory.canUndo(id);
  canRedoPageProps = (id: string): boolean => this.propsHistory.canRedo(id);
  /** Deshace el último cambio de propiedades; `false` si no había nada. */
  async undoPageProps(id: string): Promise<boolean> { return this.serialProps(async () => { const r = await this.propsHistory.undo(id); if (r) await this.refresh(); return r !== null; }); }
  async redoPageProps(id: string): Promise<boolean> { return this.serialProps(async () => { const r = await this.propsHistory.redo(id); if (r) await this.refresh(); return r !== null; }); }
  async resetPageStyle(id: string): Promise<Result<Page>> { return this.serialProps(async () => { const r = await this.propsHistory.resetStyle(id); await this.refresh(); return r; }); }

  /** Palabras, caracteres y tiempo de lectura de la página (RF-8.3); se calculan al pedirlas, no en cada pulsación. */
  async pageStats(id: string): Promise<PageStats | null> {
    const doc = await this.docs.load(id);
    return doc.ok ? pageStats(fromYjs(doc.value.getXmlFragment("doc"))) : null;
  }
  /** Guarda el estilo de la página como el de las páginas nuevas del espacio (RF-8.5). Las existentes no cambian. */
  async setDefaultStyle(style: PageStyle): Promise<void> { await savePageDefaultStyle(this.store, style); }
  /**
   * «Usar como predeterminado»: toma el estilo ACTUAL de la página (después de los cambios que aún estén en cola), no el de la pantalla.
   */
  async usePageStyleAsDefault(id: string): Promise<Result<PageStyle>> {
    return this.serialProps(async () => {
      const cur = await this.pages.get(id);
      if (!cur.ok) return cur;
      await savePageDefaultStyle(this.store, cur.value.style);
      return ok(cur.value.style);
    });
  }
  defaultStyle(): Promise<PageStyle> { return loadPageDefaultStyle(this.store); }

  /** Estilo de la página (spec 005): se guarda normalizado. */
  async setPageStyle(id: string, style: PageStyle) { const r = await this.pages.setStyle(id, style); await this.refresh(); return r; }

  async toggleFavorite(id: string): Promise<Result<Page>> {
    const cur = await this.pages.get(id);
    if (!cur.ok) return cur;
    const r = await this.pages.setFavorite(id, !cur.value.favorite);
    await this.refresh();
    return r;
  }

  async duplicate(id: string, opts: { withChildren: boolean }): Promise<Result<Page>> {
    const r = await this.pages.duplicate(id, opts);
    await this.refresh();
    return r;
  }

  /** Variantes con operación inversa para ofrecer «Deshacer» en la interfaz (RF-11.1). */
  async trashPageUndoable(id: string): Promise<Result<{ undo: () => Promise<void> }>> {
    const wasOpen = this.snapshot.selectedId === id;
    const r = await trashWithUndo(this.pages, id);
    await this.refresh();
    if (!r.ok) return r;
    return ok({
      undo: async () => {
        await r.value.undo();
        await this.refresh();
        // Si se eliminó la página abierta y no se abrió otra entretanto, deshacer vuelve a mostrarla.
        if (wasOpen && this.snapshot.selectedId === null) await this.select(id);
      },
    });
  }
  async duplicateUndoable(id: string, opts: { withChildren: boolean }): Promise<Result<{ undo: () => Promise<void> }>> {
    const r = await duplicateWithUndo(this.pages, id, opts);
    await this.refresh();
    return r.ok ? ok({ undo: async () => { await r.value.undo(); await this.refresh(); } }) : r;
  }
  async movePageUndoable(id: string, newParentId: string | null, opts: { afterId?: string | null } = {}): Promise<Result<{ undo: () => Promise<void> }>> {
    const r = await moveWithUndo(this.pages, id, newParentId, opts);
    if (r.ok) { this.expand(newParentId); this.set({ notice: null }); }
    else if (r.error.code === "CYCLE") this.set({ notice: "MOVE_TO_DESCENDANT" });
    await this.refresh();
    return r.ok ? ok({ undo: async () => { await r.value.undo(); await this.refresh(); } }) : r;
  }

  async trashPage(id: string): Promise<Result<void>> {
    const r = await this.pages.trash(id);
    await this.refresh();
    return r;
  }

  /** Páginas para el menú de menciones: recientes si no hay texto; si lo hay, las que lo contienen en el título o en el texto. */
  async findPages(query: string, limit = 8): Promise<{ id: string; title: string }[]> {
    const q = query.trim();
    if (q === "") return this.store.query<{ id: string; title: string }>("SELECT id, title FROM pages WHERE deleted_at IS NULL ORDER BY updated_at DESC, id LIMIT ?", [limit]);
    const like = `%${q.replace(/[\\%_]/g, "\\$&")}%`;
    const byTitle = await this.store.query<{ id: string; title: string }>("SELECT id, title FROM pages WHERE deleted_at IS NULL AND title LIKE ? ESCAPE '\\' ORDER BY updated_at DESC, id LIMIT ?", [like, limit]);
    const seen = new Set(byTitle.map((p) => p.id));
    const byText = (await this.searchIndex.search({ query: q, limit })).filter((h) => !h.trashed && !seen.has(h.pageId)).map((h) => ({ id: h.pageId, title: h.title }));
    return [...byTitle, ...byText].slice(0, limit);
  }

  private capture(): QuickCapture { return new QuickCapture(this.store, this.clock, ""); }
  /** ¿Es una nota de la Bandeja de entrada (hija directa de ella)? */
  async isInboxNote(pageId: string): Promise<boolean> {
    const r = await this.pages.get(pageId);
    if (!r.ok || r.value.parentId === null) return false;
    const inbox = (await this.store.query<{ value: string }>("SELECT value FROM meta WHERE key = 'inbox_page_id'"))[0]?.value;
    return inbox === r.value.parentId;
  }
  async moveInboxNote(pageId: string, parentId: string | null): Promise<Result<Page>> { const r = await this.capture().moveNote(pageId, parentId); await this.refresh(); return r; }
  async inboxToCard(pageId: string, boardDatabaseId: string): Promise<Result<void>> { const r = await this.capture().toCard(pageId, boardDatabaseId); await this.refresh(); return r; }

  buildGraph(opts: GraphOptions = {}): Promise<GraphData> { return this.graph.build(opts); }
  resolveLink(pageId: string): Promise<LinkTarget> { return this.links.resolve(pageId); }
  backlinks(pageId: string): Promise<Backlink[]> { return this.links.backlinks(pageId); }

  async restore(id: string): Promise<Result<Page>> {
    const r = await this.pages.restore(id);
    await this.refresh();
    return r;
  }

  async deleteForever(id: string, confirm: boolean): Promise<Result<{ removed: number }>> {
    const r = await this.svc.deletePermanently(id, { confirm });
    await this.refresh();
    return r;
  }

  async emptyTrash(confirm: boolean): Promise<Result<{ removed: number }>> {
    if (!confirm) return err(appError("NEEDS_CONFIRMATION", "Vaciar la papelera requiere confirmación explícita"));
    const r = await this.pages.emptyTrash({ confirm });
    await this.refresh();
    return r.ok ? ok(r.value) : r;
  }
}
