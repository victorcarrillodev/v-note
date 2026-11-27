// backlog-b7-b11 T-3 (prueba primero): las formas del lienzo enlazadas con una página cuentan como enlaces de la página.
import { describe, it, expect } from "vitest";
import { mentionTargets } from "./linkIndex";
import { addNode, emptyDiagram, serializeDiagram, setNodePage } from "../diagrams/diagram";
import type { Block } from "../blocks/types";

const diagramBlock = (id: string, pages: string[]): Block => {
  let d = emptyDiagram();
  pages.forEach((p, i) => { const r = addNode(d, { shape: "process", x: i * 100, y: 0, text: `n${i}` }); d = setNodePage(r.diagram, r.node.id, p); });
  return { id, type: "diagram", props: { data: serializeDiagram(d) }, content: undefined, children: [] };
};
const para = (id: string, pageId: string): Block => ({ id, type: "paragraph", props: {}, content: [{ type: "mention", pageId, title: "x" }], children: [] });

describe("enlaces desde formas del lienzo", () => {
  it("las páginas enlazadas desde un diagrama aparecen como destinos, sin repetir", () => {
    expect(mentionTargets("me", [diagramBlock("d", ["b", "a", "b"])])).toEqual(["a", "b"]);
  });
  it("se juntan con las menciones del texto y no cuenta la propia página", () => {
    expect(mentionTargets("me", [para("p", "c"), diagramBlock("d", ["a", "me"])])).toEqual(["a", "c"]);
  });
  it("un diagrama vacío, sin enlaces o con datos dañados no rompe nada", () => {
    expect(mentionTargets("me", [diagramBlock("d", [])])).toEqual([]);
    expect(mentionTargets("me", [{ id: "x", type: "diagram", props: { data: "{no es json" }, content: undefined, children: [] }])).toEqual([]);
    expect(mentionTargets("me", [{ id: "y", type: "diagram", props: {}, content: undefined, children: [] }])).toEqual([]);
  });
  it("una forma dentro de un bloque hijo también cuenta", () => {
    const parent: Block = { id: "q", type: "quote", props: {}, content: [], children: [diagramBlock("d", ["z"])] };
    expect(mentionTargets("me", [parent])).toEqual(["z"]);
  });
});
