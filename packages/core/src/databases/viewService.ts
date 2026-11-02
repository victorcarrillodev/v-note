import { appError, err, ok, type Result } from "../result";
import { newId } from "../ids";
import type { SqlStore } from "../ports/sqlStore";
import { positionBetween } from "../pages/positions";
import type { DatabaseService, Property } from "./databaseService";
import { applyQuery, groupRows, type Filter, type Group, type QueryRow, type Sort } from "./query";

export const VIEW_TYPES = ["table", "list", "board", "gallery", "calendar", "timeline"] as const;
export type ViewType = (typeof VIEW_TYPES)[number];
export type ViewConfig = {
  filter?: Filter;
  sorts?: Sort[];
  groupBy?: string;
  /** Orden y selección de columnas visibles (ids de propiedades; «title» es el título de la fila). */
  visibleProperties?: string[];
  /** Propiedad de fecha que usan calendario y línea de tiempo; para el tablero, la de estado. */
  dateProperty?: string;
  endDateProperty?: string;
};
export type View = { id: string; databaseId: string; name: string; type: ViewType; position: string; config: ViewConfig };
export type ViewResult = { view: View; properties: Property[]; visibleProperties: string[]; rows: QueryRow[]; groups: Group[] | null };

type Row = { id: string; database_id: string; name: string; type: ViewType; position: string; config: string };
const toView = (r: Row): View => ({ id: r.id, databaseId: r.database_id, name: r.name, type: r.type, position: r.position, config: JSON.parse(r.config) as ViewConfig });
const invalid = (message: string, reason: string) => err(appError("INVALID", message, { reason }));

function filterRefs(f: Filter): string[] {
  return f.type === "condition" ? [f.property] : f.filters.flatMap(filterRefs);
}
function pruneFilter(f: Filter, valid: Set<string>): Filter | undefined {
  if (f.type === "condition") return valid.has(f.property) ? f : undefined;
  const kept = f.filters.map((x) => pruneFilter(x, valid)).filter((x): x is Filter => x !== undefined);
  return { ...f, filters: kept };
}

/** Vistas guardadas de una base (tabla, lista, tablero, galería, calendario, línea de tiempo) y su ejecución. */
export class ViewService {
  constructor(private db: SqlStore) {}

  async list(dbId: string): Promise<View[]> {
    return (await this.db.query<Row>("SELECT * FROM views WHERE database_id = ? ORDER BY position", [dbId])).map(toView);
  }
  async get(id: string): Promise<Result<View>> {
    const r = (await this.db.query<Row>("SELECT * FROM views WHERE id = ?", [id]))[0];
    return r ? ok(toView(r)) : err(appError("NOT_FOUND", "La vista no existe", { id }));
  }

  private async validProps(dbId: string): Promise<Set<string>> {
    const props = await this.db.query<{ id: string }>("SELECT id FROM properties WHERE database_id = ?", [dbId]);
    return new Set(["title", ...props.map((p) => p.id)]);
  }
  private async checkConfig(dbId: string, c: ViewConfig): Promise<Result<void>> {
    const valid = await this.validProps(dbId);
    const refs = [...(c.filter ? filterRefs(c.filter) : []), ...(c.sorts ?? []).map((s) => s.property), ...(c.groupBy ? [c.groupBy] : []), ...(c.visibleProperties ?? []), ...(c.dateProperty ? [c.dateProperty] : []), ...(c.endDateProperty ? [c.endDateProperty] : [])];
    const bad = refs.find((r) => !valid.has(r));
    return bad ? invalid("La vista usa una propiedad que no existe en esta base", "UNKNOWN_PROPERTY") : ok(undefined);
  }

  async create(dbId: string, input: { name: string; type: ViewType; config?: ViewConfig }): Promise<Result<View>> {
    if (!VIEW_TYPES.includes(input.type)) return invalid("Tipo de vista desconocido", "TYPE");
    if ((await this.db.query("SELECT 1 FROM databases WHERE id = ?", [dbId])).length === 0) return err(appError("NOT_FOUND", "La base de datos no existe", { id: dbId }));
    const config = input.config ?? {};
    const checked = await this.checkConfig(dbId, config);
    if (!checked.ok) return checked;
    const last = (await this.list(dbId)).at(-1)?.position ?? null;
    const id = newId();
    await this.db.exec("INSERT INTO views(id, database_id, name, type, position, config) VALUES (?, ?, ?, ?, ?, ?)", [id, dbId, input.name.trim(), input.type, positionBetween(last, null), JSON.stringify(config)]);
    return this.get(id);
  }

  async update(id: string, patch: { name?: string; config?: ViewConfig }): Promise<Result<View>> {
    const v = await this.get(id);
    if (!v.ok) return v;
    if (patch.config) {
      const checked = await this.checkConfig(v.value.databaseId, patch.config);
      if (!checked.ok) return checked;
    }
    await this.db.exec("UPDATE views SET name = ?, config = ? WHERE id = ?", [patch.name !== undefined ? patch.name.trim() : v.value.name, JSON.stringify(patch.config ?? v.value.config), id]);
    return this.get(id);
  }

  async delete(id: string): Promise<Result<void>> {
    const v = await this.get(id);
    if (!v.ok) return v;
    if ((await this.list(v.value.databaseId)).length <= 1) return invalid("Una base de datos necesita al menos una vista", "LAST_VIEW");
    await this.db.exec("DELETE FROM views WHERE id = ?", [id]);
    return ok(undefined);
  }

  /** `afterId`: undefined = al final, null = al inicio, id = tras esa vista. */
  async move(id: string, afterId?: string | null): Promise<Result<View>> {
    const v = await this.get(id);
    if (!v.ok) return v;
    const others = (await this.list(v.value.databaseId)).filter((x) => x.id !== id);
    let before: string | null, after: string | null;
    if (afterId === undefined) { before = others.at(-1)?.position ?? null; after = null; }
    else if (afterId === null) { before = null; after = others[0]?.position ?? null; }
    else {
      const i = others.findIndex((x) => x.id === afterId);
      if (i === -1) return err(appError("NOT_FOUND", "La vista de referencia no existe", { id: afterId }));
      before = others[i]!.position; after = others[i + 1]?.position ?? null;
    }
    await this.db.exec("UPDATE views SET position = ? WHERE id = ?", [positionBetween(before, after), id]);
    return this.get(id);
  }

  /** Ejecuta la vista sobre los datos actuales de la base. Ignora lo que ya no existe (p. ej. una propiedad borrada). */
  async run(databases: DatabaseService, viewId: string): Promise<Result<ViewResult>> {
    const v = await this.get(viewId);
    if (!v.ok) return v;
    const properties = await databases.listProperties(v.value.databaseId);
    const valid = new Set(["title", ...properties.map((p) => p.id)]);
    const c = v.value.config;
    const filter = c.filter ? pruneFilter(c.filter, valid) : undefined;
    const sorts = (c.sorts ?? []).filter((s) => valid.has(s.property));
    const all = await databases.getRows(v.value.databaseId);
    const rows = applyQuery(all, properties, { ...(filter ? { filter } : {}), sorts });
    const groups = c.groupBy && valid.has(c.groupBy) ? groupRows(rows, properties, c.groupBy) : null;
    const visibleProperties = (c.visibleProperties ?? properties.map((p) => p.id)).filter((id) => valid.has(id));
    return ok({ view: v.value, properties, visibleProperties, rows, groups });
  }
}
