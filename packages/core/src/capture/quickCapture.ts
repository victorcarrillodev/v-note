import * as Y from "yjs";
import { appError, err, ok, type Result } from "../result";
import { newId } from "../ids";
import type { Clock } from "../clock";
import type { SqlStore } from "../ports/sqlStore";
import { defaultProps, type Block } from "../blocks/types";
import { toYjs } from "../blocks/toYjs";
import { BoardService } from "../databases/boardService";
import { DatabaseService } from "../databases/databaseService";
import { ViewService } from "../databases/viewService";
import { PagesRepo, type Page } from "../pages/pagesRepo";
import { PageService } from "../pages/pageService";
import { ensureInbox } from "../workspaces/inbox";
import type { Workspace, WorkspaceManager } from "../workspaces/workspaceManager";

const TITLE_MAX = 80;
const KEY = 1;

/** Captura rápida de un espacio (RF-13): borrador continuo y notas que caen en la Bandeja de entrada. */
export class QuickCapture {
  private pages: PagesRepo;
  constructor(private db: SqlStore, private clock: Clock, private inboxTitle: string) { this.pages = new PagesRepo(db, clock); }

  async getDraft(): Promise<string | null> {
    return (await this.db.query<{ text: string }>("SELECT text FROM quick_capture_draft WHERE id = ?", [KEY]))[0]?.text ?? null;
  }
  /** Guarda el borrador en cada edición; un texto vacío lo elimina. */
  async saveDraft(text: string): Promise<void> {
    if (text.trim() === "") { await this.discardDraft(); return; }
    await this.db.exec("INSERT OR REPLACE INTO quick_capture_draft(id, text, updated_at) VALUES (?, ?, ?)", [KEY, text, this.clock.now()]);
  }
  async discardDraft(): Promise<void> { await this.db.exec("DELETE FROM quick_capture_draft WHERE id = ?", [KEY]); }

  /** Crea la nota como página hija de la Bandeja (que se crea o recrea si hace falta) y limpia el borrador. */
  async confirm(text: string): Promise<Result<Page>> {
    const lines = text.split("\n").map((l) => l.replace(/\s+$/, ""));
    while (lines.length && lines[0]!.trim() === "") lines.shift();
    while (lines.length && lines.at(-1)!.trim() === "") lines.pop();
    if (lines.length === 0) return err(appError("INVALID", "La nota está vacía", { reason: "EMPTY" }));
    const inbox = await ensureInbox(this.db, this.clock, this.inboxTitle);
    if (!inbox.ok) return inbox;
    const svc = new PageService(this.db, this.clock);
    const created = await svc.create({ parentId: inbox.value.id, title: lines[0]!.trim().slice(0, TITLE_MAX) });
    if (!created.ok) return created;
    const blocks: Block[] = lines.map((l) => ({ id: newId(), type: "paragraph", props: defaultProps("paragraph"), content: l === "" ? [] : [{ type: "text", text: l, styles: {} }], children: [] }));
    const doc = new Y.Doc();
    toYjs(blocks, doc.getXmlFragment("doc"));
    const saved = await svc.saveUpdate(created.value.id, Y.encodeStateAsUpdate(doc));
    if (!saved.ok) return saved;
    await this.discardDraft();
    return this.pages.get(created.value.id);
  }

  private async inboxId(): Promise<string | null> {
    const stored = (await this.db.query<{ value: string }>("SELECT value FROM meta WHERE key = 'inbox_page_id'"))[0]?.value;
    return stored ?? null;
  }
  /** Notas de la bandeja, la más reciente primero. */
  async inboxNotes(): Promise<Page[]> {
    const id = await this.inboxId();
    if (!id) return [];
    const notes = await this.pages.children(id);
    return notes.sort((a, b) => b.createdAt - a.createdAt || (a.id < b.id ? 1 : -1));
  }
  private async assertInInbox(pageId: string): Promise<Result<Page>> {
    const page = await this.pages.get(pageId);
    if (!page.ok) return page;
    const inbox = await this.inboxId();
    if (!inbox || page.value.parentId !== inbox) return err(appError("INVALID", "La página no es una nota de la bandeja", { reason: "NOT_IN_INBOX" }));
    return page;
  }

  /** Mueve una nota de la bandeja a otra página (o a la raíz con `null`). */
  async moveNote(pageId: string, parentId: string | null): Promise<Result<Page>> {
    const note = await this.assertInInbox(pageId);
    if (!note.ok) return note;
    return this.pages.move(pageId, parentId);
  }
  /** Convierte una nota en tarjeta de un tablero (por defecto en su primera columna). */
  async toCard(pageId: string, boardDatabaseId: string, columnId?: string): Promise<Result<void>> {
    const note = await this.assertInInbox(pageId);
    if (!note.ok) return note;
    const dbs = new DatabaseService(this.db, this.clock);
    const boards = new BoardService(dbs, new ViewService(this.db));
    const data = await boards.read(boardDatabaseId);
    if (!data.ok) return data;
    const column = columnId ?? data.value.columns[0]?.id;
    if (!column) return err(appError("INVALID", "El tablero no tiene columnas", { reason: "NO_COLUMNS" }));
    const added = await dbs.addExistingPage(boardDatabaseId, pageId);
    if (!added.ok) return added;
    const moved = await boards.moveCard(boardDatabaseId, pageId, column);
    if (!moved.ok) return moved;
    // La tarjeta sale de la bandeja pero sigue siendo la misma página: se mueve a la raíz del árbol.
    const out = await this.pages.move(pageId, null);
    return out.ok ? ok(undefined) : out;
  }
}

export type CaptureTarget =
  | { status: "empty" }
  | { status: "ready"; workspace: Workspace }
  | { status: "choose"; workspaces: Workspace[] };

/** Espacio al que va la captura: el predeterminado; si fue eliminado y quedan otros, hay que elegir uno (CL-30). */
export async function resolveCaptureTarget(manager: WorkspaceManager): Promise<CaptureTarget> {
  const list = await manager.list();
  if (!list.ok || list.value.length === 0) return { status: "empty" };
  const def = list.value.find((w) => w.isCaptureDefault);
  return def ? { status: "ready", workspace: def } : { status: "choose", workspaces: list.value };
}
