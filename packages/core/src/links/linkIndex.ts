import type { Block, Inline } from "../blocks/types";
import { parseDiagram } from "../diagrams/diagram";
import type { SqlExecutor } from "../ports/sqlStore";

/** Ids de las páginas mencionadas en los bloques o enlazadas desde formas de un lienzo (sin repetir, sin la propia página), recorriendo hijos y tablas. */
export function mentionTargets(pageId: string, blocks: Block[]): string[] {
  const found = new Set<string>();
  const take = (items: Inline[]) => { for (const i of items) if (i.type === "mention" && i.pageId !== "" && i.pageId !== pageId) found.add(i.pageId); };
  const walk = (list: Block[]) => {
    for (const b of list) {
      if (b.type === "diagram" && typeof b.props.data === "string") {
        const d = parseDiagram(b.props.data);
        if (d.ok) for (const n of d.value.nodes) if (n.page && n.page !== pageId) found.add(n.page);
      }
      if (Array.isArray(b.content)) take(b.content);
      else if (b.content?.type === "table") for (const row of b.content.rows) for (const cell of row) take(cell);
      walk(b.children);
    }
  };
  walk(blocks);
  return [...found].sort();
}

/** Reemplaza los enlaces que salen de la página por los del documento (misma transacción que el guardado). */
export async function indexPageLinksIn(tx: SqlExecutor, pageId: string, blocks: Block[]): Promise<void> {
  await tx.exec("DELETE FROM links WHERE from_page_id = ?", [pageId]);
  for (const to of mentionTargets(pageId, blocks)) await tx.exec("INSERT INTO links(from_page_id, to_page_id) VALUES (?, ?)", [pageId, to]);
}
