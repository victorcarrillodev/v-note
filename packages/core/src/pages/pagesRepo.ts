import { appError, err, ok, type Result } from "../result";
import type { Clock } from "../clock";
import { newId } from "../ids";
import type { SqlStore } from "../ports/sqlStore";
import { positionBetween } from "./positions";
import { DAY_MS, TRASH_RETENTION_DAYS } from "./trash";

export type PageKind = "note" | "board" | "database";
export type Page = {
  id: string;
  parentId: string | null;
  position: string;
  title: string;
  icon: string | null;
  cover: string | null;
  kind: PageKind;
  favorite: boolean;
  /** Ancho completo de la página (RF-10.3, spec 002). Ausente = ancho normal. */
  fullWidth?: boolean;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
  deletedRootId: string | null;
};
export type TrashEntry = { page: Page; daysLeft: number };
export type PageNode = { page: Page; children: PageNode[] };

type Row = {
  id: string; parent_id: string | null; position: string; title: string; icon: string | null; cover: string | null;
  kind: PageKind; favorite: number; full_width?: number; created_at: number; updated_at: number; deleted_at: number | null; deleted_root_id: string | null;
};
const toPage = (r: Row): Page => ({
  id: r.id, parentId: r.parent_id, position: r.position, title: r.title, icon: r.icon, cover: r.cover, kind: r.kind,
  favorite: r.favorite === 1, fullWidth: r.full_width === 1, createdAt: r.created_at, updatedAt: r.updated_at, deletedAt: r.deleted_at, deletedRootId: r.deleted_root_id,
});

/** CL-2: un título vacío o de solo espacios se muestra como "Sin título" (el texto lo pone la interfaz con i18n). */
export const isUntitled = (title: string): boolean => title.trim() === "";

export class PagesRepo {
  constructor(private db: SqlStore, private clock: Clock) {}

  async get(id: string): Promise<Result<Page>> {
    const rows = await this.db.query<Row>("SELECT * FROM pages WHERE id = ?", [id]);
    return rows[0] ? ok(toPage(rows[0])) : err(appError("NOT_FOUND", "La página no existe", { id }));
  }

  async create(input: { parentId?: string | null; title?: string; kind?: PageKind }): Promise<Result<Page>> {
    const parentId = input.parentId ?? null;
    if (parentId !== null) {
      const parent = await this.get(parentId);
      if (!parent.ok) return parent;
    }
    const id = newId();
    const now = this.clock.now();
    await this.db.transaction(async (tx) => {
      const last = await tx.query<{ position: string }>(
        "SELECT position FROM pages WHERE parent_id IS ? AND deleted_at IS NULL ORDER BY position DESC LIMIT 1",
        [parentId],
      );
      const position = positionBetween(last[0]?.position ?? null, null);
      await tx.exec(
        "INSERT INTO pages(id, parent_id, position, title, kind, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [id, parentId, position, input.title ?? "", input.kind ?? "note", now, now],
      );
    });
    return this.get(id);
  }

  async rename(id: string, title: string): Promise<Result<Page>> {
    const found = await this.get(id);
    if (!found.ok) return found;
    await this.db.exec("UPDATE pages SET title = ?, updated_at = ? WHERE id = ?", [title, this.clock.now(), id]);
    return this.get(id);
  }

  /** Hijas directas no eliminadas, en orden. `null` = raíz. */
  async children(parentId: string | null): Promise<Page[]> {
    const rows = await this.db.query<Row>("SELECT * FROM pages WHERE parent_id IS ? AND deleted_at IS NULL ORDER BY position", [parentId]);
    return rows.map(toPage);
  }

  /** Árbol completo (páginas no eliminadas). Se arma en memoria con una sola consulta; iterativo para soportar mucha profundidad. */
  async tree(): Promise<PageNode[]> {
    const rows = await this.db.query<Row>("SELECT * FROM pages WHERE deleted_at IS NULL ORDER BY position");
    const nodes = new Map<string, PageNode>(rows.map((r) => [r.id, { page: toPage(r), children: [] }]));
    const roots: PageNode[] = [];
    for (const r of rows) {
      const node = nodes.get(r.id)!;
      const parent = r.parent_id ? nodes.get(r.parent_id) : undefined;
      (parent ? parent.children : roots).push(node);
    }
    return roots;
  }

  /** Ruta de ancestros de la raíz al padre directo (sin incluir la propia página). */
  async ancestors(id: string): Promise<Page[]> {
    const rows = await this.db.query<Row>(
      `WITH RECURSIVE up(id, parent_id, depth) AS (
         SELECT id, parent_id, 0 FROM pages WHERE id = ?
         UNION ALL
         SELECT p.id, p.parent_id, up.depth + 1 FROM pages p JOIN up ON p.id = up.parent_id
       )
       SELECT pages.* FROM up JOIN pages ON pages.id = up.id WHERE up.depth > 0 ORDER BY up.depth DESC`,
      [id],
    );
    return rows.map(toPage);
  }

