import { parseGallery } from "../blocks/gallery";
import { inlineToText, type Block } from "../blocks/types";
import { graphicBlockText, isGraphicBlock } from "../diagrams/blockText";

const inlineText = inlineToText;

function blockText(b: Block): string[] {
  const lines: string[] = [];
  if (Array.isArray(b.content)) {
    const t = inlineText(b.content);
    if (t !== "") lines.push(t);
  } else if (b.content?.type === "table") {
    for (const row of b.content.rows) {
      const r = row.map(inlineText).filter((c) => c !== "").join(" ");
      if (r !== "") lines.push(r);
    }
  }
  if (b.type === "image" || b.type === "file") {
    const parts = [b.props.name, b.props.caption].filter((v): v is string => typeof v === "string" && v !== "");
    if (parts.length) lines.push(parts.join(" "));
  }
  if (b.type === "gallery") for (const g of parseGallery(b.props.images)) { const t = [g.name, g.caption].filter((v) => v !== "").join(" "); if (t !== "") lines.push(t); }
  if (isGraphicBlock(b)) { const t = graphicBlockText(b); if (t !== "") lines.push(t); }
  for (const child of b.children) lines.push(...blockText(child));
  return lines;
}

/** Texto plano de una página para el índice de búsqueda: un bloque por línea, sin estilos. */
export const blocksToPlainText = (blocks: Block[]): string => blocks.flatMap(blockText).join("\n");
