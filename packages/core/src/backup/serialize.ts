import type { SqlStore } from "../ports/sqlStore";
import type { AssetStore } from "../assets/assetStore";
import { DocStore } from "../docs/docStore";
import { systemClock } from "../clock";
import { serializeTags } from "./tags";
import { serializeAssetNotes } from "./assetNotes";
import { loadDiagramDefaults, serializeDiagramDefaults } from "../diagrams/defaults";
import { fromYjs } from "../blocks/fromYjs";
import { stableJson } from "./stableJson";
import { buildPagePaths } from "./paths";
import { blocksToMarkdown } from "./markdown";
import { serializeDatabases, serializeReminders } from "./databases";
import { normalizeStyle, parseStyle } from "../pages/style";
import { parseCoverCredit } from "../pages/cover";
import { loadPageDefaultStyle } from "../pages/pageDefaults";

/** v2 (spec 005): estilo, descripción, bloqueo y crédito de portada por página, `page-defaults.json`, y `fullWidth` pasa al estilo. */
export const FORMAT_VERSION = 2;
/** Límite individual de GitHub para un archivo (plan P-5). */
export const MAX_ASSET_BYTES = 100 * 1024 * 1024;

export type SerializeResult = {
  files: Map<string, Uint8Array>;
  /** Adjuntos omitidos por superar el límite del repositorio (RF-16). */
  skipped: { hash: string; size: number }[];
  pageCount: number;
};

type Row = {
  id: string; parent_id: string | null; position: string; title: string; icon: string | null; cover: string | null; kind: string;
  favorite: number; style?: string | null; description?: string | null; locked?: number; cover_credit?: string | null; created_at: number; updated_at: number; deleted_at: number | null; deleted_root_id: string | null;
};

const enc = new TextEncoder();

/**
 * Convierte un espacio de trabajo en el conjunto de archivos del respaldo (formato v2, plan 6.1 y plan 005 §11).
 * Es DETERMINISTA: el mismo contenido da los mismos bytes (RNF-7). No toca la base: solo lee.
 */
export async function serializeWorkspace(
  deps: { store: SqlStore; assets: AssetStore },
  workspace: { id: string; name: string },
  opts: { maxAssetBytes?: number } = {},
): Promise<SerializeResult> {
  const { store, assets } = deps;
  const max = opts.maxAssetBytes ?? MAX_ASSET_BYTES;
  const docs = new DocStore(store, systemClock);
  const files = new Map<string, Uint8Array>();
  const put = (path: string, content: string | Uint8Array) => files.set(path, typeof content === "string" ? enc.encode(content) : content);

  const rows = await store.query<Row>("SELECT * FROM pages ORDER BY id");
  const live = rows.filter((r) => r.deleted_at === null);
  const mdPaths = buildPagePaths(live.map((r) => ({ id: r.id, title: r.title, parentId: r.parent_id, position: r.position })));

  for (const r of rows) {
    const style = normalizeStyle(parseStyle(r.style));
    const coverCredit = parseCoverCredit(r.cover_credit ?? null);
    const blocks = fromYjs((await docs.loadIn(store, r.id)).getXmlFragment("doc"));
    put(`data/${r.id}.json`, stableJson({
      id: r.id, parentId: r.parent_id, position: r.position, title: r.title, icon: r.icon, cover: r.cover, kind: r.kind,
      favorite: r.favorite === 1, createdAt: r.created_at, updatedAt: r.updated_at, deletedAt: r.deleted_at, deletedRootId: r.deleted_root_id,
      // Cada campo nuevo solo se escribe si no es el predeterminado: una página sin tocar da los mismos bytes de siempre (RNF-5).
      // `fullWidth` ya no existe: el ancho completo viaja dentro de `style.spacing.width`.
      ...(style ? { style } : {}),
      ...(r.description ? { description: r.description } : {}),
      ...(r.locked === 1 ? { locked: true } : {}),
      ...(coverCredit ? { coverCredit } : {}),
      blocks,
    }));
    if (r.deleted_at === null) put(mdPaths.get(r.id)!, blocksToMarkdown(blocks, r.description ?? null));
  }

  for (const [path, bytes] of await serializeDatabases(store)) put(path, bytes);
  const reminders = await serializeReminders(store);
  if (reminders) put("reminders.json", reminders);
  const tags = await serializeTags(store);
  if (tags) put("tags.json", tags);
  const assetNotes = await serializeAssetNotes(store);
  if (assetNotes) put("asset-notes.json", assetNotes);
  // Estilos predeterminados de diagramas del espacio (spec 003): solo si se definieron; sin ellos el respaldo es idéntico al de antes.
  const diagramDefaults = serializeDiagramDefaults(await loadDiagramDefaults(store));
  if (diagramDefaults) put("diagram-defaults.json", diagramDefaults);

  // Estilo predeterminado del espacio (spec 005, RF-8.5): solo si se definió.
  const pageDefault = normalizeStyle(await loadPageDefaultStyle(store));
  if (pageDefault) put("page-defaults.json", stableJson(pageDefault));

  put("trash.json", stableJson(rows.filter((r) => r.deleted_at !== null).map((r) => ({ id: r.id, deletedAt: r.deleted_at, deletedRootId: r.deleted_root_id }))));
  put("workspace.json", stableJson({ formatVersion: FORMAT_VERSION, id: workspace.id, name: workspace.name, pageCount: rows.length }));

  const skipped: SerializeResult["skipped"] = [];
  for (const hash of (await assets.list()).sort()) {
    const bytes = await assets.get(hash);
    if (!bytes) continue;
    if (bytes.length > max) skipped.push({ hash, size: bytes.length });
    else put(`assets/${hash}`, bytes);
  }
  return { files, skipped, pageCount: rows.length };
}
