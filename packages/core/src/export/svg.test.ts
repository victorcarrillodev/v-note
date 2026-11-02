// T-403 y T-404 (prueba primero): diagramas y organizadores gráficos como vectores autocontenidos para la exportación (RF-24).
import { describe, it, expect } from "vitest";
import { emptyDiagram, addNode, addEdge, setEdgeLabel } from "../diagrams/diagram";
import { newTree, addChild, toggleCollapsed } from "../diagrams/tree";
import { emptyTimeline, addEvent } from "../diagrams/timeline";
import { template2x2, addItem } from "../diagrams/matrix";
import { diagramToSvg, treeToSvg, timelineToSvg, matrixToSvg, wrapText } from "./svg";

const must = <T,>(r: { ok: true; value: T } | { ok: false; error: unknown }): T => { if (!r.ok) throw new Error("x"); return r.value; };

function sample() {
  let d = emptyDiagram();
  const a = addNode(d, { id: "a", shape: "terminator", x: 0, y: 0, text: "Inicio" }); d = a.diagram;
  const b = addNode(d, { id: "b", shape: "decision", x: 0, y: 120, text: "¿Listo?" }); d = b.diagram;
  const c = addNode(d, { id: "c", shape: "process", x: 220, y: 120, text: "Hacer <b>algo</b> & más" }); d = c.diagram;
  d = must(addEdge(d, "a", "b")).diagram;
  const e2 = must(addEdge(d, "b", "c")); d = setEdgeLabel(e2.diagram, e2.edge.id, "no");
  return d;
}

describe("wrapText", () => {
  it("parte por palabras sin pasar del ancho y respeta saltos de línea", () => {
    expect(wrapText("uno dos tres cuatro", 8)).toEqual(["uno dos", "tres", "cuatro"]);
    expect(wrapText("a\nb", 20)).toEqual(["a", "b"]);
    expect(wrapText("", 10)).toEqual([]);
  });
  it("una palabra más larga que el ancho se corta en lugar de desbordar", () => {
    expect(wrapText("abcdefghij", 4)).toEqual(["abcd", "efgh", "ij"]);
  });
});

describe("diagramToSvg (T-403)", () => {
  it("dibuja una figura por forma, un conector con flecha por arista y la etiqueta", () => {
    const svg = diagramToSvg(sample());
    expect(svg.startsWith("<svg ")).toBe(true);
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain("viewBox=");
    expect(svg.match(/<line /g)).toHaveLength(2);
    expect(svg).toContain("marker-end=");
    expect(svg).toContain(">no</text>");
    expect(svg).toContain("Inicio");
    expect(svg).toContain("<polygon "); // rombo de la decisión
  });
  it("los conectores terminan en el borde de las formas, para que la punta de la flecha se vea", () => {
    let d = emptyDiagram();
    d = addNode(d, { id: "a", shape: "process", x: 0, y: 0 }).diagram;      // 140 × 60, centro (70, 30)
    d = addNode(d, { id: "b", shape: "process", x: 0, y: 200 }).diagram;    // centro (70, 230)
    d = must(addEdge(d, "a", "b")).diagram;
    const svg = diagramToSvg(d);
    expect(svg).toContain('x1="70" y1="60" x2="70" y2="200"');
  });
  it("hacia un rombo el conector llega a su vértice, no a su centro", () => {
    let d = emptyDiagram();
    d = addNode(d, { id: "a", shape: "process", x: 0, y: 0 }).diagram;
    d = addNode(d, { id: "b", shape: "decision", x: 0, y: 200 }).diagram;  // 140 × 80, vértice superior (70, 200)
    d = must(addEdge(d, "a", "b")).diagram;
    expect(diagramToSvg(d)).toContain('x2="70" y2="200"');
  });
  it("escapa el texto: nada de HTML vivo dentro del vector", () => {
    const svg = diagramToSvg(sample());
    expect(svg).not.toContain("<b>");
    expect(svg).toContain("&lt;b&gt;algo&lt;/b&gt;");
    expect(svg).toContain("&amp; más");
  });
  it("el color de relleno solo acepta colores válidos", () => {
    let d = emptyDiagram();
    d = addNode(d, { id: "x", shape: "process", x: 0, y: 0, color: "#ff0000" }).diagram;
    d = { ...d, nodes: d.nodes.map((n) => ({ ...n, color: 'red" onload="alert(1)' })) };
    expect(diagramToSvg(d)).not.toContain("onload");
  });
  it("un diagrama vacío da un vector vacío válido", () => {
    const svg = diagramToSvg(emptyDiagram());
    expect(svg).toMatch(/^<svg [^>]*><\/svg>$/);
  });
  it("es determinista", () => { expect(diagramToSvg(sample())).toBe(diagramToSvg(sample())); });
});

describe("organizadores (T-404)", () => {
  it("el organigrama dibuja un nodo por idea visible y una línea por rama; lo plegado no se dibuja", () => {
    let t = newTree("Dirección");
    const a = must(addChild(t, "root", "Ventas", "a")); t = a.tree;
    t = must(addChild(t, "root", "Técnica", "b")).tree;
    t = must(addChild(t, "a", "Norte", "a1")).tree;
    const full = treeToSvg(t, "orgchart");
    expect(full.match(/<rect /g)).toHaveLength(4);
    expect(full.match(/<line /g)).toHaveLength(3);
    const folded = treeToSvg(toggleCollapsed(t, "a"), "orgchart");
    expect(folded.match(/<rect /g)).toHaveLength(3);
    expect(folded).not.toContain("Norte");
  });
  it("el mapa mental reparte las ramas a ambos lados del centro", () => {
    let t = newTree("Centro");
    t = must(addChild(t, "root", "Izq", "a")).tree;
    t = must(addChild(t, "root", "Der", "b")).tree;
    const svg = treeToSvg(t, "mindmap");
    expect(svg).toContain("Centro"); expect(svg).toContain("Izq"); expect(svg).toContain("Der");
    expect(svg.match(/<line /g)).toHaveLength(2);
  });
  it("la línea de tiempo coloca los eventos por fecha, con su título y fecha", () => {
    let tl = emptyTimeline();
    tl = must(addEvent(tl, { id: "e1", date: "2026-03-01", title: "Inicio" })).timeline;
    tl = must(addEvent(tl, { id: "e2", date: "2026-03-20", title: "Entrega" })).timeline;
    const svg = timelineToSvg(tl);
    expect(svg).toContain("Inicio"); expect(svg).toContain("2026-03-20"); expect(svg).toContain("Entrega");
    expect(svg.match(/<rect /g)).toHaveLength(2);
  });
  it("la matriz dibuja títulos de filas y columnas y los elementos en su celda", () => {
    const base = template2x2();
    const m = must(addItem(base, base.rows[0]!.id, base.cols[0]!.id, "Pagar luz"));
    const svg = matrixToSvg(m.matrix);
    expect(svg).toContain("Pagar luz");
    expect(svg).toContain("Importante"); expect(svg).toContain("No urgente");
  });
  it("todos escapan el texto", () => {
    const t = newTree("<script>alert(1)</script>");
    expect(treeToSvg(t, "orgchart")).not.toContain("<script>");
  });
});
