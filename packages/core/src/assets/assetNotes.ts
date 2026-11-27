import { appError, err, ok, type Result } from "../result";
import { newId } from "../ids";
import type { Clock } from "../clock";
import type { SqlStore } from "../ports/sqlStore";
import { isValidHash } from "./hash";

/** Zona marcada: fracciones (0 a 1) del ancho y alto, para que no dependa del tamaño en pantalla. */
export type NoteRect = { x: number; y: number; w: number; h: number };
export type AssetNote = { id: string; hash: string; page: number; rect: NoteRect; text: string; createdAt: number };
type Row = { id: string; hash: string; page: number; x: number; y: number; w: number; h: number; text: string; created_at: number };

const unit = (v: number) => Number.isFinite(v) && v >= 0 && v <= 1;
export const isNoteRect = (r: NoteRect): boolean => unit(r.x) && unit(r.y) && unit(r.w) && unit(r.h) && r.w > 0 && r.h > 0 && r.x + r.w <= 1.000001 && r.y + r.h <= 1.000001;
const invalid = (message: string) => err(appError("INVALID", message));

/** Notas sobre zonas de un PDF o una imagen. El archivo original nunca se modifica. */
export class AssetNotesService {
  constructor(private db: SqlStore, private clock: Clock) {}

  async list(hash: string): Promise<AssetNote[]> {
    const rows = await this.db.query<Row>("SELECT * FROM asset_notes WHERE hash = ? ORDER BY page, y, x, id", [hash]);
    return rows.map((r) => ({ id: r.id, hash: r.hash, page: r.page, rect: { x: r.x, y: r.y, w: r.w, h: r.h }, text: r.text, createdAt: r.created_at }));
  }
  async add(input: { hash: string; page: number; rect: NoteRect; text: string }): Promise<Result<string>> {
    const text = input.text.trim();
    if (text === "" || !isValidHash(input.hash) || !Number.isInteger(input.page) || input.page < 1 || !isNoteRect(input.rect)) return invalid("La nota no es válida");
    const id = newId();
    const { x, y, w, h } = input.rect;
    await this.db.exec("INSERT INTO asset_notes(id, hash, page, x, y, w, h, text, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", [id, input.hash, input.page, x, y, w, h, text, this.clock.now()]);
    return ok(id);
  }
  async remove(id: string): Promise<void> {
    await this.db.exec("DELETE FROM asset_notes WHERE id = ?", [id]);
  }
}
