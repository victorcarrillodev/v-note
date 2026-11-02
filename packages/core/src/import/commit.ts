import * as Y from "yjs";
import { appError, err, ok, type Result } from "../result";
import { newId } from "../ids";
import type { AssetStore } from "../assets/assetStore";
import type { Clock } from "../clock";
import { toYjs } from "../blocks/toYjs";
import { blocksToPlainText } from "../search/plainText";
import { SearchIndex } from "../search/searchIndex";
import { indexPageLinksIn } from "../links/linkIndex";
import { positionBetween } from "../pages/positions";
import { DatabaseService } from "../databases/databaseService";
import { validateValue, type PropertyType } from "../databases/values";
import type { SqlExecutor, SqlStore } from "../ports/sqlStore";
import type { Block } from "../blocks/types";
import type { ImportPlan, ImportReport, PlanDatabase, PlanPage } from "./types";

export type CommitDeps = {
  store: SqlStore; assets: AssetStore; clock: Clock;
  /** Página bajo la que se crea el contenedor (null = raíz). */
  parentId?: string | null;
  signal?: AbortSignal;
  onProgress?: (done: number, total: number) => void;
};

class Cancelled extends Error {}
/** Presenta una transacción abierta como un almacén (las llamadas a `transaction` se aplanan), para reutilizar los servicios sin romper la atomicidad. */
class FlatStore implements SqlStore {
  constructor(private tx: SqlExecutor) {}
  exec(sql: string, params?: readonly (string | number | bigint | null | Uint8Array)[]) { return this.tx.exec(sql, params); }
  query<T extends Record<string, unknown> = Record<string, unknown>>(sql: string, params?: readonly (string | number | bigint | null | Uint8Array)[]) { return this.tx.query<T>(sql, params); }
  transaction<T>(fn: (tx: SqlExecutor) => Promise<T>): Promise<T> { return fn(this.tx); }
  async close() {}
}

/**
 * Escribe un plan en el espacio dentro de UNA transacción: si algo falla o se cancela, no queda nada a medias (RNF-12).
 * Los adjuntos nuevos se borran si la transacción se revierte. Nunca modifica páginas existentes (CL-28).
 */
