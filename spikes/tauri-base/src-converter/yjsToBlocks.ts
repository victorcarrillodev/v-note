// Conversor PURO (sin React, DOM, ni BlockNote): documento Yjs de una página -> bloques canónicos.
import * as Y from "yjs";

export type Styles = Record<string, true | string>;
export type InlineText = { type: "text"; text: string; styles: Styles };
export type InlineLink = { type: "link"; href: string; content: InlineText[] };
export type Inline = InlineText | InlineLink;
export type TableContent = { type: "table"; rows: Inline[][][] };
export type Block = {
  id: string;
  type: string;
  props: Record<string, unknown>;
  content: Inline[] | TableContent | undefined;
  children: Block[];
};

const cleanProps = (attrs: Record<string, unknown>) => {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(attrs)) if (v !== undefined && v !== "undefined") out[k] = v;
  return out;
};

function styleValue(v: unknown): true | string {
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    if (typeof o.stringValue === "string") return o.stringValue;
  }
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

function isElement(n: unknown, name: string): n is Y.XmlElement {
  return n instanceof Y.XmlElement && n.nodeName.toLowerCase() === name.toLowerCase();
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
  const text = contentNode?.toArray().find((k) => k instanceof Y.XmlText) as Y.XmlText | undefined;
  return {
    id: String(c.getAttribute("id")),
    type: contentNode?.nodeName ?? "paragraph",
    props: cleanProps((contentNode?.getAttributes() as Record<string, unknown>) ?? {}),
    content: contentNode && isElement(contentNode, "table") ? tableContent(contentNode) : text ? inlineFromText(text) : undefined,
    children: group ? group.toArray().filter((k): k is Y.XmlElement => isElement(k, "blockContainer")).map(container) : [],
  };
}

export function yjsToBlocks(fragment: Y.XmlFragment): Block[] {
  const group = fragment.toArray().find((k) => isElement(k, "blockGroup")) as Y.XmlElement | undefined;
  if (!group) return [];
  return group.toArray().filter((k): k is Y.XmlElement => isElement(k, "blockContainer")).map(container);
}

// Normaliza la salida de `editor.document` de BlockNote a la misma forma canónica (solo para pruebas de contrato).
export function normalizeEditorBlocks(blocks: any[]): Block[] {
  const inl = (c: any[]): Inline[] =>
    c.map((i) =>
      i.type === "link"
        ? { type: "link" as const, href: i.href, content: inl(i.content) as InlineText[] }
        : { type: "text" as const, text: i.text, styles: i.styles ?? {} },
    );
  return blocks.map((b) => ({
    id: b.id,
    type: b.type,
    props: cleanProps(b.props ?? {}),
    content: Array.isArray(b.content)
      ? inl(b.content)
      : b.content?.type === "tableContent"
        ? { type: "table" as const, rows: b.content.rows.map((r: any) => r.cells.map((c: any) => inl(Array.isArray(c) ? c : c.content))) }
        : undefined,
    children: normalizeEditorBlocks(b.children ?? []),
  }));
}
