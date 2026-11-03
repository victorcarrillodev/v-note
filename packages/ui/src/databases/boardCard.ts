import type { Property, QueryRow } from "@vnote/core";

/** Etiquetas visibles en una tarjeta antes de resumir el resto como «+N» (CL-9). */
export const MAX_TAGS = 3;

type Option = { id: string; name: string; color?: string };

/** Etiquetas (propiedad de selección múltiple) de una tarjeta: las primeras y cuántas quedan. */
export function cardTags(row: QueryRow, props: readonly Property[]): { shown: Option[]; more: number } {
  const prop = props.find((p) => p.type === "multi_select");
  const raw = prop ? row.values[prop.id] : null;
  if (!prop || !Array.isArray(raw)) return { shown: [], more: 0 };
  const options = (prop.config.options ?? []) as Option[];
  const all = raw.map((id) => options.find((o) => o.id === id)).filter((o): o is Option => !!o);
  return { shown: all.slice(0, MAX_TAGS), more: Math.max(0, all.length - MAX_TAGS) };
}

/** Estado de la fecha límite respecto de hoy (AAAA-MM-DD); solo cuenta el día. */
export function dueState(due: string, today: string, done: boolean): "done" | "overdue" | "today" | "future" {
  if (done) return "done";
  const day = due.slice(0, 10);
  return day < today ? "overdue" : day === today ? "today" : "future";
}
