// Modelo canónico de bloques (plan D-7): lo que el núcleo entiende de una página, sin depender del editor.
export const BLOCK_TYPES = [
  "paragraph", "heading", "bulletListItem", "numberedListItem", "checkListItem", "toggleListItem",
  "quote", "divider", "codeBlock", "image", "file", "table",
] as const;
export type BlockType = (typeof BLOCK_TYPES)[number];

export type Styles = Record<string, true | string>;
export type InlineText = { type: "text"; text: string; styles: Styles };
export type InlineLink = { type: "link"; href: string; content: InlineText[] };
/** Mención de otra página (RF-6): guarda el id de destino; el título es solo el último texto conocido. */
export type InlineMention = { type: "mention"; pageId: string; title: string };
/** Ecuación en línea (`$…$`): la fórmula en LaTeX, dibujada con KaTeX dentro del texto. */
export type InlineMath = { type: "math"; formula: string };
export type Inline = InlineText | InlineLink | InlineMention | InlineMath;

/** Texto plano de contenido en línea (menciones: su título). */
export const inlineToText = (items: Inline[]): string =>
  items.map((i) => (i.type === "text" ? i.text : i.type === "mention" ? i.title : i.type === "math" ? i.formula : i.content.map((t) => t.text).join(""))).join("");
export type TableContent = { type: "table"; rows: Inline[][][] };

export type Block = {
  id: string;
  type: string; // BlockType o un tipo propio (diagrama, organizador, aviso...) que se añade en hitos posteriores
  props: Record<string, unknown>;
  content: Inline[] | TableContent | undefined;
  children: Block[];
};

const text = { textColor: "default", textAlignment: "left", backgroundColor: "default" };
const DEFAULTS: Record<BlockType, Record<string, unknown>> = {
  paragraph: { ...text },
  heading: { level: 1, isToggleable: false, ...text },
  bulletListItem: { ...text },
  numberedListItem: { ...text },
  checkListItem: { checked: false, ...text },
  toggleListItem: { ...text },
  quote: { textColor: "default", backgroundColor: "default" },
  divider: {},
  codeBlock: { language: "text" },
  image: { caption: "", url: "", name: "", textAlignment: "left", showPreview: true, backgroundColor: "default" },
  file: { name: "", caption: "", url: "", backgroundColor: "default" },
  table: { textColor: "default" },
};

/** Propiedades por defecto de cada tipo, tal como las escribe el editor. */
export const defaultProps = (type: BlockType): Record<string, unknown> => {
  const base = DEFAULTS[type];
  const out: Record<string, unknown> = { ...base };
  // Orden de claves estable no importa para igualdad, pero sí que los valores coincidan con los del editor.
  if (type === "heading") return { level: 1, isToggleable: false, textColor: "default", textAlignment: "left", backgroundColor: "default" };
  return out;
};
