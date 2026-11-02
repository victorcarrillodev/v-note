// T-358 (prueba primero): la mención en línea guarda el id de la página de destino en el modelo canónico.
import { describe, it, expect } from "vitest";
import * as Y from "yjs";
import { toYjs } from "./toYjs";
import { fromYjs } from "./fromYjs";
import { defaultProps, type Block } from "./types";
import { blocksToPlainText } from "../search/plainText";
import { blocksToMarkdown } from "../backup/markdown";

const withMention: Block = {
  id: "b1", type: "paragraph", props: defaultProps("paragraph"), children: [],
  content: [
    { type: "text", text: "Ver ", styles: {} },
    { type: "mention", pageId: "page-1", title: "Proyecto" },
    { type: "text", text: " y más", styles: { bold: true } },
  ],
};
const roundTrip = (blocks: Block[]) => { const doc = new Y.Doc(); toYjs(blocks, doc.getXmlFragment("doc")); return fromYjs(doc.getXmlFragment("doc")); };

describe("mención en línea (T-358)", () => {
  it("ida y vuelta por Yjs conserva el id de destino y el texto mostrado", () => {
    expect(roundTrip([withMention])[0]!.content).toEqual(withMention.content);
  });
  it("el texto de búsqueda incluye el título de la mención", () => {
    expect(blocksToPlainText([withMention])).toBe("Ver Proyecto y más");
  });
  it("el respaldo en Markdown la escribe como enlace legible con el id", () => {
    expect(blocksToMarkdown([withMention])).toContain("Ver [Proyecto](page:page-1)");
  });
});
