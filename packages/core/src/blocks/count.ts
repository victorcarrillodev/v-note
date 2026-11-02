import * as Y from "yjs";

/** Por encima de este número de bloques se sugiere dividir la página (RF-3, RNF-2). */
export const LARGE_PAGE_BLOCKS = 5000;
export const isLargePage = (blocks: number): boolean => blocks > LARGE_PAGE_BLOCKS;

/** Cuenta los bloques (con sus hijos) del documento sin convertirlo al modelo completo: recorre solo los contenedores. */
export function countBlocks(fragment: Y.XmlFragment): number {
  let n = 0;
  const walk = (node: Y.XmlFragment | Y.XmlElement) => {
    for (const c of node.toArray()) {
      if (c instanceof Y.XmlElement) {
        if (c.nodeName === "blockContainer") n++;
        walk(c);
      }
    }
  };
  walk(fragment);
  return n;
}
