import { appError, err, ok, type Result } from "../result";
import type { SqlExecutor, SqlStore } from "../ports/sqlStore";
import { isTagColor } from "../tags/tagService";
import { stableJson } from "./stableJson";

export type TagsFile = { tags: { id: string; name: string; color: string; createdAt: number }[]; assignments: { pageId: string; tagId: string }[] };
const invalid = (message: string) => err(appError("INVALID", message));

/** `tags.json`: catálogo y asignaciones, en orden estable. Solo existe si el espacio tiene etiquetas. */
export async function serializeTags(store: SqlStore): Promise<Uint8Array | null> {
  const tags = await store.query<{ id: string; name: string; color: string; created_at: number }>("SELECT * FROM tags ORDER BY lower(name), id");
  if (tags.length === 0) return null;
  const links = await store.query<{ page_id: string; tag_id: string }>("SELECT * FROM page_tags ORDER BY page_id, tag_id");
  const file: TagsFile = {
    tags: tags.map((t) => ({ id: t.id, name: t.name, color: t.color, createdAt: t.created_at })),
    assignments: links.map((l) => ({ pageId: l.page_id, tagId: l.tag_id })),
  };
  return new TextEncoder().encode(stableJson(file));
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

/** Valida `tags.json` contra las páginas del respaldo. No escribe nada. */
export function validateTags(raw: unknown, pageIds: Set<string>): Result<TagsFile | null> {
  if (raw === undefined) return ok(null);
  if (!isObj(raw) || !Array.isArray(raw.tags) || !Array.isArray(raw.assignments)) return invalid("tags.json está incompleto");
  const ids = new Set<string>();
  const names = new Set<string>();
  for (const t of raw.tags) {
    if (!isObj(t) || typeof t.id !== "string" || typeof t.name !== "string" || t.name.trim() === "" || typeof t.createdAt !== "number" || !isTagColor(t.color)) return invalid("tags.json tiene una etiqueta inválida");
    if (ids.has(t.id) || names.has(t.name.toLowerCase())) return invalid("tags.json tiene etiquetas repetidas");
    ids.add(t.id); names.add(t.name.toLowerCase());
  }
  for (const a of raw.assignments) {
    if (!isObj(a) || typeof a.pageId !== "string" || typeof a.tagId !== "string" || !pageIds.has(a.pageId) || !ids.has(a.tagId)) return invalid("tags.json tiene una asignación que apunta a algo que no existe");
  }
  return ok(raw as unknown as TagsFile);
}

export async function insertTags(tx: SqlExecutor, file: TagsFile | null): Promise<void> {
  if (!file) return;
  for (const t of file.tags) await tx.exec("INSERT INTO tags(id, name, color, created_at) VALUES (?, ?, ?, ?)", [t.id, t.name, t.color, t.createdAt]);
  for (const a of file.assignments) await tx.exec("INSERT INTO page_tags(page_id, tag_id) VALUES (?, ?)", [a.pageId, a.tagId]);
}