export async function commitImport(plan: ImportPlan, deps: CommitDeps): Promise<Result<{ containerId: string }>> {
  const { store, assets, clock, signal } = deps;
  const added: string[] = [];
  try {
    for (const [hash, bytes] of plan.assets) {
      if (await assets.has(hash)) continue;
      await assets.put(bytes);
      added.push(hash);
    }
    await store.transaction(async (tx) => {
      const flat = new FlatStore(tx);
      const now = clock.now();
      const index = new SearchIndex(flat, clock);
      const dbs = new DatabaseService(flat, clock);
      let done = 0;
      const tick = () => { done++; deps.onProgress?.(done, plan.pageCount); if (signal?.aborted) throw new Cancelled(); };

      const lastPosition = async (parentId: string | null) =>
        (await tx.query<{ position: string }>("SELECT position FROM pages WHERE parent_id IS ? ORDER BY position DESC LIMIT 1", [parentId]))[0]?.position ?? null;
      const insertPage = async (p: { id: string; title: string; blocks: Block[] }, parentId: string | null, position: string, kind: "note" | "database") => {
        await tx.exec("INSERT INTO pages(id, parent_id, position, title, kind, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)", [p.id, parentId, position, p.title, kind, now, now]);
        if (p.blocks.length) {
          const doc = new Y.Doc();
          toYjs(p.blocks, doc.getXmlFragment("doc"));
          await tx.exec("INSERT INTO page_docs(page_id, seq, kind, data, created_at) VALUES (?, 0, 'snapshot', ?, ?)", [p.id, Y.encodeStateAsUpdate(doc), now]);
        }
        await index.upsertIn(tx, p.id, p.title, blocksToPlainText(p.blocks));
        await indexPageLinksIn(tx, p.id, p.blocks);
        tick();
      };

      const insertDatabase = async (p: PlanPage, database: PlanDatabase, parentId: string, position: string) => {
        await insertPage(p, parentId, position, "database");
        const dbId = newId();
        await tx.exec("INSERT INTO databases(id, name, page_id, host_page_id, created_at, updated_at) VALUES (?, ?, ?, NULL, ?, ?)", [dbId, p.title, p.id, now, now]);
        await tx.exec("INSERT INTO views(id, database_id, name, type, position, config) VALUES (?, ?, 'Tabla', 'table', ?, '{}')", [newId(), dbId, positionBetween(null, null)]);
        const props = [];
        for (const c of database.columns) {
          const r = await dbs.addProperty(dbId, { name: c.name, type: c.type as PropertyType });
          if (!r.ok) throw new Error(r.error.message);
          props.push(r.value);
        }
        let last: string | null = null;
        for (const row of database.rows) {
          const pos = positionBetween(last, null); last = pos;
          const pageId = row.pageId ?? newId();
          await insertPage({ id: pageId, title: row.title, blocks: row.blocks }, p.id, pos, "note");
          await tx.exec("INSERT INTO db_rows(database_id, page_id, position, created_at, updated_at) VALUES (?, ?, ?, ?, ?)", [dbId, pageId, pos, now, now]);
          for (const [i, col] of database.columns.entries()) {
            const raw = (row.values[col.name] ?? "").trim();
            if (raw === "") continue;
            const converted = col.type === "number" ? Number(raw) : col.type === "checkbox" ? /^(yes|true|sí|si)$/i.test(raw) : raw;
            const prop = props[i]!;
            const v = validateValue(prop.type, prop.config, converted);
            if (v.ok && v.value !== null) await tx.exec("INSERT INTO cell_values(database_id, page_id, property_id, value) VALUES (?, ?, ?, ?)", [dbId, pageId, prop.id, JSON.stringify(v.value)]);
          }
        }
      };

      const writeChildren = async (children: PlanPage[], parentId: string) => {
        let last: string | null = null;
        for (const c of children) {
          const pos = positionBetween(last, null); last = pos;
          if (c.database) await insertDatabase(c, c.database, parentId, pos);
          else await insertPage(c, parentId, pos, "note");
          await writeChildren(c.children, c.id);
        }
      };

      const parentId = deps.parentId ?? null;
      await insertPage(plan.root, parentId, positionBetween(await lastPosition(parentId), null), "note");
      await writeChildren(plan.root.children, plan.root.id);
      await saveReport(tx, plan.root.id, plan.report, now);
    });
    return ok({ containerId: plan.root.id });
  } catch (e) {
    for (const h of added) { try { await assets.delete(h); } catch { /* ya no está */ } }
    if (e instanceof Cancelled) return err(appError("CANCELLED", "La importación se canceló y no se guardó nada"));
    return err(appError("STORAGE", "No se pudo importar; no se guardó nada", { cause: e instanceof Error ? e.message : String(e) }));
  }
}

async function saveReport(tx: SqlExecutor, containerId: string, r: ImportReport, now: number): Promise<void> {
  await tx.exec(
    "INSERT INTO import_reports(id, container_page_id, source, created_at, imported, approximated, omitted, broken_links, details) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [newId(), containerId, r.source, now, r.imported.length, r.approximated.length, r.omitted.length, r.brokenLinks.length, JSON.stringify(r)],
  );
}

/** Informe de la importación que creó ese contenedor, o null si no hay. */
export async function getImportReport(db: SqlExecutor, containerId: string): Promise<ImportReport | null> {
  const row = (await db.query<{ details: string }>("SELECT details FROM import_reports WHERE container_page_id = ?", [containerId]))[0];
  return row ? (JSON.parse(row.details) as ImportReport) : null;
}
