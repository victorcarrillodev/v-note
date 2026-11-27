// Conversor PURO (sin React, DOM ni BlockNote): documento Yjs de una página -> bloques canónicos.
import * as Y from "yjs";
import type { Block, Inline, InlineText, Styles, TableContent } from "./types";

const MENTION = "mention";
const MATH = "math";

const cleanProps = (attrs: Record<string, unknown>) => {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(attrs)) if (v !== undefined && v !== "undefined") out[k] = v;
  return out;
};

function styleValue(v: unknown): true | string {
  if (v && typeof v === "object" && typeof (v as { stringValue?: unknown }).stringValue === "string") return (v as { stringValue: string }).stringValue;
  return typeof v === "string" ? v : true;
}

function inlineFromText(text: Y.XmlText): Inline[] {
  const items: Inline[] = [];
  for (const d of text.toDelta() as Array<{ insert: unknown; attributes?: Record<string, unknown> }>) {
    if (typeof d.insert !== "string") continue;
    const styles: Styles = {};
    let href: string | undefined;
    for (const [k, v] of Object.entries(d.attributes ?? {})) {
      if (k === "link") href = (v as { href?: string })?.href;
      else styles[k] = styleValue(v);
    }
    const t: InlineText = { type: "text", text: d.insert, styles };
    if (href !== undefined) {
      const last = items[items.length - 1];
      if (last?.type === "link" && last.href === href) last.content.push(t);
      else items.push({ type: "link", href, content: [t] });
    } else items.push(t);
  }
  return items;
}

const isElement = (n: unknown, name: string): n is Y.XmlElement => n instanceof Y.XmlElement && n.nodeName.toLowerCase() === name.toLowerCase();

/** Contenido en línea de un nodo: tramos de texto y menciones, en el orden en que aparecen. */
function inlineOf(node: Y.XmlElement): Inline[] {
  const items: Inline[] = [];
  for (const k of node.toArray()) {
    if (k instanceof Y.XmlText) items.push(...inlineFromText(k));
    else if (k instanceof Y.XmlElement) {
      const name = k.nodeName.toLowerCase();
      if (name === MATH) items.push({ type: "math", formula: String(k.getAttribute("formula") ?? "") });
      else if (name === MENTION) items.push({ type: "mention", pageId: String(k.getAttribute("pageId") ?? ""), title: String(k.getAttribute("title") ?? "") });
    }
  }
  return items;
}

function tableContent(table: Y.XmlElement): TableContent {
  const rows = table.toArray().filter((r): r is Y.XmlElement => isElement(r, "tableRow"));
  return {
    type: "table",
    rows: rows.map((r) =>
      r
        .toArray()
        .filter((c): c is Y.XmlElement => isElement(c, "tableCell"))
        .map((cell) => {
          const para = cell.toArray().find((p) => isElement(p, "tableParagraph")) as Y.XmlElement | undefined;
          const text = para?.toArray().find((t) => t instanceof Y.XmlText) as Y.XmlText | undefined;
          return text ? inlineFromText(text) : [];
        }),
    ),
  };
}

function container(c: Y.XmlElement): Block {
  const kids = c.toArray();
  const contentNode = kids.find((k) => k instanceof Y.XmlElement && !isElement(k, "blockGroup")) as Y.XmlElement | undefined;
  const group = kids.find((k) => isElement(k, "blockGroup")) as Y.XmlElement | undefined;
  const hasInline = contentNode?.toArray().some((k) => k instanceof Y.XmlText || isElement(k, MENTION)) ?? false;
  return {
    id: String(c.getAttribute("id")),
    type: contentNode?.nodeName ?? "paragraph",
    props: cleanProps((contentNode?.getAttributes() as Record<string, unknown>) ?? {}),
    content: contentNode && isElement(contentNode, "table") ? tableContent(contentNode) : hasInline && contentNode ? inlineOf(contentNode) : undefined,
    children: group ? group.toArray().filter((k): k is Y.XmlElement => isElement(k, "blockContainer")).map(container) : [],
  };
}

/** Lee los bloques de una página (fragmento Yjs del editor) sin depender de BlockNote. */
export function fromYjs(fragment: Y.XmlFragment): Block[] {
  const group = fragment.toArray().find((k) => isElement(k, "blockGroup")) as Y.XmlElement | undefined;
  if (!group) return [];
  return group.toArray().filter((k): k is Y.XmlElement => isElement(k, "blockContainer")).map(container);
}
