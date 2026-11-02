// SOLO PARA PRUEBAS: normaliza `editor.document` del editor real a la forma canónica del núcleo.
import type { Block, Inline, InlineText } from "../../src/blocks/types";

const cleanProps = (attrs: Record<string, unknown>) => Object.fromEntries(Object.entries(attrs).filter(([, v]) => v !== undefined && v !== "undefined"));

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
