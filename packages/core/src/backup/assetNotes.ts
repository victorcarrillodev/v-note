import { appError, err, ok, type Result } from "../result";
import type { SqlExecutor, SqlStore } from "../ports/sqlStore";
import { isNoteRect } from "../assets/assetNotes";
import { isValidHash } from "../assets/hash";
import { stableJson } from "./stableJson";

export type AssetNoteRow = { id: string; hash: string; page: number; x: number; y: number; w: number; h: number; text: string; createdAt: number };
const invalid = (message: string) => err(appError("INVALID", message));

/** `asset-notes.json`: notas sobre PDF e imágenes, en orden estable. Solo existe si hay notas. */
export async function serializeAssetNotes(store: SqlStore): Promise<Uint8Array | null> {
  const rows = await store.query<Omit<AssetNoteRow, "createdAt"> & { created_at: number }>("SELECT * FROM asset_notes ORDER BY hash, page, id");
  if (rows.length === 0) return null;
  const notes = rows.map(({ created_at, ...r }) => ({ ...r, createdAt: created_at }));
  return new TextEncoder().encode(stableJson({ notes }));
}

export function validateAssetNotes(raw: unknown): Result<AssetNoteRow[]> {
  if (raw === undefined) return ok([]);
  const list = (raw as { notes?: unknown } | null)?.notes;
  if (!Array.isArray(list)) return invalid("asset-notes.json está incompleto");
  const ids = new Set<string>();
  for (const n of list as AssetNoteRow[]) {
    if (!n || typeof n.id !== "string" || typeof n.text !== "string" || typeof n.createdAt !== "number" || !isValidHash(n.hash) || !Number.isInteger(n.page) || n.page < 1 || !isNoteRect(n) || ids.has(n.id)) return invalid("asset-notes.json tiene una nota inválida");
    ids.add(n.id);
  }
  return ok(list as AssetNoteRow[]);
}

export async function insertAssetNotes(tx: SqlExecutor, notes: AssetNoteRow[]): Promise<void> {
  for (const n of notes) await tx.exec("INSERT INTO asset_notes(id, hash, page, x, y, w, h, text, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", [n.id, n.hash, n.page, n.x, n.y, n.w, n.h, n.text, n.createdAt]);
}
