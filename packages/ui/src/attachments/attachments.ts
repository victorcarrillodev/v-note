import { parseAssetUrl, type Block } from "@vnote/core";

export type PageAttachment = { hash: string; name: string; kind: "pdf" | "image" };

const IMAGE = /\.(png|jpe?g|gif|webp|bmp|avif|svg)$/i;

/** PDF e imágenes adjuntos de la página que se pueden previsualizar (sin repetir). */
export function attachmentsIn(blocks: Block[]): PageAttachment[] {
  const found = new Map<string, PageAttachment>();
  const walk = (list: Block[]) => {
    for (const b of list) {
      if ((b.type === "image" || b.type === "file") && typeof b.props.url === "string") {
        const hash = parseAssetUrl(b.props.url);
        const name = typeof b.props.name === "string" ? b.props.name : "";
        const kind = /\.pdf$/i.test(name) && b.type === "file" ? "pdf" : b.type === "image" || IMAGE.test(name) ? "image" : null;
        if (hash && kind && !found.has(hash)) found.set(hash, { hash, name, kind });
      }
      walk(b.children);
    }
  };
  walk(blocks);
  return [...found.values()];
}
