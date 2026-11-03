import { appError, err, ok, type Result } from "../result";
import type { Clock } from "../clock";
import type { SqlStore } from "../ports/sqlStore";
import { newId } from "../ids";

/** Los nueve nombres de color de la paleta de bloques; el tema decide el valor (RF-2.6). */
export const TAG_COLORS = ["gray", "brown", "red", "orange", "yellow", "green", "blue", "purple", "pink"] as const;
export type TagColor = (typeof TAG_COLORS)[number];
export type Tag = { id: string; name: string; color: TagColor; createdAt: number };
export type TagWithUses = Tag & { uses: number };

type Row = { id: string; name: string; color: TagColor; created_at: number };
const toTag = (r: Row): Tag => ({ id: r.id, name: r.name, color: r.color, createdAt: r.created_at });
const invalid = (message: string, reason: string) => err(appError("INVALID", message, { reason }));

/** Etiquetas del espacio: catálogo (nombre + color) y asignación a páginas (RF-5.9). */
export class TagService {
  constructor(private db: SqlStore, private clock: Clock) {}

  async list(): Promise<TagWithUses[]> {
    const rows = await this.db.query<Row & { uses: number }>(
      "SELECT t.*, (SELECT count(*) FROM page_tags pt JOIN pages p ON p.id = pt.page_id WHERE pt.tag_id = t.id AND p.deleted_at IS NULL) AS uses FROM tags t ORDER BY lower(t.name)");
    return rows.map((r) => ({ ...toTag(r), uses: r.uses }));
  }
  private async get(id: string): Promise<Tag | null> {
    const r = (await this.db.query<Row>("SELECT * FROM tags WHERE id = ?", [id]))[0];
    return r ? toTag(r) : null;
  }
  private async nameTaken(name: string, exceptId?: string): Promise<boolean> {
    const rows = await this.db.query<{ id: string }>("SELECT id FROM tags WHERE lower(name) = lower(?)", [name]);
    return rows.some((r) => r.id !== exceptId);
  }

  async create(input: { name: string; color: string }): Promise<Result<Tag>> {
    const name = input.name.trim();
    if (name === "") return invalid("La etiqueta necesita un nombre", "NAME");
    if (!TAG_COLORS.includes(input.color as TagColor)) return invalid("El color no es de la paleta", "COLOR");
    if (await this.nameTaken(name)) return invalid("Ya existe una etiqueta con ese nombre", "DUPLICATE");
    const id = newId();
    await this.db.exec("INSERT INTO tags(id, name, color, created_at) VALUES (?, ?, ?, ?)", [id, name, input.color, this.clock.now()]);
    return ok((await this.get(id))!);
  }
  async rename(id: string, name: string): Promise<Result<Tag>> {
    const n = name.trim();
    if (n === "") return invalid("La etiqueta necesita un nombre", "NAME");
    if (!(await this.get(id))) return err(appError("NOT_FOUND", "La etiqueta no existe", { id }));
    if (await this.nameTaken(n, id)) return invalid("Ya existe una etiqueta con ese nombre", "DUPLICATE");
    await this.db.exec("UPDATE tags SET name = ? WHERE id = ?", [n, id]);
    return ok((await this.get(id))!);
  }
  async recolor(id: string, color: string): Promise<Result<Tag>> {
    if (!TAG_COLORS.includes(color as TagColor)) return invalid("El color no es de la paleta", "COLOR");
    if (!(await this.get(id))) return err(appError("NOT_FOUND", "La etiqueta no existe", { id }));
    await this.db.exec("UPDATE tags SET color = ? WHERE id = ?", [color, id]);
    return ok((await this.get(id))!);
  }
  /** Eliminar la etiqueta la quita de todas las páginas (las claves en cascada se encargan). */
  async remove(id: string): Promise<Result<void>> {
    if (!(await this.get(id))) return err(appError("NOT_FOUND", "La etiqueta no existe", { id }));
    await this.db.exec("DELETE FROM tags WHERE id = ?", [id]);
    return ok(undefined);
  }

  async assign(pageId: string, tagId: string): Promise<Result<void>> {
    if (!(await this.get(tagId))) return err(appError("NOT_FOUND", "La etiqueta no existe", { id: tagId }));
    if ((await this.db.query("SELECT 1 FROM pages WHERE id = ?", [pageId])).length === 0) return err(appError("NOT_FOUND", "La página no existe", { id: pageId }));
    await this.db.exec("INSERT OR IGNORE INTO page_tags(page_id, tag_id) VALUES (?, ?)", [pageId, tagId]);
    return ok(undefined);
  }
  async unassign(pageId: string, tagId: string): Promise<Result<void>> {
    await this.db.exec("DELETE FROM page_tags WHERE page_id = ? AND tag_id = ?", [pageId, tagId]);
    return ok(undefined);
  }
  async forPage(pageId: string): Promise<Tag[]> {
    const rows = await this.db.query<Row>("SELECT t.* FROM tags t JOIN page_tags pt ON pt.tag_id = t.id WHERE pt.page_id = ? ORDER BY lower(t.name)", [pageId]);
    return rows.map(toTag);
  }

  /** Páginas vivas (no en la papelera) con la etiqueta. */
  async pagesWith(tagId: string): Promise<string[]> { return this.pagesWithAll([tagId]); }
  /** Páginas vivas que tienen TODAS las etiquetas indicadas. */
  async pagesWithAll(tagIds: string[]): Promise<string[]> {
    if (tagIds.length === 0) return [];
    const marks = tagIds.map(() => "?").join(",");
    const rows = await this.db.query<{ page_id: string }>(
      `SELECT pt.page_id FROM page_tags pt JOIN pages p ON p.id = pt.page_id WHERE p.deleted_at IS NULL AND pt.tag_id IN (${marks}) GROUP BY pt.page_id HAVING count(DISTINCT pt.tag_id) = ? ORDER BY pt.page_id`,
      [...tagIds, tagIds.length]);
    return rows.map((r) => r.page_id);
  }
}
