import { draftsFromBlocks, withoutExisting, type Block, type Inline } from "@vnote/core";

/** Bloque del editor (BlockNote) en la forma mínima que entiende el núcleo. Las propiedades de contenido en línea viajan en `props`. */
export type EditorBlock = { id: string; type: string; props?: Record<string, unknown>; content?: unknown; children?: EditorBlock[] };

function inlineOf(content: unknown): Inline[] | undefined {
  if (!Array.isArray(content)) return undefined;
  const out: Inline[] = [];
  for (const c of content as Record<string, unknown>[]) {
    if (c.type === "text") out.push({ type: "text", text: String(c.text ?? ""), styles: (c.styles as Record<string, true | string>) ?? {} });
    else if (c.type === "link") out.push({ type: "link", href: String(c.href ?? ""), content: (inlineOf(c.content) ?? []).filter((i): i is Extract<Inline, { type: "text" }> => i.type === "text") });
    else if (c.type === "mention") out.push({ type: "mention", pageId: String((c.props as Record<string, unknown>)?.pageId ?? ""), title: String((c.props as Record<string, unknown>)?.title ?? "") });
    else if (c.type === "math") out.push({ type: "math", formula: String((c.props as Record<string, unknown>)?.formula ?? "") });
  }
  return out;
}

const toCore = (b: EditorBlock): Block => ({ id: b.id, type: b.type, props: b.props ?? {}, content: inlineOf(b.content), children: (b.children ?? []).map(toCore) });

const fronts = (blocks: readonly EditorBlock[]): string[] =>
  blocks.flatMap((b) => [...(b.type === "flashcard" && typeof b.props?.front === "string" ? [b.props.front] : []), ...fronts(b.children ?? [])]);

/**
 * Bloques «tarjeta» nuevos que salen de `scope` (la selección o toda la página), sin repetir preguntas
 * que ya existan en cualquier parte del documento (`document`).
 */
export function cardsToInsert(scope: readonly EditorBlock[], document: readonly EditorBlock[]): { type: "flashcard"; props: { front: string; back: string } }[] {
  const drafts = withoutExisting(draftsFromBlocks(scope.map(toCore)), fronts(document));
  return drafts.map((d) => ({ type: "flashcard" as const, props: { front: d.front, back: d.back } }));
}

/** Evento de ventana con el que el atajo, el menú «/» y la paleta piden al editor abierto que genere tarjetas. */
export const GENERATE_CARDS_EVENT = "vnote:generate-cards";
