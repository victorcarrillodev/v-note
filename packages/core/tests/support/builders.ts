// Utilidades de PRUEBA para construir páginas y documentos.
import * as Y from "yjs";
import { toYjs } from "../../src/blocks/toYjs";
import { defaultProps, type Block, type BlockType, type Inline } from "../../src/blocks/types";

let n = 0;
export const para = (text: string, type: BlockType = "paragraph", extra: Partial<Block> = {}): Block => ({
  id: `b${++n}`,
  type,
  props: defaultProps(type),
  content: [{ type: "text", text, styles: {} } as Inline],
  children: [],
  ...extra,
});

/** Estado Yjs completo (como una sola actualización) de una página con esos bloques. */
export function updateFor(blocks: Block[]): Uint8Array {
  const doc = new Y.Doc();
  toYjs(blocks, doc.getXmlFragment("doc"));
  return Y.encodeStateAsUpdate(doc);
}

/** Edición REAL de una página existente: añade texto al primer párrafo y devuelve la actualización incremental (no un documento nuevo). */
export function appendTextUpdate(doc: Y.Doc, extra: string): Uint8Array {
  let captured: Uint8Array | null = null;
  const on = (u: Uint8Array) => { captured = u; };
  doc.on("update", on);
  const find = (n: Y.XmlFragment | Y.XmlElement): Y.XmlText | null => {
    for (const c of n.toArray()) {
      if (c instanceof Y.XmlText) return c;
      if (c instanceof Y.XmlElement) { const r = find(c); if (r) return r; }
    }
    return null;
  };
  const t = find(doc.getXmlFragment("doc"));
  if (!t) throw new Error("la página no tiene texto que editar");
  t.insert(t.length, extra);
  doc.off("update", on);
  return captured!;
}