  /** ¿`candidate` es la propia página o uno de sus descendientes? (consulta recursiva, plan 5.1) */
  private async isSelfOrDescendant(id: string, candidate: string): Promise<boolean> {
    const rows = await this.db.query<{ n: number }>(
      `WITH RECURSIVE down(id) AS (
         SELECT ?
         UNION ALL
         SELECT p.id FROM pages p JOIN down ON p.parent_id = down.id
       )
       SELECT count(*) AS n FROM down WHERE id = ?`,
      [id, candidate],
    );
    return (rows[0]?.n ?? 0) > 0;
  }

  /**
   * Mueve una página (con sus descendientes) a otro padre. `afterId`: undefined = al final, null = al inicio,
   * id = justo después de esa hermana.
   */
  async move(id: string, newParentId: string | null, opts: { afterId?: string | null } = {}): Promise<Result<Page>> {
    const page = await this.get(id);
    if (!page.ok) return page;
    if (newParentId !== null) {
      const parent = await this.get(newParentId);
      if (!parent.ok) return parent;
      if (await this.isSelfOrDescendant(id, newParentId)) {
        return err(appError("CYCLE", "No se puede mover una página dentro de sí misma ni de sus descendientes", { id, newParentId }));
      }
    }
    await this.db.transaction(async (tx) => {
      const siblings = await tx.query<{ id: string; position: string }>(
        "SELECT id, position FROM pages WHERE parent_id IS ? AND deleted_at IS NULL AND id != ? ORDER BY position",
        [newParentId, id],
      );
      let before: string | null;
      let after: string | null;
      if (opts.afterId === undefined) {
        before = siblings.at(-1)?.position ?? null;
        after = null;
      } else if (opts.afterId === null) {
        before = null;
        after = siblings[0]?.position ?? null;
      } else {
        const i = siblings.findIndex((s) => s.id === opts.afterId);
        before = i === -1 ? (siblings.at(-1)?.position ?? null) : siblings[i]!.position;
        after = i === -1 ? null : (siblings[i + 1]?.position ?? null);
      }
      await tx.exec("UPDATE pages SET parent_id = ?, position = ?, updated_at = ? WHERE id = ?", [
        newParentId, positionBetween(before, after), this.clock.now(), id,
      ]);
    });
    return this.get(id);
  }

  async setFavorite(id: string, favorite: boolean): Promise<Result<Page>> {
    return this.setField(id, "favorite", favorite ? 1 : 0);
  }
  /** Ancho completo de la página: se guarda con ella, atómicamente, y viaja en su respaldo. */
  async setFullWidth(id: string, value: boolean): Promise<Result<Page>> {
    return this.setField(id, "full_width", value ? 1 : 0);
  }
  async setIcon(id: string, icon: string | null): Promise<Result<Page>> {
    return this.setField(id, "icon", icon);
  }
  async setCover(id: string, cover: string | null): Promise<Result<Page>> {
    return this.setField(id, "cover", cover);
  }
  private async setField(id: string, column: "favorite" | "icon" | "cover" | "full_width", value: string | number | null): Promise<Result<Page>> {
    const found = await this.get(id);
    if (!found.ok) return found;
    await this.db.exec(`UPDATE pages SET ${column} = ?, updated_at = ? WHERE id = ?`, [value, this.clock.now(), id]);
    return this.get(id);
  }

  async favorites(): Promise<Page[]> {
    const rows = await this.db.query<Row>("SELECT * FROM pages WHERE favorite = 1 AND deleted_at IS NULL ORDER BY created_at, position");
    return rows.map(toPage);
  }

  /** Duplica una página (y, si se pide, todo su subárbol) con ids nuevos, colocándola justo después de la original. */
  async duplicate(id: string, opts: { withChildren: boolean }): Promise<Result<Page>> {
    const source = await this.get(id);
    if (!source.ok) return source;
    const now = this.clock.now();
    const newRootId = newId();
    await this.db.transaction(async (tx) => {
      const siblings = await tx.query<{ id: string; position: string }>(
        "SELECT id, position FROM pages WHERE parent_id IS ? AND deleted_at IS NULL ORDER BY position",
        [source.value.parentId],
      );
      const i = siblings.findIndex((s) => s.id === id);
      const position = positionBetween(siblings[i]?.position ?? null, siblings[i + 1]?.position ?? null);
      const copy = async (from: Page, parentId: string | null, pos: string, copyId: string) => {
        await tx.exec(
          "INSERT INTO pages(id, parent_id, position, title, icon, cover, kind, favorite, full_width, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)",
          [copyId, parentId, pos, from.title, from.icon, from.cover, from.kind, from.fullWidth ? 1 : 0, now, now],
        );
        if (!opts.withChildren) return;
        const kids = await tx.query<Row>("SELECT * FROM pages WHERE parent_id = ? AND deleted_at IS NULL ORDER BY position", [from.id]);
        for (const k of kids) await copy(toPage(k), copyId, k.position, newId());
      };
      await copy(source.value, source.value.parentId, position, newRootId);
    });
    return this.get(newRootId);
  }

