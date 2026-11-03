import { filterSuggestionItems, insertOrUpdateBlockForSlashMenu, type BlockNoteEditor } from "@blocknote/core";
import { getDefaultReactSlashMenuItems, type DefaultReactSuggestionItem } from "@blocknote/react";
import { serializeMatrix, template2x2 } from "@vnote/core";
import type { ReactElement } from "react";
import { Icon } from "../design/Icon";
import type { IconName } from "../design/iconMap";

type T = (key: string) => string;
type Item = DefaultReactSuggestionItem & { badge?: string };

const ico = (name: IconName): ReactElement => <Icon name={name} size={20} />;

/** Elementos propios (más allá de los de BlockNote): todos con grupo, ícono, nombre y descripción. */
function customItems(editor: BlockNoteEditor<any, any, any>, t: T): Item[] {
  const group = t("editor.customGroup");
  const at = (type: string, props?: Record<string, unknown>) => () => insertOrUpdateBlockForSlashMenu(editor as never, { type, ...(props ? { props } : {}) } as never);
  const mk = (title: string, subtext: string, aliases: string[], icon: IconName, onItemClick: () => void): Item => ({ title, subtext, aliases, group, icon: ico(icon), onItemClick });
  return [
    mk(t("editor.callout"), t("editor.calloutHint"), ["aviso", "callout", "nota"], "tip", at("callout")),
    mk(t("task.slash"), t("task.slashHint"), ["tarea", "task", "pendiente", "recordatorio", "todo"], "task", at("task")),
    mk(t("embed.slash"), t("embed.slashHint"), ["base", "database", "tabla", "vista", "tablero"], "database", at("databaseView")),
    mk(t("diagram.slash"), t("diagram.slashHint"), ["diagrama", "flujo", "flowchart", "diagram"], "graph", at("diagram")),
    mk(t("organizer.mindmap.slash"), t("organizer.mindmap.hint"), ["mapa", "mental", "mindmap", "ideas"], "graph", at("mindmap")),
    mk(t("organizer.orgchart.slash"), t("organizer.orgchart.hint"), ["organigrama", "orgchart", "jerarquia"], "graph", at("orgchart")),
    mk(t("organizer.timeline.slash"), t("organizer.timeline.hint"), ["linea", "tiempo", "timeline", "cronologia"], "time", at("timeline")),
    mk(t("organizer.matrix.slash"), t("organizer.matrix.hint"), ["matriz", "matrix", "2x2", "cuadrante"], "database", at("matrix", { data: serializeMatrix(template2x2()) })),
    mk(t("editor.linkCard"), t("editor.linkCardHint"), ["enlace", "link", "url", "tarjeta"], "link", at("linkCard")),
  ];
}

/** Menú «/»: elementos de BlockNote + propios, filtrados; sin coincidencias, un único aviso que no hace nada (RF-5.4). */
export function buildSlashItems(editor: BlockNoteEditor<any, any, any>, t: T, query: string): Item[] {
  const all = [...getDefaultReactSlashMenuItems(editor as never), ...customItems(editor, t)] as Item[];
  const found = filterSuggestionItems(all, query) as Item[];
  if (found.length > 0) return found;
  return [{ title: t("editor.noResults"), subtext: "", aliases: [], group: t("editor.noResultsGroup"), icon: ico("search"), onItemClick: () => {} }];
}
