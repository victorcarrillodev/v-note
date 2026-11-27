// Conversor inverso: bloques canónicos -> estructura Yjs idéntica a la que escribe BlockNote (para restaurar e importar).
import * as Y from "yjs";
import type { Block, Inline, TableContent } from "./types";

const UNDEFINED_ATTRS: Record<string, string[]> = { numberedListItem: ["start"], image: ["previewWidth"] };

function applyInline(text: Y.XmlText, items: Inline[]): void {
  const delta: Array<{ insert: string; attributes?: Record<string, unknown> }> = [];
  const push = (t: string, styles: Record<string, true | string>, link?: string) => {
    const attributes: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(styles)) attributes[k] = v === true ? {} : { stringValue: v };
    if (link !== undefined) attributes.link = { href: link };
    delta.push(Object.keys(attributes).length ? { insert: t, attributes } : { insert: t });
  };
  for (const item of items) {
    if (item.type === "text") push(item.text, item.styles);
    else if (item.type === "link") for (const t of item.content) push(t.text, t.styles, item.href);
  }
  if (delta.length) text.applyDelta(delta);
}

function inlineText(items: Inline[]): Y.XmlText {
  const t = new Y.XmlText();
  applyInline(t, items);
  return t;
}

/** Nodos Yjs de un contenido en línea: tramos de texto y, entre ellos, una mención como elemento propio (igual que el editor). */
function inlineNodes(items: Inline[]): Array<Y.XmlText | Y.XmlElement> {
  const out: Array<Y.XmlText | Y.XmlElement> = [];
  let run: Inline[] = [];
  const flush = () => { if (run.length) out.push(inlineText(run)); run = []; };
  for (const item of items) {
    if (item.type === "mention") {
      flush();
      const m = new Y.XmlElement("mention");
      m.setAttribute("pageId", item.pageId); m.setAttribute("title", item.title);
      out.push(m);
    } else if (item.type === "math") {
      flush();
      const m = new Y.XmlElement("math");
      m.setAttribute("formula", item.formula);
      out.push(m);
    } else run.push(item);
  }
  flush();
  if (out.length === 0) out.push(inlineText([])); // un bloque de texto vacío conserva su nodo de texto
  return out;
}

function tableElement(content: TableContent): Y.XmlElement[] {
  return content.rows.map((row) => {
    const tr = new Y.XmlElement("tableRow");
    tr.insert(
      0,
      row.map((cell) => {
        const td = new Y.XmlElement("tableCell");
        for (const [k, v] of Object.entries({ backgroundColor: "default", colspan: 1, rowspan: 1, textAlignment: "left", textColor: "default" })) td.setAttribute(k, v as never);
        const p = new Y.XmlElement("tableParagraph");
        p.insert(0, inlineNodes(cell));
        td.insert(0, [p]);
        return td;
      }),
    );
    return tr;
  });
}

function container(b: Block): Y.XmlElement {
  const c = new Y.XmlElement("blockContainer");
  c.setAttribute("id", b.id);
  const node = new Y.XmlElement(b.type);
  for (const [k, v] of Object.entries(b.props)) if (v !== undefined) node.setAttribute(k, v as never);
  // Rareza de BlockNote: algunos tipos guardan atributos opcionales con valor indefinido aunque no se usen.
  for (const k of UNDEFINED_ATTRS[b.type] ?? []) if (b.props[k] === undefined) node.setAttribute(k, undefined as never);
  if (b.content && !Array.isArray(b.content)) node.insert(0, tableElement(b.content));
  else if (Array.isArray(b.content)) node.insert(0, inlineNodes(b.content));
  c.insert(0, [node]);
  if (b.children.length) {
    const g = new Y.XmlElement("blockGroup");
    g.insert(0, b.children.map(container));
    c.insert(1, [g]);
  }
  return c;
}

/** Escribe los bloques en el fragmento (que debe estar vacío) con la misma estructura que el editor. */
export function toYjs(blocks: Block[], fragment: Y.XmlFragment): void {
  const group = new Y.XmlElement("blockGroup");
  group.insert(0, blocks.map(container));
  fragment.insert(0, [group]);
}