  /** Envía la página y todos sus descendientes vivos a la papelera (sin borrar filas). */
  async trash(id: string): Promise<Result<void>> {
    const page = await this.get(id);
    if (!page.ok) return page;
    if (page.value.deletedAt !== null) return ok(undefined);
    const now = this.clock.now();
    await this.db.exec(
      `WITH RECURSIVE down(id) AS (
         SELECT ?
         UNION ALL
         SELECT p.id FROM pages p JOIN down ON p.parent_id = down.id WHERE p.deleted_at IS NULL
       )
       UPDATE pages SET deleted_at = ?, deleted_root_id = ? WHERE id IN (SELECT id FROM down) AND deleted_at IS NULL`,
      [id, now, id],
    );
    return ok(undefined);
  }

  /** Raíces de la papelera con los días que les quedan antes de la purga automática (mínimo 0). */
  async trashList(): Promise<TrashEntry[]> {
    const rows = await this.db.query<Row>("SELECT * FROM pages WHERE deleted_at IS NOT NULL AND deleted_root_id = id ORDER BY deleted_at DESC");
    const now = this.clock.now();
    return rows.map((r) => ({
      page: toPage(r),
      daysLeft: Math.max(0, Math.ceil((r.deleted_at! + TRASH_RETENTION_DAYS * DAY_MS - now) / DAY_MS)),
    }));
  }

  /** Restaura la raíz de la papelera y su subárbol; a su padre original o a la raíz si ya no existe. */
  async restore(id: string): Promise<Result<Page>> {
    const rows = await this.db.query<Row>("SELECT * FROM pages WHERE id = ? AND deleted_at IS NOT NULL AND deleted_root_id = id", [id]);
    const root = rows[0];
    if (!root) return err(appError("NOT_FOUND", "El elemento no está en la papelera", { id }));
    await this.db.transaction(async (tx) => {
      let parentId = root.parent_id;
      if (parentId !== null) {
        const parent = await tx.query<{ deleted_at: number | null }>("SELECT deleted_at FROM pages WHERE id = ?", [parentId]);
        if (!parent[0] || parent[0].deleted_at !== null) parentId = null;
      }
      let position = root.position;
      if (parentId !== root.parent_id) {
        const last = await tx.query<{ position: string }>(
          "SELECT position FROM pages WHERE parent_id IS ? AND deleted_at IS NULL ORDER BY position DESC LIMIT 1",
          [parentId],
        );
        position = positionBetween(last[0]?.position ?? null, null);
      }
      await tx.exec("UPDATE pages SET parent_id = ?, position = ?, updated_at = ? WHERE id = ?", [parentId, position, this.clock.now(), id]);
      await tx.exec("UPDATE pages SET deleted_at = NULL, deleted_root_id = NULL WHERE deleted_root_id = ?", [id]);
    });
    return this.get(id);
  }

  /** Borrado definitivo de una raíz de la papelera y su subárbol. Exige confirmación explícita (constitución, art. 5). */
  async deletePermanently(id: string, opts: { confirm: boolean }): Promise<Result<{ removed: number }>> {
    const rows = await this.db.query<Row>("SELECT id FROM pages WHERE id = ? AND deleted_at IS NOT NULL AND deleted_root_id = id", [id]);
    if (!rows[0]) return err(appError("NOT_FOUND", "El elemento no está en la papelera", { id }));
    if (!opts.confirm) return err(appError("NEEDS_CONFIRMATION", "El borrado definitivo requiere confirmación explícita", { id }));
    const before = await this.countAll();
    await this.db.exec("DELETE FROM pages WHERE deleted_root_id = ?", [id]);
    return ok({ removed: before - (await this.countAll()) });
  }

  async emptyTrash(opts: { confirm: boolean }): Promise<Result<{ removed: number }>> {
    if (!opts.confirm) return err(appError("NEEDS_CONFIRMATION", "Vaciar la papelera requiere confirmación explícita"));
    const roots = await this.db.query<{ n: number }>("SELECT count(*) AS n FROM pages WHERE deleted_at IS NOT NULL AND deleted_root_id = id");
    await this.db.exec("DELETE FROM pages WHERE deleted_at IS NOT NULL");
    return ok({ removed: roots[0]?.n ?? 0 });
  }

  /** Borra definitivamente las raíces con 30 días o más en la papelera. Devuelve cuántas raíces se purgaron. */
  async purgeExpired(): Promise<{ removed: number }> {
    const limit = this.clock.now() - TRASH_RETENTION_DAYS * DAY_MS;
    const roots = await this.db.query<{ id: string }>("SELECT id FROM pages WHERE deleted_at IS NOT NULL AND deleted_root_id = id AND deleted_at <= ?", [limit]);
    for (const r of roots) await this.db.exec("DELETE FROM pages WHERE deleted_root_id = ?", [r.id]);
    return { removed: roots.length };
  }

  private async countAll(): Promise<number> {
    return (await this.db.query<{ n: number }>("SELECT count(*) AS n FROM pages"))[0]?.n ?? 0;
  }
}
