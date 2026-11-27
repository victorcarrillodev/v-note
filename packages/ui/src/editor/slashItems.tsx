import { filterSuggestionItems, insertOrUpdateBlockForSlashMenu, type BlockNoteEditor } from "@blocknote/core";
import { getDefaultReactSlashMenuItems, type DefaultReactSuggestionItem } from "@blocknote/react";
import { DIAGRAM_TEMPLATES, diagramTemplate, serializeDiagram, serializeMatrix, template2x2 } from "@vnote/core";
import type { ReactElement } from "react";
import { Icon } from "../design/Icon";
import type { IconName } from "../design/iconMap";

import { GENERATE_CARDS_EVENT } from "../study/generateCards";
import { TEMPLATE_IDS, templateBlocks, type TemplateId } from "../study/templates";

type T = (key: string) => string;
type Item = DefaultReactSuggestionItem & { badge?: string };

const ico = (name: IconName): ReactElement => <Icon name={name} size={20} />;

/** Elementos propios (más allá de los de BlockNote): todos con grupo, ícono, nombre y descripción. */
function customItems(editor: BlockNoteEditor<any, any, any>, t: T): Item[] {
  const group = t("editor.customGroup");
  const at = (type: string, props?: Record<string, unknown>) => () => insertOrUpdateBlockForSlashMenu(editor as never, { type, ...(props ? { props } : {}) } as never);
  const mk = (title: string, subtext: string, aliases: string[], icon: IconName, onItemClick: () => void): Item => ({ title, subtext, aliases, group, icon: ico(icon), onItemClick });
  const template = (id: TemplateId): Item => ({
    title: t(`study.templates.${id}.title`), subtext: t(`study.templates.${id}.hint`), aliases: ["plantilla", "template"], group: t("study.templates.group"), icon: ico("note"),
    onItemClick: () => {
      const [first, ...rest] = templateBlocks(id, t) as never[];
      const inserted = insertOrUpdateBlockForSlashMenu(editor as never, first!);
      editor.insertBlocks(rest as never, inserted as never, "after");
    },
  });
  return [
    mk(t("study.equation.slash"), t("study.equation.hint"), ["ecuacion", "ecuación", "formula", "fórmula", "latex", "katex", "math"], "equation", at("equation")),
    mk(t("study.math.slash"), t("study.math.hint"), ["ecuacion en linea", "ecuación en línea", "inline", "formula en linea", "latex", "$"], "equation", () => (editor as BlockNoteEditor<any, any, any>).insertInlineContent([{ type: "math", props: { formula: "" } }, " "] as never)),
    mk(t("study.cards.slash"), t("study.cards.hint"), ["generar tarjetas", "tarjetas", "flashcards", "anki", "repaso"], "flashcard", () => { window.dispatchEvent(new Event(GENERATE_CARDS_EVENT)); }),
    mk(t("study.mermaid.slash"), t("study.mermaid.hint"), ["mermaid", "diagrama de texto", "secuencia", "uml"], "graph", at("mermaid")),
    mk(t("study.card.slash"), t("study.card.hint"), ["flashcard", "tarjeta", "repaso", "anki"], "flashcard", at("flashcard")),
    mk(t("editor.callout"), t("editor.calloutHint"), ["aviso", "callout", "nota"], "tip", at("callout")),
    mk(t("task.slash"), t("task.slashHint"), ["tarea", "task", "pendiente", "recordatorio", "todo"], "task", at("task")),
    mk(t("embed.slash"), t("embed.slashHint"), ["base", "database", "tabla", "vista", "tablero"], "database", at("databaseView")),
    mk(t("diagram.slash"), t("diagram.slashHint"), ["diagrama", "flujo", "flowchart", "diagram"], "graph", at("diagram")),
    ...DIAGRAM_TEMPLATES.map((id) => mk(t(`diagram.templates.${id}.slash`), t(`diagram.templates.${id}.hint`), ["plantilla", "template", ...(id === "flow" ? ["flujo", "flowchart"] : id === "er" ? ["er", "entidad", "relacion", "base de datos"] : ["uml", "clases", "clase"])], "graph", at("diagram", { data: serializeDiagram(diagramTemplate(id, t)) }))),
    mk(t("organizer.mindmap.slash"), t("organizer.mindmap.hint"), ["mapa", "mental", "mindmap", "ideas"], "graph", at("mindmap")),
    mk(t("organizer.orgchart.slash"), t("organizer.orgchart.hint"), ["organigrama", "orgchart", "jerarquia"], "graph", at("orgchart")),
    mk(t("organizer.timeline.slash"), t("organizer.timeline.hint"), ["linea", "tiempo", "timeline", "cronologia"], "time", at("timeline")),
    mk(t("organizer.matrix.slash"), t("organizer.matrix.hint"), ["matriz", "matrix", "2x2", "cuadrante"], "database", at("matrix", { data: serializeMatrix(template2x2()) })),
    mk(t("toc.slash"), t("toc.slashHint"), ["indice", "índice", "toc", "contenido", "tabla de contenidos"], "toc", at("toc")),
    mk(t("gallery.slash"), t("gallery.slashHint"), ["galeria", "galería", "gallery", "imagenes", "imágenes", "fotos", "carrusel", "mosaico"], "image", at("gallery")),
    mk(t("editor.linkCard"), t("editor.linkCardHint"), ["enlace", "link", "url", "tarjeta"], "link", at("linkCard")),
    ...TEMPLATE_IDS.map(template),
  ];
}

/** Menú «/»: elementos de BlockNote + propios, filtrados; sin coincidencias, un único aviso que no hace nada (RF-5.4). */
export function buildSlashItems(editor: BlockNoteEditor<any, any, any>, t: T, query: string): Item[] {
  const all = [...getDefaultReactSlashMenuItems(editor as never), ...customItems(editor, t)] as Item[];
  const found = filterSuggestionItems(all, query) as Item[];
  if (found.length > 0) return found;
  return [{ title: t("editor.noResults"), subtext: "", aliases: [], group: t("editor.noResultsGroup"), icon: ico("search"), onItemClick: () => {} }];
}
