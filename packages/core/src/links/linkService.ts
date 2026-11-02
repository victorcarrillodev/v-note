import type { SqlStore } from "../ports/sqlStore";

export type LinkState = "ok" | "trashed" | "missing";
export type LinkTarget = { state: LinkState; id: string; title: string };
export type Backlink = { id: string; title: string };

/** Consultas sobre los enlaces entre páginas (RF-6). El índice se mantiene al guardar cada página. */
export class LinkService {
  constructor(private db: SqlStore) {}

  /** Páginas no eliminadas que mencionan a `pageId`, por título. */
  async backlinks(pageId: string): Promise<Backlink[]> {
    const rows = await this.db.query<{ id: string; title: string }>(
      `SELECT p.id AS id, p.title AS title FROM links l JOIN pages p ON p.id = l.from_page_id
       WHERE l.to_page_id = ? AND p.deleted_at IS NULL ORDER BY p.title COLLATE NOCASE, p.id`,
      [pageId],
    );
    return rows;
  }

  /** Estado actual del destino de una mención y su título vigente (renombrar no rompe el enlace). */
  async resolve(pageId: string): Promise<LinkTarget> {
    const row = (await this.db.query<{ title: string; deleted_at: number | null }>("SELECT title, deleted_at FROM pages WHERE id = ?", [pageId]))[0];
    if (!row) return { state: "missing", id: pageId, title: "" };
    return { state: row.deleted_at === null ? "ok" : "trashed", id: pageId, title: row.title };
  }
}
