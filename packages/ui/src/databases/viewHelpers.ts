import type { DateValue, Property, QueryRow } from "@vnote/core";
import type { DatabaseSnapshot } from "./databaseController";

/** Propiedad de fecha que usa la vista activa (la configurada o, si no, la primera de tipo fecha). */
export function dateProperty(snap: DatabaseSnapshot): Property | undefined {
  const view = snap.views.find((v) => v.id === snap.activeViewId);
  const dates = snap.properties.filter((p) => p.type === "date");
  return dates.find((p) => p.id === view?.config.dateProperty) ?? dates[0];
}
export const dateOf = (row: QueryRow, prop: Property | undefined): DateValue | null => {
  const v = prop ? row.values[prop.id] : null;
  return v && typeof v === "object" && "start" in v ? (v as DateValue) : null;
};
export const titleOf = (row: QueryRow, untitled: string) => (row.title.trim() === "" ? untitled : row.title);
