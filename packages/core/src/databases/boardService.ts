import { appError, err, ok, type Result } from "../result";
import { newId } from "../ids";
import type { DatabaseService, DbRow } from "./databaseService";
import { STATUS_OPTIONS, type SelectOption } from "./values";
import type { ViewService } from "./viewService";

export type BoardCard = { pageId: string; title: string; values: DbRow["values"] };
export type BoardColumn = { id: string; name: string; cards: BoardCard[] };
export type BoardData = { databaseId: string; statusPropertyId: string; viewId: string; columns: BoardColumn[] };

const invalid = (message: string, reason: string) => err(appError("INVALID", message, { reason }));

/** Tablero kanban: una base de datos con una propiedad de estado y una vista «tablero» agrupada por ella (RF-8, RF-22). */
export class BoardService {
  constructor(private databases: DatabaseService, private views: ViewService) {}

  async createBoard(input: { name: string; parentId?: string | null }): Promise<Result<{ databaseId: string; pageId: string }>> {
    const d = await this.databases.createDatabase({ name: input.name, ...(input.parentId !== undefined ? { parentId: input.parentId } : {}), pageKind: "board" });
    if (!d.ok) return d;
    const status = await this.databases.addProperty(d.value.id, { name: "Estado", type: "status", config: { options: STATUS_OPTIONS.map((o) => ({ ...o })) } });
    if (!status.ok) return status;
    const v = await this.views.create(d.value.id, { name: "Tablero", type: "board", config: { groupBy: status.value.id } });
    if (!v.ok) return v;
    await this.views.move(v.value.id, null); // al abrir un tablero se ve el tablero; la tabla queda como vista adicional
    return ok({ databaseId: d.value.id, pageId: d.value.pageId! });
  }

  private async context(dbId: string): Promise<Result<{ statusId: string; viewId: string; options: SelectOption[] }>> {
    const view = (await this.views.list(dbId)).find((v) => v.type === "board");
    if (!view?.config.groupBy) return err(appError("NOT_FOUND", "Esta base de datos no tiene una vista de tablero", { id: dbId }));
    const prop = await this.databases.getProperty(view.config.groupBy);
    if (!prop.ok) return prop;
    return ok({ statusId: prop.value.id, viewId: view.id, options: prop.value.config.options ?? [] });
  }

  async read(dbId: string): Promise<Result<BoardData>> {
    const c = await this.context(dbId);
    if (!c.ok) return c;
    const rows = await this.databases.getRows(dbId);
    const columns: BoardColumn[] = c.value.options.map((o) => ({ id: o.id, name: o.name, cards: [] }));
    for (const r of rows) {
      const v = r.values[c.value.statusId];
      const col = columns.find((x) => x.id === v) ?? columns[0];
      col?.cards.push({ pageId: r.pageId, title: r.title, values: r.values });
    }
    return ok({ databaseId: dbId, statusPropertyId: c.value.statusId, viewId: c.value.viewId, columns });
  }

  private nameError(options: SelectOption[], name: string, exceptId?: string): string | null {
    if (name.trim() === "") return "La columna necesita un nombre";
    if (options.some((o) => o.id !== exceptId && o.name.trim().toLowerCase() === name.trim().toLowerCase())) return "Ya existe una columna con ese nombre";
    return null;
  }

  async addColumn(dbId: string, name: string): Promise<Result<SelectOption>> {
    const c = await this.context(dbId);
    if (!c.ok) return c;
    const bad = this.nameError(c.value.options, name);
    if (bad) return invalid(bad, "NAME");
    const option = { id: newId(), name: name.trim() };
    const r = await this.databases.updatePropertyConfig(c.value.statusId, { options: [...c.value.options, option] });
    return r.ok ? ok(option) : r;
  }

  async renameColumn(dbId: string, columnId: string, name: string): Promise<Result<void>> {
    const c = await this.context(dbId);
    if (!c.ok) return c;
    if (!c.value.options.some((o) => o.id === columnId)) return err(appError("NOT_FOUND", "La columna no existe", { id: columnId }));
    const bad = this.nameError(c.value.options, name, columnId);
    if (bad) return invalid(bad, "NAME");
    const r = await this.databases.updatePropertyConfig(c.value.statusId, { options: c.value.options.map((o) => (o.id === columnId ? { ...o, name: name.trim() } : o)) });
    return r.ok ? ok(undefined) : r;
  }

