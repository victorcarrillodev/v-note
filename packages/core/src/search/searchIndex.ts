import type { Clock } from "../clock";
import type { SqlExecutor, SqlStore } from "../ports/sqlStore";
import type { PageKind } from "../pages/pagesRepo";
import { fromYjs } from "../blocks/fromYjs";
import { blocksToPlainText } from "./plainText";
import { DocStore } from "../docs/docStore";

const MARK_OPEN = "";
const MARK_CLOSE = "";

export type SnippetPart = { text: string; match: boolean };
export type SearchHit = { pageId: string; title: string; kind: PageKind; updatedAt: number; trashed: boolean; snippet: SnippetPart[] };
export type SearchOptions = {
  query: string;
  kinds?: PageKind[];
  modifiedAfter?: number;
  modifiedBefore?: number;
  includeTrashed?: boolean;
  limit?: number;
};
export type RecentPage = { pageId: string; title: string; visitedAt: number };

/** Convierte lo que escribe la persona en una consulta FTS5 segura: cada palabra por prefijo y todas obligatorias. */
export function toFtsQuery(input: string): string | null {
  const tokens = input.match(/[\p{L}\p{N}]+/gu) ?? [];
  return tokens.length ? tokens.map((t) => `"${t}"*`).join(" ") : null;
}

function parseSnippet(raw: string): SnippetPart[] {
  const parts: SnippetPart[] = [];
  let rest = raw;
  while (rest.length) {
    const open = rest.indexOf(MARK_OPEN);
    if (open === -1) { parts.push({ text: rest, match: false }); break; }
    if (open > 0) parts.push({ text: rest.slice(0, open), match: false });
    const close = rest.indexOf(MARK_CLOSE, open);
    const end = close === -1 ? rest.length : close;
    parts.push({ text: rest.slice(open + 1, end), match: true });
    rest = close === -1 ? "" : rest.slice(close + 1);
  }
  return parts;
}

export class SearchIndex {
  constructor(private db: SqlStore, private clock: Clock) {}

  async search(opts: SearchOptions): Promise<SearchHit[]> {
    const fts = toFtsQuery(opts.query);
    if (!fts) return [];
    const where: string[] = ["page_text MATCH ?"];
    const params: (string | number)[] = [fts];
    if (!opts.includeTrashed) where.push("pages.deleted_at IS NULL");
    if (opts.kinds?.length) { where.push(`pages.kind IN (${opts.kinds.map(() => "?").join(",")})`); params.push(...opts.kinds); }
    if (opts.modifiedAfter !== undefined) { where.push("pages.updated_at >= ?"); params.push(opts.modifiedAfter); }
    if (opts.modifiedBefore !== undefined) { where.push("pages.updated_at < ?"); params.push(opts.modifiedBefore); }
    params.push(opts.limit ?? 50);
    const rows = await this.db.query<{ id: string; title: string; kind: PageKind; updated_at: number; deleted_at: number | null; snip: string }>(
      `SELECT pages.id AS id, pages.title AS title, pages.kind AS kind, pages.updated_at AS updated_at, pages.deleted_at AS deleted_at,
              snippet(page_text, 2, '${MARK_OPEN}', '${MARK_CLOSE}', '…', 12) AS snip
         FROM page_text JOIN pages ON pages.id = page_text.page_id
        WHERE ${where.join(" AND ")}
        ORDER BY rank LIMIT ?`,
      params,
    );
    return rows.map((r) => ({
      pageId: r.id, title: r.title, kind: r.kind, updatedAt: r.updated_at, trashed: r.deleted_at !== null, snippet: parseSnippet(r.snip),
    }));
  }

  /** Reemplaza la fila de índice de una página (título + texto). Usa el ejecutor dado para participar en una transacción. */
  async upsertIn(ex: SqlExecutor, pageId: string, title: string, body: string): Promise<void> {
    await ex.exec("DELETE FROM page_text WHERE page_id = ?", [pageId]);
    await ex.exec("INSERT INTO page_text(page_id, title, body) VALUES (?, ?, ?)", [pageId, title, body]);
  }

  /** Elimina del índice las filas de páginas que ya no existen (tras un borrado definitivo). */
  async cleanOrphans(): Promise<void> {
    await this.db.exec("DELETE FROM page_text WHERE page_id NOT IN (SELECT id FROM pages)");
  }

  /** Reconstruye todo el índice desde los documentos (reparación). */
  async rebuildAll(): Promise<void> {
    const docs = new DocStore(this.db, this.clock);
    await this.db.transaction(async (tx) => {
      await tx.exec("DELETE FROM page_text");
      const pages = await tx.query<{ id: string; title: string }>("SELECT id, title FROM pages");
      for (const p of pages) {
        const doc = await docs.loadIn(tx, p.id);
        await this.upsertIn(tx, p.id, p.title, blocksToPlainText(fromYjs(doc.getXmlFragment("doc"))));
      }
    });
  }

  async recordVisit(pageId: string): Promise<void> {
    await this.db.exec("INSERT OR REPLACE INTO page_visits(page_id, visited_at) VALUES (?, ?)", [pageId, this.clock.now()]);
  }

  async recent(limit = 10): Promise<RecentPage[]> {
    const rows = await this.db.query<{ id: string; title: string; visited_at: number }>(
      `SELECT pages.id AS id, pages.title AS title, page_visits.visited_at AS visited_at
         FROM page_visits JOIN pages ON pages.id = page_visits.page_id
        WHERE pages.deleted_at IS NULL ORDER BY page_visits.visited_at DESC, pages.id LIMIT ?`,
      [limit],
    );
    return rows.map((r) => ({ pageId: r.id, title: r.title, visitedAt: r.visited_at }));
  }
}
