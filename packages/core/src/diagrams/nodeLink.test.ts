// study-features-2 T-7 (prueba primero): una forma del lienzo puede enlazar con una página.
import { describe, it, expect } from "vitest";
import { addNode, emptyDiagram, parseDiagram, serializeDiagram, setNodePage, nodesLinkedTo, type Diagram } from "./diagram";

const base = (): { d: Diagram; id: string } => { const r = addNode(emptyDiagram(), { shape: "process", x: 0, y: 0, text: "Pilas" }); return { d: r.diagram, id: r.node.id }; };

describe("enlace de una forma con una página", () => {
  it("setNodePage enlaza y desenlaza; una forma sin enlace no lleva el campo", () => {
    const { d, id } = base();
    expect(d.nodes[0]!.page).toBeUndefined();
    const linked = setNodePage(d, id, "page-1");
    expect(linked.nodes[0]!.page).toBe("page-1");
    const cleared = setNodePage(linked, id, null);
    expect("page" in cleared.nodes[0]!).toBe(false);
  });
  it("ignora ids de forma inexistentes y textos vacíos", () => {
    const { d, id } = base();
    expect(setNodePage(d, "nope", "p")).toEqual(d);
    expect("page" in setNodePage(d, id, "  ").nodes[0]!).toBe(false);
  });
  it("sobrevive a guardarse y leerse, y un diagrama sin enlaces se guarda igual que antes", () => {
    const { d, id } = base();
    const text = serializeDiagram(setNodePage(d, id, "page-1"));
    const r = parseDiagram(text);
    expect(r.ok && r.value.nodes[0]!.page).toBe("page-1");
    expect(serializeDiagram(d)).not.toContain('"page"');
  });
  it("rechaza un enlace con un tipo inválido sin romper el resto", () => {
    const { d } = base();
    const broken = JSON.parse(serializeDiagram(d));
    broken.nodes[0].page = 42;
    expect(parseDiagram(JSON.stringify(broken)).ok).toBe(false);
  });
  it("nodesLinkedTo encuentra las formas que apuntan a una página (para saber qué se rompe al borrarla)", () => {
    const { d, id } = base();
    const two = addNode(setNodePage(d, id, "a"), { shape: "note", x: 200, y: 0, text: "otro" });
    const linked = setNodePage(two.diagram, two.node.id, "a");
    expect(nodesLinkedTo(linked, "a").map((n) => n.id)).toEqual([id, two.node.id]);
    expect(nodesLinkedTo(linked, "zzz")).toEqual([]);
  });
});
