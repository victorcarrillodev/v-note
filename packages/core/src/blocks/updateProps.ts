import * as Y from "yjs";

/** Cambia propiedades del bloque con ese id dentro del fragmento Yjs del documento. `false` si no existe. */
export function setBlockProps(fragment: Y.XmlFragment, blockId: string, patch: Record<string, unknown>): boolean {
  const visit = (node: Y.XmlFragment | Y.XmlElement): boolean => {
    for (const child of node.toArray()) {
      if (!(child instanceof Y.XmlElement)) continue;
      if (child.nodeName === "blockContainer" && child.getAttribute("id") === blockId) {
        const content = child.toArray().find((c): c is Y.XmlElement => c instanceof Y.XmlElement && c.nodeName !== "blockGroup");
        if (!content) return false;
        for (const [k, v] of Object.entries(patch)) content.setAttribute(k, v as never);
        return true;
      }
      if (visit(child)) return true;
    }
    return false;
  };
  return visit(fragment);
}
