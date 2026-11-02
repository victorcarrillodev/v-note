import type { PageKind } from "../pages/pagesRepo";
import type { SqlStore } from "../ports/sqlStore";

export type GraphNode = { id: string; title: string; kind: PageKind; trashed: boolean; degree: number };
export type GraphEdge = { from: string; to: string };
export type GraphData = { nodes: GraphNode[]; edges: GraphEdge[]; /** Hay al menos un enlace entre páginas en el espacio (sin importar los filtros). */ hasLinks: boolean };
export type GraphOptions = {
  includeTrashed?: boolean;
  hideOrphans?: boolean;
  kinds?: PageKind[];
  /** Vista local: la página y sus vecinas hasta `depth` saltos, en ambas direcciones. */
  local?: { pageId: string; depth: number };
};

/** Grafo de enlaces entre páginas (RF-7). Se calcula desde la tabla derivada `links`; los ciclos son válidos. */
export class GraphService {
  constructor(private db: SqlStore) {}

  async build(opts: GraphOptions = {}): Promise<GraphData> {
    const pages = await this.db.query<{ id: string; title: string; kind: PageKind; deleted_at: number | null }>(
      `SELECT id, title, kind, deleted_at FROM pages ${opts.includeTrashed ? "" : "WHERE deleted_at IS NULL"} ORDER BY id`,
    );
    const byId = new Map(pages.map((p) => [p.id, p]));
    const live = new Set(pages.filter((p) => p.deleted_at === null).map((p) => p.id));
    const links = (await this.db.query<{ from_page_id: string; to_page_id: string }>("SELECT from_page_id, to_page_id FROM links ORDER BY from_page_id, to_page_id"))
      .filter((l) => byId.has(l.from_page_id) && byId.has(l.to_page_id) && l.from_page_id !== l.to_page_id);
    const hasLinks = links.some((l) => live.has(l.from_page_id) && live.has(l.to_page_id));

    let keep = new Set(byId.keys());
    if (opts.local) {
      const { pageId, depth } = opts.local;
      keep = new Set(byId.has(pageId) ? [pageId] : []);
      let frontier = [...keep];
      for (let d = 0; d < Math.max(0, depth) && frontier.length; d++) {
        const next: string[] = [];
        for (const l of links) {
          for (const [x, y] of [[l.from_page_id, l.to_page_id], [l.to_page_id, l.from_page_id]] as const) {
            if (frontier.includes(x) && !keep.has(y)) { keep.add(y); next.push(y); }
          }
        }
        frontier = next;
      }
    }
    if (opts.kinds?.length) for (const id of [...keep]) if (!opts.kinds.includes(byId.get(id)!.kind) && id !== opts.local?.pageId) keep.delete(id);

    const edges = links.filter((l) => keep.has(l.from_page_id) && keep.has(l.to_page_id)).map((l) => ({ from: l.from_page_id, to: l.to_page_id }));
    const degree = new Map<string, number>();
    for (const e of edges) { degree.set(e.from, (degree.get(e.from) ?? 0) + 1); degree.set(e.to, (degree.get(e.to) ?? 0) + 1); }
    const nodes: GraphNode[] = [...keep]
      .filter((id) => !opts.hideOrphans || (degree.get(id) ?? 0) > 0 || id === opts.local?.pageId)
      .map((id) => { const p = byId.get(id)!; return { id, title: p.title, kind: p.kind, trashed: p.deleted_at !== null, degree: degree.get(id) ?? 0 }; });
    const shown = new Set(nodes.map((n) => n.id));
    return { nodes, edges: edges.filter((e) => shown.has(e.from) && shown.has(e.to)), hasLinks };
  }
}
