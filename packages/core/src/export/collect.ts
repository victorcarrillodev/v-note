import { appError, err, ok, type Result } from "../result";
import type { Clock } from "../clock";
import type { SqlStore } from "../ports/sqlStore";
import type { Block } from "../blocks/types";
import { fromYjs } from "../blocks/fromYjs";
import { DocStore } from "../docs/docStore";
import { PagesRepo, type Page } from "../pages/pagesRepo";
import { DatabaseService } from "../databases/databaseService";
import { ViewService } from "../databases/viewService";
import type { ExportPage } from "./exportDocument";
import type { DatabaseSnapshot } from "./html";

/**
 * Reúne las páginas a exportar (RF-24): la elegida y, si se pide, sus hijas vivas en orden de lectura.
 * Una página de base de datos o tablero se exporta como un bloque con la vista elegida (`viewId`) o, si no se indica, la primera.
 */
export async function collectExportPages(store: SqlStore, rootId: string, opts: { withChildren: boolean; viewId?: string }): Promise<Result<ExportPage[]>> {
  const clock: Clock = { now: () => Date.now() };
  const repo = new PagesRepo(store, clock);
  const docs = new DocStore(store, clock);
  const databases = new DatabaseService(store, clock);

  const root = await repo.get(rootId);
  if (!root.ok || root.value.deletedAt !== null) return err(appError("NOT_FOUND", "La página no existe o está en la papelera", { id: rootId }));

  const blocksOf = async (page: Page, viewId?: string): Promise<Block[]> => {
    if (page.kind !== "note") {
      const d = await databases.findByPage(page.id);
      if (!d) return [];
      return [{ id: `db-${page.id}`, type: "databaseView", props: { databaseId: d.id, viewId: viewId ?? "" }, content: undefined, children: [] }];
    }
    return fromYjs((await docs.loadIn(store, page.id)).getXmlFragment("doc"));
  };

  const out: ExportPage[] = [];
  // Recorrido iterativo: una página puede tener miles de niveles (T-048) y no debe agotar la pila.
  const stack: { page: Page; depth: number }[] = [{ page: root.value, depth: 0 }];
  while (stack.length > 0) {
    const { page, depth } = stack.pop()!;
    out.push({ id: page.id, title: page.title, depth, blocks: await blocksOf(page, depth === 0 ? opts.viewId : undefined) });
    if (!opts.withChildren) break;
    const kids = (await repo.children(page.id)).filter((k) => k.deletedAt === null);
    for (let i = kids.length - 1; i >= 0; i--) stack.push({ page: kids[i]!, depth: depth + 1 });
  }
  return ok(out);
}

/** Entrega, para un bloque de vista de base de datos, la vista elegida ya filtrada y ordenada (RF-24). `null` si ya no existe. */
export function databaseViewProvider(store: SqlStore, clock: Clock): (block: Block) => Promise<DatabaseSnapshot | null> {
  const databases = new DatabaseService(store, clock);
  const views = new ViewService(store);
  return async (block) => {
    const dbId = typeof block.props.databaseId === "string" ? block.props.databaseId : "";
    const info = await databases.getDatabase(dbId);
    if (!info.ok) return null;
    const wanted = typeof block.props.viewId === "string" ? block.props.viewId : "";
    const viewId = wanted !== "" ? wanted : (await views.list(dbId))[0]?.id;
    if (!viewId) return null;
    const r = await views.run(databases, viewId);
    if (!r.ok || r.value.view.databaseId !== dbId) return null;
    const visible = new Set(r.value.visibleProperties);
    return { name: info.value.name || "Base de datos", viewName: r.value.view.name, properties: r.value.properties.filter((p) => visible.has(p.id)), rows: r.value.rows };
  };
}
