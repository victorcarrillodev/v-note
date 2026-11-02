import type { Property } from "./databaseService";
import type { ErrorValue } from "../formulas/engine";
import type { CellValue, DateValue, SelectOption } from "./values";

export type QueryRow = { pageId: string; title: string; position: string; values: Record<string, CellValue | ErrorValue | null> };
export type Condition = { type: "condition"; property: string; op: string; value?: unknown };
export type FilterGroup = { type: "group"; op: "and" | "or"; filters: Filter[] };
export type Filter = Condition | FilterGroup;
export type Sort = { property: string; direction: "asc" | "desc" };
export type Query = { filter?: Filter; sorts?: Sort[] };

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const isEmpty = (v: unknown) => v === null || v === undefined || v === "" || (Array.isArray(v) && v.length === 0);
const dayOf = (v: unknown): string | null => {
  if (typeof v === "string") return v.slice(0, 10);
  if (v && typeof v === "object" && typeof (v as DateValue).start === "string") return (v as DateValue).start.slice(0, 10);
  return null;
};
const TEXTUAL = new Set(["text", "url", "email", "phone", "title"]);
const DATES = new Set(["date", "created_time", "last_edited_time"]);

function valueOf(row: QueryRow, prop: Property | "title"): CellValue | null {
  if (prop === "title") return row.title;
  const v = row.values[prop.id] ?? null;
  return v !== null && typeof v === "object" && "error" in v ? null : (v as CellValue | null); // una celda con error cuenta como vacía al filtrar y ordenar
}
function resolve(props: readonly Property[], id: string): Property | "title" | null {
  return id === "title" ? "title" : (props.find((p) => p.id === id) ?? null);
}

function test(row: QueryRow, props: readonly Property[], c: Condition): boolean {
  const prop = resolve(props, c.property);
  if (!prop) return false;
  const type = prop === "title" ? "title" : prop.type;
  const v = valueOf(row, prop);
  const empty = isEmpty(v);
  if (c.op === "is_empty") return type === "checkbox" ? false : empty;
  if (c.op === "is_not_empty") return type === "checkbox" ? false : !empty;

  if (TEXTUAL.has(type)) {
    const s = typeof v === "string" ? norm(v) : "";
    const t = typeof c.value === "string" ? norm(c.value) : "";
    switch (c.op) {
      case "is": return s === t;
      case "is_not": return s !== t;
      case "contains": return s.includes(t);
      case "not_contains": return !s.includes(t);
      case "starts_with": return s.startsWith(t);
      case "ends_with": return s.endsWith(t);
      default: return false;
    }
  }
  switch (type) {
    case "number": {
      const x = typeof c.value === "number" ? c.value : Number.NaN;
      if (typeof v !== "number") return c.op === "neq";
      if (Number.isNaN(x)) return false;
      switch (c.op) {
        case "eq": return v === x;
        case "neq": return v !== x;
        case "gt": return v > x;
        case "gte": return v >= x;
        case "lt": return v < x;
        case "lte": return v <= x;
        default: return false;
      }
    }
    case "checkbox": {
      const checked = v === true;
      return c.op === "is" ? checked === (c.value === true) : false;
    }
    case "select":
    case "status":
      return c.op === "is" ? v === c.value : c.op === "is_not" ? v !== c.value : false;
    case "multi_select": {
      const list = Array.isArray(v) ? (v as string[]) : [];
      return c.op === "contains" ? list.includes(c.value as string) : c.op === "not_contains" ? !list.includes(c.value as string) : false;
    }
    case "files":
      return false;
    default:
      break;
  }
  if (DATES.has(type)) {
    const d = dayOf(v);
    if (d === null) return false;
    if (c.op === "between") {
      const [a, b] = Array.isArray(c.value) ? (c.value as string[]) : [];
      return typeof a === "string" && typeof b === "string" && d >= a.slice(0, 10) && d <= b.slice(0, 10);
    }
    const t = typeof c.value === "string" ? c.value.slice(0, 10) : null;
    if (t === null) return false;
    switch (c.op) {
      case "is": return d === t;
      case "before": return d < t;
      case "after": return d > t;
      case "on_or_before": return d <= t;
      case "on_or_after": return d >= t;
      default: return false;
    }
  }
  return false;
}

