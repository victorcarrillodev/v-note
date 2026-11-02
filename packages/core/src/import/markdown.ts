import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import type { Content, Root, PhrasingContent, ListItem, Table } from "mdast";
import { newId } from "../ids";
import { defaultProps, type Block, type BlockType, type Inline, type InlineText, type Styles } from "../blocks/types";

export type MarkdownOptions = { /** Reconoce `[[Página]]` y `[[Página|alias]]` (bóvedas de Obsidian). */ wikilinks?: boolean };
export type MarkdownResult = {
  blocks: Block[];
  /** Imágenes cuyo archivo hay que resolver (ruta relativa o URL tal como aparece). */
  images: { blockId: string; src: string }[];
  /** Cosas que se convirtieron en algo parecido pero no igual (para el informe de importación). */
  approximations: string[];
};

const parser = unified().use(remarkParse).use(remarkGfm);
const FRONT_MATTER = /^---\r?\n[\s\S]*?\r?\n---[ \t]*(?:\r?\n|$)/;

const block = (type: BlockType, props: Record<string, unknown>, content: Block["content"], children: Block[] = []): Block =>
  ({ id: newId(), type, props: { ...defaultProps(type), ...props }, content, children });
const text = (t: string, styles: Styles = {}): InlineText => ({ type: "text", text: t, styles });

/** Convierte Markdown (CommonMark + GFM) al modelo canónico de bloques. Nunca lanza: lo que no entiende se aproxima y se anota. */
export function markdownToBlocks(source: string, opts: MarkdownOptions = {}): MarkdownResult {
  const approximations: string[] = [];
  const images: MarkdownResult["images"] = [];
  const note = (m: string) => { if (!approximations.includes(m)) approximations.push(m); };

  let md = source.replace(/^﻿/, "");
  if (FRONT_MATTER.test(md)) { md = md.replace(FRONT_MATTER, ""); note("Se omitió el encabezado de propiedades (YAML) del archivo"); }

  const wikilinks = (t: string, styles: Styles): Inline[] => {
    if (!opts.wikilinks || !t.includes("[[")) return [text(t, styles)];
    const out: Inline[] = [];
    let last = 0;
    for (const m of t.matchAll(/\[\[([^\]|#]+?)(?:#[^\]|]*)?(?:\|([^\]]*))?\]\]/g)) {
      if (m.index! > last) out.push(text(t.slice(last, m.index), styles));
      out.push({ type: "mention", pageId: "", title: m[1]!.trim() });
      if (m[2] !== undefined) note("Se descartó el alias de un enlace [[ ]] (la mención muestra el título de la página)");
      last = m.index! + m[0].length;
    }
    if (last < t.length) out.push(text(t.slice(last), styles));
    return out;
  };

  const inline = (nodes: PhrasingContent[], styles: Styles = {}): Inline[] => {
    const out: Inline[] = [];
    for (const n of nodes) {
      switch (n.type) {
        case "text": out.push(...wikilinks(n.value, styles)); break;
        case "strong": out.push(...inline(n.children, { ...styles, bold: true })); break;
        case "emphasis": out.push(...inline(n.children, { ...styles, italic: true })); break;
        case "delete": out.push(...inline(n.children, { ...styles, strike: true })); break;
        case "inlineCode": out.push(text(n.value, { ...styles, code: true })); break;
        case "break": out.push(text("\n", styles)); break;
        case "link": {
          const inner = inline(n.children, styles).filter((i): i is InlineText => i.type === "text");
          out.push({ type: "link", href: n.url, content: inner.length ? inner : [text(n.url)] });
          break;
        }
        case "image": out.push(text(n.alt ?? "", styles)); note("Una imagen dentro de un párrafo se convirtió en su texto alternativo"); break;
        case "html": out.push(text(n.value.replace(/<[^>]+>/g, ""), styles)); note("Se conservó solo el texto de contenido HTML"); break;
        default: {
          const v = (n as { value?: string }).value;
          out.push(text(typeof v === "string" ? v : "", styles));
          note(`Elemento «${n.type}» convertido a texto`);
        }
      }
    }
    // une tramos contiguos con el mismo estilo para una salida estable
    const merged: Inline[] = [];
    for (const i of out) {
      const last = merged[merged.length - 1];
      if (i.type === "text" && last?.type === "text" && JSON.stringify(last.styles) === JSON.stringify(i.styles)) last.text += i.text;
      else merged.push(i.type === "text" ? { ...i } : i);
    }
    return merged.filter((i) => !(i.type === "text" && i.text === ""));
  };

  const items = (listChildren: ListItem[], ordered: boolean): Block[] =>
    listChildren.map((li) => {
      const first = li.children.find((c) => c.type === "paragraph");
      const rest = li.children.filter((c) => c !== first);
      const type: BlockType = li.checked === true || li.checked === false ? "checkListItem" : ordered ? "numberedListItem" : "bulletListItem";
      const props = type === "checkListItem" ? { checked: li.checked === true } : {};
      return block(type, props, first && first.type === "paragraph" ? inline(first.children) : [], blocks(rest));
    });

  const tableOf = (t: Table): Block =>
    block("table", {}, { type: "table", rows: t.children.map((row) => row.children.map((cell) => inline(cell.children as PhrasingContent[]))) });

  function blocks(nodes: Content[]): Block[] {
    const out: Block[] = [];
    for (const n of nodes) {
      switch (n.type) {
        case "heading": {
          if (n.depth > 3) note(`Un encabezado de nivel ${n.depth} se convirtió en nivel 3`);
          out.push(block("heading", { level: Math.min(3, n.depth) }, inline(n.children)));
          break;
        }
        case "paragraph": {
          const only = n.children.length === 1 ? n.children[0]! : null;
          if (only && only.type === "image") {
            const b = block("image", { url: only.url, caption: only.alt ?? "", name: only.alt ?? "" }, undefined);
            images.push({ blockId: b.id, src: only.url });
            out.push(b);
          } else out.push(block("paragraph", {}, inline(n.children)));
          break;
        }
        case "blockquote": {
          for (const c of n.children) {
            if (c.type === "paragraph") out.push(block("quote", {}, inline(c.children)));
            else { note("Contenido anidado dentro de una cita se aplanó"); out.push(...blocks([c])); }
          }
          break;
        }
        case "list": out.push(...items(n.children, n.ordered === true)); break;
        case "code": out.push(block("codeBlock", { language: n.lang ?? "text" }, n.value === "" ? [] : [text(n.value)])); break;
        case "thematicBreak": out.push(block("divider", {}, undefined)); break;
        case "table": out.push(tableOf(n)); break;
        case "html": {
          const t = n.value.replace(/<[^>]+>/g, "").trim();
          if (t !== "") out.push(block("paragraph", {}, [text(t)]));
          note("Se conservó solo el texto de un bloque HTML");
          break;
        }
        default: {
          const v = (n as { value?: string }).value;
          const children = (n as { children?: Content[] }).children;
          note(`Elemento «${n.type}» convertido a texto`);
          if (typeof v === "string" && v.trim() !== "") out.push(block("paragraph", {}, [text(v)]));
          else if (children) out.push(...blocks(children));
        }
      }
    }
    return out;
  }

  const tree = parser.parse(md) as Root;
  return { blocks: blocks(tree.children), images, approximations };
}
