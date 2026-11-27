import { appError, err, ok, type Result } from "../result";
import type { Clock } from "../clock";
import type { SqlStore } from "../ports/sqlStore";
import { DocStore } from "../docs/docStore";
import { fromYjs } from "../blocks/fromYjs";
import { searchBodyIn } from "../assets/assetText";
import * as Y from "yjs";
import { setBlockProps } from "../blocks/updateProps";
import { PagesRepo, type Page, type PageKind } from "./pagesRepo";
import { SearchIndex } from "../search/searchIndex";
import { indexPageTasksIn } from "../tasks/taskIndex";
import { indexPageLinksIn } from "../links/linkIndex";

/** Fachada que mantiene coherentes páginas, documentos y el índice de búsqueda (todo en la misma transacción). */
export class PageService {
  private pages: PagesRepo;
  private docs: DocStore;
  private index: SearchIndex;
  constructor(private db: SqlStore, private clock: Clock) {
    this.pages = new PagesRepo(db, clock);
    this.docs = new DocStore(db, clock);
    this.index = new SearchIndex(db, clock);
  }

  async create(input: { parentId?: string | null; title?: string; kind?: PageKind }): Promise<Result<Page>> {
    const created = await this.pages.create(input);
    if (!created.ok) return created;
    await this.db.transaction((tx) => this.index.upsertIn(tx, created.value.id, created.value.title, ""));
    return created;
  }

  /** Guarda una actualización del documento y reindexa el texto en una sola transacción. */
  async saveUpdate(pageId: string, update: Uint8Array): Promise<Result<void>> {
    try {
      return await this.db.transaction(async (tx) => {
        const saved = await this.docs.appendUpdateIn(tx, pageId, update);
        if (!saved.ok) return saved;
        const doc = await this.docs.loadIn(tx, pageId);
        const title = (await tx.query<{ title: string }>("SELECT title FROM pages WHERE id = ?", [pageId]))[0]?.title ?? "";
        const blocks = fromYjs(doc.getXmlFragment("doc"));
        await this.index.upsertIn(tx, pageId, title, await searchBodyIn(tx, blocks));
        await indexPageTasksIn(tx, this.clock.now(), pageId, blocks); // las casillas con fecha son tareas
        await indexPageLinksIn(tx, pageId, blocks); // las menciones son enlaces
        await tx.exec("UPDATE pages SET updated_at = ? WHERE id = ?", [this.clock.now(), pageId]);
        return ok(undefined);
      });
    } catch (e) {
      return err(appError("STORAGE", "No se pudo guardar la página", { cause: String(e) }));
    }
  }

  /** Cambia propiedades de un bloque del documento (por ejemplo, marcar una tarea como hecha desde un recordatorio). */
  async updateBlockProps(pageId: string, blockId: string, patch: Record<string, unknown>): Promise<Result<void>> {
    const page = await this.pages.get(pageId);
    if (!page.ok) return page;
    const doc = await this.docs.loadIn(this.db, pageId);
    let update: Uint8Array | null = null;
    doc.on("update", (u: Uint8Array) => { update = u; });
    let found = false;
    doc.transact(() => { found = setBlockProps(doc.getXmlFragment("doc"), blockId, patch); }); // una sola actualización con todos los cambios
    if (!found || !update) return err(appError("NOT_FOUND", "El bloque no existe en la página", { pageId, blockId }));
    return this.saveUpdate(pageId, update);
  }

  async rename(pageId: string, title: string): Promise<Result<Page>> {
    const found = await this.pages.get(pageId);
    if (!found.ok) return found;
    // Una página bloqueada es de solo lectura, también el título desde las vistas de base de datos (spec 005, RF-8.1.1).
    if (found.value.locked) return err(appError("LOCKED", "La página está bloqueada"));
    await this.db.transaction(async (tx) => {
      await tx.exec("UPDATE pages SET title = ?, updated_at = ? WHERE id = ?", [title, this.clock.now(), pageId]);
      const body = (await tx.query<{ body: string }>("SELECT body FROM page_text WHERE page_id = ?", [pageId]))[0]?.body ?? "";
      await this.index.upsertIn(tx, pageId, title, body);
    });
    return this.pages.get(pageId);
  }

  async deletePermanently(pageId: string, opts: { confirm: boolean }): Promise<Result<{ removed: number }>> {
    const r = await this.pages.deletePermanently(pageId, opts);
    if (r.ok) await this.index.cleanOrphans();
    return r;
  }
}
