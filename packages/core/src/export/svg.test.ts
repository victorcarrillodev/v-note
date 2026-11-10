// T-403 y T-404 (prueba primero): diagramas y organizadores gráficos como vectores autocontenidos para la exportación (RF-24).
import { describe, it, expect } from "vitest";
import { emptyDiagram, addNode, addEdge, connect, setEdgeLabel, parseDiagram, setNodeStyle, setEdgeStyle } from "../diagrams/diagram";
import { newTree, addChild, toggleCollapsed } from "../diagrams/tree";
import { emptyTimeline, addEvent } from "../diagrams/timeline";
import { template2x2, addItem } from "../diagrams/matrix";
import { connectorPath, pathToSvg } from "../diagrams/path";
import { styledPath } from "../diagrams/caps";
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

const noCaps = (d: ReturnType<typeof emptyDiagram>) => setEdgeStyle(d, d.edges.map((e) => e.id), { startCap: "none", endCap: "none" });

describe("diagramToSvg (T-403, G-078)", () => {
  it("dibuja una figura por forma, un conector con flecha por arista y la etiqueta", () => {
    const svg = diagramToSvg(sample());
    expect(svg.startsWith("<svg ")).toBe(true);
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain("viewBox=");
    expect(svg.match(/<path data-connector/g)).toHaveLength(2);
    expect(svg.match(/data-arrow/g)).toHaveLength(2);
    expect(svg).toContain(">no</text>");
    expect(svg).toContain("Inicio");
    expect(svg).toContain("<polygon "); // rombo de la decisión
  });
  it("los conectores nacen en el anclaje elegido y terminan en el del destino (recto)", () => {
    let d = emptyDiagram();
    d = addNode(d, { id: "a", shape: "process", x: 0, y: 0 }).diagram;      // 140 × 60: anclaje sur (70, 60)
    d = addNode(d, { id: "b", shape: "process", x: 0, y: 200 }).diagram;    // anclaje norte (70, 200)
    d = must(connect(d, { node: "a", anchor: "s" }, { node: "b", anchor: "n" }, { route: "straight" })).diagram;
    expect(diagramToSvg(noCaps(d))).toContain('d="M 70 60 L 70 200"');
  });
  it("hacia un rombo el conector llega a su vértice, no a su centro", () => {
    let d = emptyDiagram();
    d = addNode(d, { id: "a", shape: "process", x: 0, y: 0 }).diagram;
    d = addNode(d, { id: "b", shape: "decision", x: 0, y: 200 }).diagram;  // 140 × 80, vértice superior (70, 200)
    d = must(connect(d, { node: "a", anchor: "s" }, { node: "b", anchor: "n" }, { route: "straight" })).diagram;
    expect(diagramToSvg(noCaps(d))).toContain('L 70 200"');
  });
  it("el redondeado se dibuja como curva", () => {
    expect(diagramToSvg(sample())).toMatch(/d="M [\d. -]+ C /);
  });
  it("un conector con extremo libre se dibuja hasta su punto y el dibujo lo incluye", () => {
    let d = emptyDiagram();
    d = addNode(d, { id: "a", shape: "process", x: 0, y: 0 }).diagram;
    d = must(connect(d, { node: "a", anchor: "e" }, { x: 500, y: 400 }, { route: "straight" })).diagram;
    const svg = diagramToSvg(noCaps(d));
    expect(svg).toContain('d="M 140 30 L 500 400"');
    const [x, y, w, h] = /viewBox="([^"]+)"/.exec(svg)![1]!.split(" ").map(Number) as [number, number, number, number];
    expect(x + w).toBeGreaterThanOrEqual(500); expect(y + h).toBeGreaterThanOrEqual(400);
  });
  it("un conector de un diagrama v1 se dibuja del lado derecho de su origen al izquierdo de su destino, como se veía", () => {
    const v1 = JSON.stringify({ nodes: [{ id: "a", shape: "process", x: 0, y: 0, w: 140, h: 60, text: "A", color: "#dcfce7" }, { id: "b", shape: "process", x: 300, y: 200, w: 140, h: 60, text: "B", color: "#dbeafe" }], edges: [{ id: "e", from: "a", to: "b", label: "" }] });
    const r = parseDiagram(v1);
    expect(r.ok && diagramToSvg(noCaps(r.value))).toMatch(/d="M 140 30 C [\d. -]+ 300 230"/);
  });
  it("el color del conector: la tinta usa el gris de siempre y un hexadecimal válido se respeta; uno inválido no entra", () => {
    let d = sample();
    expect(diagramToSvg(d)).toContain('stroke="#475569"');
    d = { ...d, edges: d.edges.map((e, i) => (i === 0 ? { ...e, style: { ...e.style, color: "#dc2626" } } : { ...e, style: { ...e.style, color: 'x" onload="y' } })) };
    const svg = diagramToSvg(d);
    expect(svg).toContain('stroke="#dc2626"'); expect(svg).not.toContain("onload");
  });
  it("los cuatro trazados se exportan con el mismo camino que el lienzo, también con puntos de paso y de control (G-117, G-121)", () => {
    let d = emptyDiagram();
    d = addNode(d, { id: "a", shape: "process", x: 0, y: 0 }).diagram;
    d = addNode(d, { id: "b", shape: "decision", x: 400, y: 220 }).diagram;
    for (const route of ["straight", "orthogonal", "curved", "free"] as const) d = must(connect(d, { node: "a", anchor: route === "straight" ? "e" : route === "orthogonal" ? "s" : route === "curved" ? "n" : "se" }, { node: "b", anchor: route === "free" ? "s" : "w" }, { route })).diagram;
    d = { ...d, edges: d.edges.map((e) => (e.route === "orthogonal" ? { ...e, waypoints: [{ x: 200, y: 140 }] } : e.route === "free" ? { ...e, points: [{ x: 250, y: 20 }, { x: 330, y: 300 }], smooth: true } : e)) };
    const svg = diagramToSvg(d);
    for (const e of d.edges) { const p = connectorPath(d, e)!; expect(svg, e.route).toContain(`d="${pathToSvg({ ...p, cmds: styledPath(p, e.style).cmds })}"`); }
  });
  it("un conector curvo con puntos se exporta con la misma curva continua que el lienzo, sin tramos rectos (R-089, RF-8)", () => {
    let d = emptyDiagram();
    d = addNode(d, { id: "a", shape: "process", x: 0, y: 0 }).diagram;
    d = addNode(d, { id: "b", shape: "process", x: 400, y: 220 }).diagram;
    d = must(connect(d, { node: "a", anchor: "e" }, { node: "b", anchor: "w" }, { route: "curved" })).diagram;
    d = { ...d, edges: d.edges.map((e) => ({ ...e, points: [{ x: 230, y: 20 }, { x: 330, y: 300 }] })) };
    const e = d.edges[0]!, p = connectorPath(d, e)!;
    const expected = pathToSvg({ ...p, cmds: styledPath(p, e.style).cmds });
    const svg = diagramToSvg(d);
    expect(svg).toContain(`d="${expected}"`);
    const dAttr = /data-connector="" d="([^"]+)"/.exec(svg)![1]!;
    expect(dAttr).toMatch(/^M [\d. -]+( C [\d. -]+)+/);
    expect(dAttr).not.toMatch(/ L /);
  });
  it("el estilo de la forma se exporta: relleno, opacidad, contorno, grosor, línea y color del texto (G-141)", () => {
    let d = emptyDiagram();
    d = addNode(d, { id: "a", shape: "process", x: 0, y: 0, text: "Hola" }).diagram;
    d = setNodeStyle(d, ["a"], { fill: "#fff3b0", fillOpacity: 0.5, stroke: "palette:red", strokeWidth: 4, strokeDash: "dashed", textColor: "#112233" });
    const svg = diagramToSvg(d);
    expect(svg).toContain('fill="#fff3b0"'); expect(svg).toContain('fill-opacity="0.5"');
    expect(svg).toContain('stroke="#C0312F"'); expect(svg).toContain('stroke-width="4"'); expect(svg).toMatch(/stroke-dasharray="[\d. ]+"/);
    expect(svg).toContain('fill="#112233"');
  });
  it("sin relleno se exporta fill=none y la opacidad completa no añade atributo", () => {
    let d = emptyDiagram();
    d = addNode(d, { id: "a", shape: "process", x: 0, y: 0 }).diagram; d = addNode(d, { id: "b", shape: "decision", x: 300, y: 0 }).diagram;
    d = setNodeStyle(d, ["a"], { fill: "none" });
    const svg = diagramToSvg(d);
    expect(svg).toContain('fill="none"'); expect(svg).not.toContain("fill-opacity");
  });
  it("el estilo del conector se exporta: color, grosor, línea y las puntas de cada extremo (G-141)", () => {
    let d = emptyDiagram();
    d = addNode(d, { id: "a", shape: "process", x: 0, y: 0 }).diagram; d = addNode(d, { id: "b", shape: "process", x: 400, y: 0 }).diagram;
    const r = must(connect(d, { node: "a", anchor: "e" }, { node: "b", anchor: "w" }, { route: "straight" }));
    d = setEdgeStyle(r.diagram, [r.edge.id], { color: "#dc2626", width: "thick", dash: "dotted", startCap: "circle", endCap: "diamond" });
    const svg = diagramToSvg(d);
    expect(svg).toContain('stroke="#dc2626"'); expect(svg).toContain('stroke-width="4"'); expect(svg).toMatch(/stroke-dasharray="[\d. ]+"/);
    expect(svg).toContain('data-cap="circle"'); expect(svg).toContain('data-cap="diamond"'); expect(svg).not.toContain("data-arrow");
    // la línea se acorta bajo las puntas: el trazo exportado no llega a los anclajes
    const m = /data-connector="" d="M ([\d.]+) ([\d.]+) L ([\d.]+) ([\d.]+)"/.exec(svg)!;
    expect(Number(m[1])).toBeGreaterThan(140); expect(Number(m[3])).toBeLessThan(400);
  });
  it("sin puntas no hay marcas ni acorta el trazo", () => {
    let d = emptyDiagram();
    d = addNode(d, { id: "a", shape: "process", x: 0, y: 0 }).diagram; d = addNode(d, { id: "b", shape: "process", x: 400, y: 0 }).diagram;
    const r = must(connect(d, { node: "a", anchor: "e" }, { node: "b", anchor: "w" }, { route: "straight" }));
    d = setEdgeStyle(r.diagram, [r.edge.id], { startCap: "none", endCap: "none" });
    const svg = diagramToSvg(d);
    expect(svg).not.toContain("data-cap"); expect(svg).toContain('d="M 140 30 L 400 30"');
  });
  it("un color de paleta (no tinta) usa su tono fuerte del tema claro", () => {
    let d = sample();
    d = { ...d, edges: d.edges.map((e) => ({ ...e, style: { ...e.style, color: "palette:red" } })) };
    expect(diagramToSvg(d)).toContain('stroke="#C0312F"');
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
    d = { ...d, nodes: d.nodes.map((n) => ({ ...n, style: { ...n.style, fill: 'red" onload="alert(1)' } })) };
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