  /** `afterId`: undefined = al final, null = al inicio, id = tras esa columna. */
  async moveColumn(dbId: string, columnId: string, afterId?: string | null): Promise<Result<void>> {
    const c = await this.context(dbId);
    if (!c.ok) return c;
    const moving = c.value.options.find((o) => o.id === columnId);
    if (!moving) return err(appError("NOT_FOUND", "La columna no existe", { id: columnId }));
    const rest = c.value.options.filter((o) => o.id !== columnId);
    let at: number;
    if (afterId === undefined) at = rest.length;
    else if (afterId === null) at = 0;
    else { const i = rest.findIndex((o) => o.id === afterId); if (i === -1) return err(appError("NOT_FOUND", "La columna de referencia no existe", { id: afterId })); at = i + 1; }
    const options = [...rest.slice(0, at), moving, ...rest.slice(at)];
    const r = await this.databases.updatePropertyConfig(c.value.statusId, { options });
    return r.ok ? ok(undefined) : r;
  }

  async describeColumnDeletion(dbId: string, columnId: string): Promise<Result<{ cardCount: number; otherColumns: SelectOption[] }>> {
    const read = await this.read(dbId);
    if (!read.ok) return read;
    const col = read.value.columns.find((x) => x.id === columnId);
    if (!col) return err(appError("NOT_FOUND", "La columna no existe", { id: columnId }));
    return ok({ cardCount: col.cards.length, otherColumns: read.value.columns.filter((x) => x.id !== columnId).map((x) => ({ id: x.id, name: x.name })) });
  }

  /** Con tarjetas hay que confirmar eligiendo a qué columna pasan (`moveTo`); la última columna no se puede borrar. */
  async deleteColumn(dbId: string, columnId: string, opts: { moveTo?: string } = {}): Promise<Result<void>> {
    const read = await this.read(dbId);
    if (!read.ok) return read;
    const col = read.value.columns.find((x) => x.id === columnId);
    if (!col) return err(appError("NOT_FOUND", "La columna no existe", { id: columnId }));
    if (read.value.columns.length <= 1) return invalid("Un tablero necesita al menos una columna", "LAST_COLUMN");
    if (col.cards.length > 0) {
      if (!opts.moveTo) return err(appError("NEEDS_CONFIRMATION", `La columna tiene ${col.cards.length} tarjeta(s): elige a qué columna pasan`, { cardCount: col.cards.length }));
      if (opts.moveTo === columnId || !read.value.columns.some((x) => x.id === opts.moveTo)) return invalid("La columna de destino no es válida", "MOVE_TO");
      for (const card of col.cards) {
        const set = await this.databases.setCell(dbId, card.pageId, read.value.statusPropertyId, opts.moveTo);
        if (!set.ok) return set;
        await this.databases.placeRow(dbId, card.pageId); // al final de la columna de destino
      }
    }
    const options = read.value.columns.filter((x) => x.id !== columnId).map((x) => ({ id: x.id, name: x.name }));
    const r = await this.databases.updatePropertyConfig(read.value.statusPropertyId, { options });
    return r.ok ? ok(undefined) : r;
  }

  /** Una tarjeta es una página completa más su fila en la base. */
  async createCard(dbId: string, input: { title: string; columnId?: string }): Promise<Result<{ pageId: string }>> {
    const c = await this.context(dbId);
    if (!c.ok) return c;
    const columnId = input.columnId ?? c.value.options[0]?.id;
    if (!columnId || !c.value.options.some((o) => o.id === columnId)) return invalid("La columna no existe", "COLUMN");
    return this.databases.addRow(dbId, { title: input.title, values: { [c.value.statusId]: columnId } });
  }

  /** Mueve la tarjeta a una columna. `afterPageId`: undefined = al final de la columna, null = al inicio, id = tras esa tarjeta. */
  async moveCard(dbId: string, pageId: string, columnId: string, afterPageId?: string | null): Promise<Result<void>> {
    const read = await this.read(dbId);
    if (!read.ok) return read;
    const target = read.value.columns.find((x) => x.id === columnId);
    if (!target) return invalid("La columna no existe", "COLUMN");
    const all = (await this.databases.getRows(dbId)).map((r) => r.pageId).filter((id) => id !== pageId);
    if (!(await this.databases.getRows(dbId)).some((r) => r.pageId === pageId)) return err(appError("NOT_FOUND", "La tarjeta no existe en este tablero", { id: pageId }));
    const inColumn = target.cards.map((x) => x.pageId).filter((id) => id !== pageId);
    let after: string | null | undefined;
    if (afterPageId === undefined) after = inColumn.length ? inColumn.at(-1)! : undefined;
    else if (afterPageId === null) { const first = inColumn[0]; after = first === undefined ? undefined : (all.indexOf(first) > 0 ? all[all.indexOf(first) - 1]! : null); }
    else after = afterPageId;
    const set = await this.databases.setCell(dbId, pageId, read.value.statusPropertyId, columnId);
    if (!set.ok) return set;
    return this.databases.placeRow(dbId, pageId, after);
  }
}
