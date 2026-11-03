import type { Condition, Filter, Property, QueryRow, ViewConfig } from "@vnote/core";

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** ¿La fila contiene la palabra clave en su título o en alguna celda de texto o lista? (sin acentos ni mayúsculas) */
export function matchesKeyword(row: QueryRow, keyword: string): boolean {
  const k = norm(keyword.trim());
  if (k === "") return true;
  if (norm(row.title).includes(k)) return true;
  for (const v of Object.values(row.values)) {
    if (typeof v === "string" && norm(v).includes(k)) return true;
    if (Array.isArray(v) && v.some((x) => typeof x === "string" && norm(x).includes(k))) return true;
  }
  return false;
}

export type Chip = { kind: "filter" | "sort" | "group"; key: string; index: number; property: string; label: string; detail: string };

const conditions = (f: Filter | undefined): Condition[] => (!f ? [] : f.type === "condition" ? [f] : f.filters.flatMap((x) => conditions(x)));
const nameOf = (props: readonly Property[], id: string) => (id === "title" ? "Título" : (props.find((p) => p.id === id)?.name ?? "—"));

/** Un chip por filtro, orden y agrupación activos de la vista; el texto lo completa la interfaz con i18n. */
export function activeChips(config: ViewConfig, props: readonly Property[]): Chip[] {
  const chips: Chip[] = [];
  conditions(config.filter).forEach((c, i) => chips.push({ kind: "filter", key: `f${i}`, index: i, property: c.property, label: nameOf(props, c.property), detail: `${c.op}${c.value === undefined ? "" : ` ${String(c.value)}`}` }));
  (config.sorts ?? []).forEach((s, i) => chips.push({ kind: "sort", key: `s${i}`, index: i, property: s.property, label: nameOf(props, s.property), detail: s.direction }));
  if (config.groupBy) chips.push({ kind: "group", key: "g", index: 0, property: config.groupBy, label: nameOf(props, config.groupBy), detail: "" });
  return chips;
}

/** Cambio de configuración que quita ese chip (para `updateViewConfig`). `undefined` borra el campo. */
export function removeChip(config: ViewConfig, chip: Chip): Partial<Record<keyof ViewConfig, unknown>> {
  if (chip.kind === "group") return { groupBy: undefined };
  if (chip.kind === "sort") { const next = (config.sorts ?? []).filter((_, i) => i !== chip.index); return { sorts: next.length ? next : undefined }; }
  const rest = conditions(config.filter).filter((_, i) => i !== chip.index);
  if (rest.length === 0) return { filter: undefined };
  if (rest.length === 1) return { filter: rest[0] };
  const op = config.filter && config.filter.type === "group" ? config.filter.op : "and";
  return { filter: { type: "group", op, filters: rest } };
}