export function matches(row: QueryRow, props: readonly Property[], f: Filter): boolean {
  if (f.type === "condition") return test(row, props, f);
  return f.op === "and" ? f.filters.every((x) => matches(row, props, x)) : f.filters.some((x) => matches(row, props, x));
}

function sortKey(row: QueryRow, props: readonly Property[], id: string): string | number | null {
  const prop = resolve(props, id);
  if (!prop) return null;
  const v = valueOf(row, prop);
  if (isEmpty(v)) return null;
  const type = prop === "title" ? "title" : prop.type;
  if (TEXTUAL.has(type)) return norm(String(v));
  if (type === "number") return v as number;
  if (type === "checkbox") return v === true ? 1 : 0;
  if (DATES.has(type)) return dayOf(v) === null ? null : (typeof v === "string" ? v : (v as DateValue).start);
  if (type === "select" || type === "status") {
    const opts = (prop as Property).config.options ?? [];
    const i = opts.findIndex((o) => o.id === v);
    return i === -1 ? null : i;
  }
  if (type === "multi_select") {
    const opts = (prop as Property).config.options ?? [];
    const first = (v as string[]).map((x) => opts.findIndex((o) => o.id === x)).filter((i) => i >= 0).sort((a, b) => a - b)[0];
    return first === undefined ? null : first;
  }
  return null;
}

/** Filtra y ordena (orden estable; los vacíos van siempre al final, sea cual sea la dirección). */
export function applyQuery(rows: readonly QueryRow[], props: readonly Property[], q: Query): QueryRow[] {
  const kept = q.filter ? rows.filter((r) => matches(r, props, q.filter!)) : [...rows];
  const sorts = q.sorts ?? [];
  if (sorts.length === 0) return kept;
  const decorated = kept.map((r, i) => ({ r, i, keys: sorts.map((s) => sortKey(r, props, s.property)) }));
  decorated.sort((a, b) => {
    for (const [k, s] of sorts.entries()) {
      const x = a.keys[k]!, y = b.keys[k]!;
      if (x === y) continue;
      if (x === null) return 1;
      if (y === null) return -1;
      const cmp = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y));
      if (cmp !== 0) return s.direction === "asc" ? cmp : -cmp;
    }
    return a.i - b.i;
  });
  return decorated.map((d) => d.r);
}

export type Group = { key: string | boolean | null; label?: string; rows: QueryRow[] };

/** Agrupa filas por una propiedad. Selección y estado muestran todas sus opciones (aunque estén vacías); «sin valor» solo si hay filas sin valor. */
export function groupRows(rows: readonly QueryRow[], props: readonly Property[], propertyId: string): Group[] {
  const prop = resolve(props, propertyId);
  if (!prop || prop === "title") return [{ key: null, rows: [...rows] }];
  const get = (r: QueryRow) => valueOf(r, prop);
  const withNull = (groups: Group[], empty: QueryRow[]) => (empty.length ? [...groups, { key: null, rows: empty }] : groups);

  if (prop.type === "select" || prop.type === "status" || prop.type === "multi_select") {
    const options: SelectOption[] = prop.config.options ?? [];
    const groups: Group[] = options.map((o) => ({ key: o.id, label: o.name, rows: [] }));
    const empty: QueryRow[] = [];
    for (const r of rows) {
      const v = get(r);
      const keys = Array.isArray(v) ? (v as string[]) : typeof v === "string" ? [v] : [];
      const hit = keys.map((k) => groups.find((g) => g.key === k)).filter((g): g is Group => !!g);
      if (hit.length === 0) empty.push(r);
      for (const g of hit) g.rows.push(r);
    }
    return withNull(groups, empty);
  }
  if (prop.type === "checkbox") {
    return [{ key: true, rows: rows.filter((r) => get(r) === true) }, { key: false, rows: rows.filter((r) => get(r) !== true) }];
  }
  const map = new Map<string, QueryRow[]>();
  const empty: QueryRow[] = [];
  for (const r of rows) {
    const v = get(r);
    const key = DATES.has(prop.type) ? dayOf(v) : isEmpty(v) ? null : String(v);
    if (key === null) empty.push(r);
    else map.set(key, [...(map.get(key) ?? []), r]);
  }
  const groups = [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, rs]) => ({ key, rows: rs }));
  return withNull(groups, empty);
}
