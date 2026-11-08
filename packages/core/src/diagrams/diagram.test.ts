// T-323, T-333, T-335, T-336, T-352 (prueba primero): modelo puro de diagramas de flujo.
import { describe, it, expect } from "vitest";
import fc from "fast-check";
import * as Y from "yjs";
import { toYjs } from "../blocks/toYjs";
import { fromYjs } from "../blocks/fromYjs";
import { blocksToPlainText } from "../search/plainText";
import { blocksToMarkdown } from "../backup/markdown";
import type { Block } from "../blocks/types";
import {
  emptyDiagram, addNode, moveNode, resizeNode, setNodeText, setNodeColor, deleteNode, addEdge, setEdgeLabel, deleteEdge,
  edgeEndpoints, isAttached, connect, reconnectEnd, detachEnd, moveFreeEnd, moveFreeEdge, setRoute, setWaypoints, resetRoute, setCurvature, addControlPoint, moveControlPoint, removeControlPoint, setSmooth, setNodeStyle, setEdgeStyle, diagramBounds, fitToView, centerOn, centerOnEdgeEnd, serializeDiagram, parseDiagram, diagramText, DiagramHistory, SHAPES, type Diagram,
} from "./diagram";
import { anchorPosition, magnetRadius } from "./anchors";

const must = <T,>(r: { ok: boolean; value?: T; error?: { message: string } }): T => { if (!r.ok) throw new Error(r.error?.message); return r.value as T; };
let d: Diagram;
const make = () => {
  let x = emptyDiagram();
  const a = addNode(x, { shape: "terminator", x: 0, y: 0, id: "a" }); x = a.diagram;
  const b = addNode(x, { shape: "process", x: 300, y: 0, id: "b" }); x = b.diagram;
  const c = addNode(x, { shape: "decision", x: 600, y: 200, id: "c" }); x = c.diagram;
  return x;
};

describe("formas y nodos", () => {
  it("hay cinco formas: inicio/fin, proceso, decisión, entrada/salida y nota", () => {
    expect([...SHAPES]).toEqual(["terminator", "process", "decision", "io", "note"]);
  });
  it("añadir una forma la coloca donde se pide, con tamaño y color por defecto", () => {
    const r = addNode(emptyDiagram(), { shape: "process", x: 120, y: 80 });
    expect(r.node).toMatchObject({ shape: "process", x: 120, y: 80, text: "" });
    expect(r.node.w).toBeGreaterThan(0); expect(r.node.h).toBeGreaterThan(0);
    expect(r.diagram.nodes).toHaveLength(1);
  });
  it("los ids son únicos aunque no se indiquen", () => {
    let x = emptyDiagram();
    for (let i = 0; i < 20; i++) x = addNode(x, { shape: "note", x: i, y: i }).diagram;
    expect(new Set(x.nodes.map((n) => n.id)).size).toBe(20);
  });
  it("mover, redimensionar (con tamaño mínimo), editar texto y cambiar color", () => {
    d = make();
    d = moveNode(d, "a", 50, 60); expect(d.nodes[0]).toMatchObject({ x: 50, y: 60 });
    d = resizeNode(d, "a", 200, 90); expect(d.nodes[0]).toMatchObject({ w: 200, h: 90 });
    d = resizeNode(d, "a", 1, 1); expect(d.nodes[0]!.w).toBeGreaterThanOrEqual(40); expect(d.nodes[0]!.h).toBeGreaterThanOrEqual(24);
    d = setNodeText(d, "a", "Inicio"); expect(d.nodes[0]!.text).toBe("Inicio");
    d = setNodeColor(d, "a", "#ff0000"); expect(d.nodes[0]!.style.fill).toBe("#ff0000");
    d = setNodeColor(d, "a", "palette:green"); expect(d.nodes[0]!.style.fill).toBe("palette:green");
  });
  it("las operaciones sobre un nodo inexistente no cambian nada", () => {
    d = make();
    const before = serializeDiagram(d);
    expect(serializeDiagram(moveNode(d, "zzz", 1, 1))).toBe(before);
    expect(serializeDiagram(setNodeText(d, "zzz", "x"))).toBe(before);
  });
  it("rechaza colores que no son un color válido (se conserva el anterior)", () => {
    d = make();
    const before = d.nodes[0]!.style.fill;
    expect(setNodeColor(d, "a", "rojo-oscuro; background:url(x)").nodes[0]!.style.fill).toBe(before);
  });
  it("no se aceptan coordenadas no finitas", () => {
    d = make();
    expect(moveNode(d, "a", NaN, 5).nodes[0]!.x).toBe(0);
    expect(moveNode(d, "a", Infinity, 5).nodes[0]!.x).toBe(0);
  });
});

describe("conectores", () => {
  it("conecta dos formas con flecha y etiqueta editable", () => {
    d = make();
    const e = must(addEdge(d, "a", "b")); d = e.diagram;
    expect(d.edges).toHaveLength(1);
    d = setEdgeLabel(d, e.edge.id, "sí"); expect(d.edges[0]!.label).toBe("sí");
  });
  it("rechaza extremos inexistentes, un conector de una forma consigo misma y duplicados exactos", () => {
    d = make();
    expect(addEdge(d, "a", "zzz").ok).toBe(false);
    expect(addEdge(d, "a", "a").ok).toBe(false);
    d = must(addEdge(d, "a", "b")).diagram;
    expect(addEdge(d, "a", "b").ok).toBe(false);
    expect(addEdge(d, "b", "a").ok).toBe(true); // el sentido contrario es otro conector
  });
  it("el conector sigue a las formas: cada extremo es la posición actual de su anclaje", () => {
    d = make();
    const e = must(addEdge(d, "a", "b")); d = e.diagram;
    const before = edgeEndpoints(d, e.edge.id)!;
    d = moveNode(d, "b", 500, 300);
    const after = edgeEndpoints(d, e.edge.id)!;
    expect(after.from).toEqual(before.from);
    expect(after.to).not.toEqual(before.to);
    expect(after.to).toEqual({ x: 500, y: 300 + d.nodes[1]!.h / 2 }); // el anclaje «oeste» de la forma movida
  });
  it("borrar un conector", () => {
    d = make();
    const e = must(addEdge(d, "a", "b")); d = deleteEdge(e.diagram, e.edge.id);
    expect(d.edges).toEqual([]);
  });
});

describe("eliminar una forma libera sus conectores, sin perderlos (T-333, G-047, RF-4, CL-6)", () => {
  it("devuelve cuáles se liberaron; cada uno conserva el extremo libre en la última posición de su anclaje", () => {
    d = make();
    d = must(addEdge(d, "a", "b")).diagram; d = must(addEdge(d, "b", "c")).diagram; d = must(addEdge(d, "a", "c")).diagram;
    const bW = anchorPosition(d.nodes[1]!, "w"), bE = anchorPosition(d.nodes[1]!, "e");
    const r = deleteNode(d, "b");
    expect(r.releasedEdges).toHaveLength(2);
    expect(r.diagram.nodes.map((n) => n.id)).toEqual(["a", "c"]);
    expect(r.diagram.edges).toHaveLength(3); // ningún conector se pierde
    const ab = r.diagram.edges.find((e) => e.id === r.releasedEdges[0]!.id)!;
    expect(ab.to).toEqual(bW); expect(isAttached(ab.from)).toBe(true);
    const bc = r.diagram.edges.find((e) => e.id === r.releasedEdges[1]!.id)!;
    expect(bc.from).toEqual(bE); expect(isAttached(bc.to)).toBe(true);
  });
  it("una forma sin conectores se elimina informando 0", () => {
    d = make();
    expect(deleteNode(d, "c").releasedEdges).toEqual([]);
  });
  it("un conector que salía y llegaba a la misma forma queda con los dos extremos libres", () => {
    d = make();
    d = must(addEdge(d, "a", "a", { fromAnchor: "e", toAnchor: "s" })).diagram;
    const r = deleteNode(d, "a");
    expect(r.releasedEdges).toHaveLength(1);
    expect(r.diagram.edges[0]!.from).toEqual({ x: 140, y: 25 }); expect(r.diagram.edges[0]!.to).toEqual({ x: 70, y: 50 });
  });
  it("propiedad: tras cualquier secuencia de operaciones nunca hay conectores huérfanos ni ids repetidos", () => {
    const op = fc.oneof(
      fc.record({ k: fc.constant("add" as const), s: fc.constantFrom(...SHAPES), x: fc.integer({ min: -500, max: 500 }), y: fc.integer({ min: -500, max: 500 }) }),
      fc.record({ k: fc.constant("edge" as const), a: fc.nat(10), b: fc.nat(10) }),
      fc.record({ k: fc.constant("del" as const), a: fc.nat(10) }),
      fc.record({ k: fc.constant("move" as const), a: fc.nat(10), x: fc.integer(), y: fc.integer() }),
    );
    fc.assert(fc.property(fc.array(op, { maxLength: 60 }), (ops) => {
      let x = emptyDiagram();
      for (const o of ops) {
        const ids = x.nodes.map((n) => n.id);
        if (o.k === "add") x = addNode(x, { shape: o.s, x: o.x, y: o.y }).diagram;
        else if (o.k === "edge" && ids.length) { const r = addEdge(x, ids[o.a % ids.length]!, ids[o.b % ids.length]!); if (r.ok) x = r.value.diagram; }
        else if (o.k === "del" && ids.length) x = deleteNode(x, ids[o.a % ids.length]!).diagram;
        else if (o.k === "move" && ids.length) x = moveNode(x, ids[o.a % ids.length]!, o.x, o.y);
      }
      const ids = new Set(x.nodes.map((n) => n.id));
      expect(ids.size).toBe(x.nodes.length);
      for (const e of x.edges) { for (const end of [e.from, e.to]) if (isAttached(end)) expect(ids.has(end.node)).toBe(true); }
      expect(new Set(x.edges.map((e) => e.id)).size).toBe(x.edges.length);
    }), { numRuns: 300 });
  });
});

describe("ajustar a pantalla y centrar (T-335, CL-8, CL-9)", () => {
  const vp = { w: 800, h: 600 };
  it("un diagrama vacío: límites nulos y la vista por defecto", () => {
    expect(diagramBounds(emptyDiagram())).toBeNull();
    expect(fitToView(emptyDiagram(), vp)).toEqual({ zoom: 1, x: 0, y: 0 });
  });
  it("límites que contienen todas las formas", () => {
    const b = diagramBounds(make())!;
    expect(b.x).toBe(0); expect(b.y).toBe(0);
    expect(b.x + b.w).toBeGreaterThanOrEqual(600 + make().nodes[2]!.w);
  });
  it("ajustar a pantalla deja TODO visible aunque haya elementos muy lejos", () => {
    let x = make();
    x = addNode(x, { shape: "note", x: 20_000, y: -15_000, id: "lejos" }).diagram;
    const v = fitToView(x, vp, 20);
    expect(v.zoom).toBeGreaterThan(0); expect(v.zoom).toBeLessThanOrEqual(1);
    for (const n of x.nodes) {
      const sx = n.x * v.zoom + v.x, sy = n.y * v.zoom + v.y;
      expect(sx).toBeGreaterThanOrEqual(-0.5); expect(sy).toBeGreaterThanOrEqual(-0.5);
      expect(sx + n.w * v.zoom).toBeLessThanOrEqual(vp.w + 0.5); expect(sy + n.h * v.zoom).toBeLessThanOrEqual(vp.h + 0.5);
    }
  });
  it("un diagrama pequeño no se amplía más de 1 (no se agranda de más)", () => {
    expect(fitToView(addNode(emptyDiagram(), { shape: "process", x: 0, y: 0 }).diagram, vp).zoom).toBe(1);
  });
  it("centrar en un punto lo deja en el centro de la vista", () => {
    const v = centerOn({ x: 1000, y: 500 }, vp, 2);
    expect({ x: 1000 * 2 + v.x, y: 500 * 2 + v.y }).toEqual({ x: vp.w / 2, y: vp.h / 2 });
    expect(v.zoom).toBe(2);
  });
  it("centrar en cualquiera de los extremos de un conector muy largo", () => {
    let x = make();
    x = addNode(x, { shape: "note", x: 50_000, y: 0, id: "lejos" }).diagram;
    const e = must(addEdge(x, "a", "lejos")); x = e.diagram;
    const ep = edgeEndpoints(x, e.edge.id)!;
    const vFrom = centerOnEdgeEnd(x, e.edge.id, "from", vp, 1)!;
    const vTo = centerOnEdgeEnd(x, e.edge.id, "to", vp, 1)!;
    expect({ x: ep.from.x + vFrom.x, y: ep.from.y + vFrom.y }).toEqual({ x: 400, y: 300 });
    expect({ x: ep.to.x + vTo.x, y: ep.to.y + vTo.y }).toEqual({ x: 400, y: 300 });
    expect(centerOnEdgeEnd(x, "no-existe", "from", vp, 1)).toBeNull();
  });
});

describe("serialización (T-323)", () => {
  it("ida y vuelta sin pérdida y con el mismo texto (determinista)", () => {
    d = make(); d = must(addEdge(d, "a", "b")).diagram; d = setNodeText(d, "a", "Inicio ñ é");
    const text = serializeDiagram(d);
    expect(serializeDiagram(must(parseDiagram(text)))).toBe(text);
    expect(must(parseDiagram(text))).toEqual(d);
  });
  it("un texto vacío es un diagrama vacío", () => {
    expect(must(parseDiagram(""))).toEqual(emptyDiagram());
  });
  it("datos dañados o incoherentes se rechazan con error, sin lanzar", () => {
    for (const bad of ["{ roto", "[]", '{"nodes":5,"edges":[]}', '{"nodes":[{"id":"a"}],"edges":[]}', JSON.stringify({ nodes: [], edges: [{ id: "e", from: "x", to: "y", label: "" }] })]) {
      expect(parseDiagram(bad).ok, bad).toBe(false);
    }
  });
  it("las formas desconocidas se rechazan", () => {
    expect(parseDiagram(JSON.stringify({ nodes: [{ id: "a", shape: "mapa", x: 0, y: 0, w: 100, h: 50, text: "", color: "#fff" }], edges: [] })).ok).toBe(false);
  });
});

describe("texto para búsqueda (T-352)", () => {
  it("junta el texto de formas y de conectores", () => {
    d = make(); d = setNodeText(d, "a", "Inicio del proceso"); d = setNodeText(d, "c", "¿Aprobado?");
    d = must(addEdge(d, "a", "c")).diagram; d = setEdgeLabel(d, d.edges[0]!.id, "revisar");
    const t = diagramText(d);
    for (const w of ["Inicio del proceso", "¿Aprobado?", "revisar"]) expect(t).toContain(w);
  });
});

describe("deshacer y rehacer (T-336)", () => {
  it("cada cambio se puede deshacer y rehacer en orden", () => {
    const h = new DiagramHistory(make());
    h.push(moveNode(h.current, "a", 10, 10));
    h.push(setNodeText(h.current, "a", "uno"));
    expect(h.current.nodes[0]).toMatchObject({ x: 10, text: "uno" });
    expect(h.undo()!.nodes[0]!.text).toBe(""); expect(h.current.nodes[0]!.x).toBe(10);
    expect(h.undo()!.nodes[0]!.x).toBe(0);
    expect(h.canUndo).toBe(false); expect(h.undo()).toBeNull();
    expect(h.redo()!.nodes[0]!.x).toBe(10);
    expect(h.redo()!.nodes[0]!.text).toBe("uno");
    expect(h.canRedo).toBe(false);
  });
  it("un cambio nuevo tras deshacer descarta lo que se podía rehacer", () => {
    const h = new DiagramHistory(make());
    h.push(moveNode(h.current, "a", 1, 1)); h.undo();
    h.push(moveNode(h.current, "a", 2, 2));
    expect(h.canRedo).toBe(false);
  });
  it("un cambio que no cambia nada no añade un paso", () => {
    const h = new DiagramHistory(make());
    h.push(h.current); h.push(moveNode(h.current, "a", 0, 0));
    expect(h.canUndo).toBe(false);
  });
  it("el historial está acotado", () => {
    const h = new DiagramHistory(make(), 5);
    for (let i = 1; i <= 20; i++) h.push(moveNode(h.current, "a", i, i));
    let n = 0; while (h.undo()) n++;
    expect(n).toBe(5);
  });
});

describe("el bloque «diagram» en el documento (T-323, T-352)", () => {
  const block = (data: string): Block => ({ id: "dg1", type: "diagram", props: { data }, content: undefined, children: [] });
  it("hace ida y vuelta por Yjs sin perder nada", () => {
    let x = make(); x = must(addEdge(x, "a", "b")).diagram; x = setNodeText(x, "a", "Inicio");
    const doc = new Y.Doc();
    toYjs([block(serializeDiagram(x))], doc.getXmlFragment("doc"));
    const back = fromYjs(doc.getXmlFragment("doc"));
    expect(back).toEqual([block(serializeDiagram(x))]);
    expect(must(parseDiagram(String(back[0]!.props.data)))).toEqual(x);
  });
  it("una etiqueta de forma o de conector se encuentra al buscar", () => {
    let x = make(); x = setNodeText(x, "a", "Aprobación del gerente"); x = must(addEdge(x, "a", "b")).diagram; x = setEdgeLabel(x, x.edges[0]!.id, "rechazado");
    const text = blocksToPlainText([block(serializeDiagram(x))]);
    expect(text).toContain("Aprobación del gerente");
    expect(text).toContain("rechazado");
  });
  it("un diagrama dañado no rompe la extracción de texto", () => {
    expect(blocksToPlainText([block("{ roto")])).toBe("");
  });
  it("el respaldo en Markdown lo describe de forma legible", () => {
    let x = make(); x = setNodeText(x, "a", "Inicio"); x = setNodeText(x, "b", "Revisar"); x = must(addEdge(x, "a", "b")).diagram;
    const md = blocksToMarkdown([block(serializeDiagram(x))]);
    expect(md).toContain("Diagrama");
    expect(md).toContain("Inicio");
    expect(md).toContain("Revisar");
    expect(md).toContain("> - Inicio (derecha) → Revisar (izquierda)");
  });
  it("los extremos libres se leen «(extremo libre)» y cada punto de unión por su nombre (G-079)", () => {
    let x = make(); x = setNodeText(x, "a", "Inicio");
    x = must(connect(x, { node: "a", anchor: "s" }, { x: 5, y: 5 })).diagram;
    x = setEdgeLabel(x, x.edges[0]!.id, "pendiente");
    expect(blocksToMarkdown([block(serializeDiagram(x))])).toContain("> - Inicio (abajo) → (extremo libre) (pendiente)");
  });
});

describe("modelo v2: estilo, extremos y serialización (G-021 a G-024, G-032, G-033)", () => {
  const example = {
    version: 2,
    nodes: [
      { id: "n1", shape: "terminator", x: 0, y: 0, w: 140, h: 50, text: "Inicio", style: { fill: "palette:green", fillOpacity: 1, stroke: "palette:ink", strokeWidth: 2, strokeDash: "solid", textColor: "palette:ink" } },
      { id: "n2", shape: "decision", x: 0, y: 140, w: 140, h: 80, text: "¿Válido?", style: { fill: "#fff3b0", fillOpacity: 0.6, stroke: "#b45309", strokeWidth: 2, strokeDash: "dashed", textColor: "#3b2400" } },
    ],
    edges: [
      { id: "e1", from: { node: "n1", anchor: "s" }, to: { node: "n2", anchor: "n" }, route: "orthogonal", waypoints: [], label: "", style: { color: "palette:ink", width: "medium", dash: "solid", startCap: "none", endCap: "arrow", textColor: "palette:ink" } },
      { id: "e2", from: { node: "n2", anchor: "e" }, to: { x: 320, y: 180 }, route: "free", points: [{ x: 240, y: 180 }], smooth: true, label: "no", style: { color: "#dc2626", width: "thick", dash: "dotted", startCap: "circle", endCap: "arrow", textColor: "#dc2626" } },
    ],
  };
  it("un diagrama vacío nace en la versión 2", () => {
    expect(JSON.parse(serializeDiagram(emptyDiagram()))).toEqual({ version: 2, nodes: [], edges: [] });
  });
  it("lee el ejemplo del plan (con extremo libre y trazado libre) sin cambios", () => {
    const r = parseDiagram(JSON.stringify(example));
    expect(r.ok).toBe(true);
    expect(JSON.parse(serializeDiagram(must(r)))).toEqual(example);
  });
  it("una forma nueva nace con el estilo del sistema y acepta un estilo parcial", () => {
    const a = addNode(emptyDiagram(), { shape: "note", x: 0, y: 0, color: "#ff0000" }).node;
    expect(a.style).toMatchObject({ fill: "#ff0000", stroke: "palette:ink", strokeDash: "dashed" });
  });
  it("un conector nuevo sale del lado este y llega al oeste, con trazado redondeado y flecha (como se dibujaba)", () => {
    const e = must(addEdge(make(), "a", "b")).edge;
    expect(e).toMatchObject({ from: { node: "a", anchor: "e" }, to: { node: "b", anchor: "w" }, route: "curved", label: "" });
    expect(e.style.endCap).toBe("arrow");
  });
  it("la posición de los extremos viene del anclaje de cada forma, y un extremo libre es su punto", () => {
    const d2 = must(parseDiagram(JSON.stringify(example)));
    expect(edgeEndpoints(d2, "e1")).toEqual({ from: anchorPosition(d2.nodes[0]!, "s"), to: anchorPosition(d2.nodes[1]!, "n") });
    expect(edgeEndpoints(d2, "e2")!.to).toEqual({ x: 320, y: 180 });
  });
  it("errores legibles, sin lanzar", () => {
    const withEdge = (edge: object) => JSON.stringify({ ...example, edges: [edge] });
    const e1 = example.edges[0]!;
    const cases: Record<string, string> = {
      "ids de forma repetidos": JSON.stringify({ ...example, nodes: [example.nodes[0], example.nodes[0]] }),
      "ids de conector repetidos": JSON.stringify({ ...example, edges: [e1, e1] }),
      "extremo a forma inexistente": withEdge({ ...e1, to: { node: "zz", anchor: "n" } }),
      "anclaje desconocido": withEdge({ ...e1, from: { node: "n1", anchor: "norte" } }),
      "extremo libre con número no finito": withEdge({ ...e1, to: { x: null, y: 3 } }),
      "trazado desconocido": withEdge({ ...e1, route: "zigzag" }),
      "punta desconocida": withEdge({ ...e1, style: { ...e1.style, endCap: "flecha" } }),
      "color inválido": JSON.stringify({ ...example, nodes: [{ ...example.nodes[0], style: { ...example.nodes[0]!.style, fill: "rojo" } }, example.nodes[1]] }),
      "tamaño no finito": JSON.stringify({ ...example, nodes: [{ ...example.nodes[0], w: "ancho" }, example.nodes[1]] }),
      "punto de control inválido": withEdge({ ...e1, route: "free", points: [{ x: "a", y: 1 }] }),
    };
    for (const [name, text] of Object.entries(cases)) { const r = parseDiagram(text); expect(r.ok, name).toBe(false); }
  });
  it("una versión mayor devuelve UNSUPPORTED_VERSION", () => {
    const r = parseDiagram(JSON.stringify({ ...example, version: 3 }));
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error.code).toBe("UNSUPPORTED_VERSION");
  });
  it("un estilo ausente o incompleto se completa con el del sistema", () => {
    const sparse = { version: 2, nodes: [{ id: "a", shape: "process", x: 0, y: 0, w: 100, h: 50, text: "" }], edges: [] };
    const r = must(parseDiagram(JSON.stringify(sparse)));
    expect(r.nodes[0]!.style).toEqual({ fill: "palette:blue", fillOpacity: 1, stroke: "palette:ink", strokeWidth: 2, strokeDash: "solid", textColor: "palette:ink" });
  });
  it("serialización estable: leer → escribir → leer da los mismos bytes", () => {
    const once = serializeDiagram(must(parseDiagram(JSON.stringify(example))));
    expect(serializeDiagram(must(parseDiagram(once)))).toBe(once);
    expect(once).toBe(serializeDiagram(must(parseDiagram(JSON.stringify(example, null, 4))))); // el formato de entrada no importa
  });
});

describe("regla SAME_ANCHOR (G-032)", () => {
  it("el mismo anclaje de la misma forma en ambos extremos se rechaza", () => {
    const d2 = make();
    const r = addEdge(d2, "a", "a", { fromAnchor: "e", toAnchor: "e" });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error.details).toMatchObject({ reason: "SAME_ANCHOR" });
  });
  it("anclajes distintos de la misma forma se permiten si se piden explícitamente", () => {
    expect(addEdge(make(), "a", "a", { fromAnchor: "e", toAnchor: "s" }).ok).toBe(true);
  });
  it("sin anclajes explícitos, un conector de una forma consigo misma sigue rechazándose", () => {
    expect(addEdge(make(), "a", "a").ok).toBe(false);
  });
});

describe("conectar con extremos explícitos (G-042, RF-2, RF-5)", () => {
  it("crea un conector entre los anclajes elegidos, de cualquier forma y con el trazado pedido", () => {
    const r = must(connect(make(), { node: "a", anchor: "s" }, { node: "c", anchor: "n" }, { route: "orthogonal" }));
    expect(r.edge).toMatchObject({ from: { node: "a", anchor: "s" }, to: { node: "c", anchor: "n" }, route: "orthogonal", label: "" });
    expect(r.diagram.edges).toHaveLength(1);
  });
  it("rechaza formas inexistentes, el mismo anclaje en ambos extremos y duplicados exactos", () => {
    expect(connect(make(), { node: "zz", anchor: "n" }, { node: "a", anchor: "n" }).ok).toBe(false);
    const same = connect(make(), { node: "a", anchor: "n" }, { node: "a", anchor: "n" });
    expect(!same.ok && same.error.details).toMatchObject({ reason: "SAME_ANCHOR" });
    const first = must(connect(make(), { node: "a", anchor: "e" }, { node: "b", anchor: "w" })).diagram;
    expect(connect(first, { node: "a", anchor: "e" }, { node: "b", anchor: "w" }).ok).toBe(false);
    expect(connect(first, { node: "a", anchor: "s" }, { node: "b", anchor: "w" }).ok).toBe(true); // otro anclaje: otro conector
  });
  it("permite unir dos anclajes distintos de la misma forma", () => {
    expect(connect(make(), { node: "a", anchor: "e" }, { node: "a", anchor: "s" }).ok).toBe(true);
  });
});

describe("reubicar y despegar extremos (G-043, G-044, RF-2, RF-4)", () => {
  const base = () => { const r = must(connect(make(), { node: "a", anchor: "e" }, { node: "b", anchor: "w" })); return { d: r.diagram, id: r.edge.id }; };
  it("mover un extremo a otro anclaje de la misma o de otra forma deja el otro extremo intacto", () => {
    const { d: d0, id } = base();
    const r1 = must(reconnectEnd(d0, id, "to", { node: "b", anchor: "n" }));
    expect(r1.edges[0]!.to).toEqual({ node: "b", anchor: "n" }); expect(r1.edges[0]!.from).toEqual({ node: "a", anchor: "e" });
    const r2 = must(reconnectEnd(d0, id, "from", { node: "c", anchor: "w" }));
    expect(r2.edges[0]!.from).toEqual({ node: "c", anchor: "w" }); expect(r2.edges[0]!.to).toEqual({ node: "b", anchor: "w" });
  });
  it("rechaza anclajes de formas inexistentes o que dejarían ambos extremos en el mismo punto", () => {
    const { d: d0, id } = base();
    expect(reconnectEnd(d0, id, "to", { node: "zz", anchor: "n" }).ok).toBe(false);
    expect(reconnectEnd(d0, id, "to", { node: "a", anchor: "e" }).ok).toBe(false);
    expect(reconnectEnd(d0, "no-existe", "to", { node: "b", anchor: "n" }).ok).toBe(false);
  });
  it("despegar deja el extremo libre en la posición actual del anclaje; moverlo cambia solo su punto", () => {
    const { d: d0, id } = base();
    const at = anchorPosition(d0.nodes[1]!, "w");
    const r = must(detachEnd(d0, id, "to"));
    expect(r.edges[0]!.to).toEqual(at); expect(r.edges[0]!.from).toEqual({ node: "a", anchor: "e" });
    const moved = must(moveFreeEnd(r, id, "to", { x: 333, y: -44 }));
    expect(moved.edges[0]!.to).toEqual({ x: 333, y: -44 });
  });
  it("un extremo libre puede volver a unirse a un anclaje", () => {
    const { d: d0, id } = base();
    const free = must(detachEnd(d0, id, "to"));
    expect(must(reconnectEnd(free, id, "to", { node: "c", anchor: "n" })).edges[0]!.to).toEqual({ node: "c", anchor: "n" });
  });
  it("mover el punto de un extremo unido, con coordenadas no finitas o un conector inexistente, se rechaza", () => {
    const { d: d0, id } = base();
    expect(moveFreeEnd(d0, id, "to", { x: 1, y: 1 }).ok).toBe(false); // está unido
    const free = must(detachEnd(d0, id, "to"));
    expect(moveFreeEnd(free, id, "to", { x: NaN, y: 1 }).ok).toBe(false);
    expect(detachEnd(d0, "no-existe", "to").ok).toBe(false);
  });
});

describe("conectores con ambos extremos libres (G-045, RF-4, CL-5)", () => {
  const free = () => must(connect(make(), { x: 10, y: 20 }, { x: 110, y: 220 }));
  it("se crean, se mueven enteros y se borran", () => {
    const r = free(); expect(r.edge.from).toEqual({ x: 10, y: 20 });
    const moved = must(moveFreeEdge(r.diagram, r.edge.id, 5, -5));
    expect(moved.edges[0]).toMatchObject({ from: { x: 15, y: 15 }, to: { x: 115, y: 215 } });
    expect(deleteEdge(moved, r.edge.id).edges).toEqual([]);
  });
  it("al mover un conector con un extremo unido solo se desplaza el extremo libre", () => {
    const r = must(connect(make(), { node: "a", anchor: "e" }, { x: 500, y: 500 }));
    const moved = must(moveFreeEdge(r.diagram, r.edge.id, 10, 10));
    expect(moved.edges[0]!.from).toEqual({ node: "a", anchor: "e" }); expect(moved.edges[0]!.to).toEqual({ x: 510, y: 510 });
  });
  it("sus extremos son sus puntos y sobreviven a la serialización", () => {
    const r = free();
    expect(edgeEndpoints(r.diagram, r.edge.id)).toEqual({ from: { x: 10, y: 20 }, to: { x: 110, y: 220 } });
    expect(must(parseDiagram(serializeDiagram(r.diagram)))).toEqual(r.diagram);
  });
});

describe("seguimiento al mover y redimensionar (G-046, RF-3, CL-3)", () => {
  for (const shape of SHAPES) {
    it(`${shape}: el conector conserva su anclaje y su extremo sigue al anclaje`, () => {
      let x = emptyDiagram();
      x = addNode(x, { shape, x: 0, y: 0, id: "s" }).diagram; x = addNode(x, { shape: "process", x: 400, y: 0, id: "t" }).diagram;
      const e = must(connect(x, { node: "s", anchor: "se" }, { node: "t", anchor: "w" })); x = e.diagram;
      x = moveNode(x, "s", 50, 70);
      expect(x.edges[0]!.from).toEqual({ node: "s", anchor: "se" });
      expect(edgeEndpoints(x, e.edge.id)!.from).toEqual(anchorPosition(x.nodes[0]!, "se"));
      x = resizeNode(x, "s", 300, 200);
      expect(x.edges[0]!.from).toEqual({ node: "s", anchor: "se" });
      expect(edgeEndpoints(x, e.edge.id)!.from).toEqual(anchorPosition(x.nodes[0]!, "se"));
      x = resizeNode(x, "s", 1, 1); // tamaño mínimo
      expect(x.edges[0]!.from).toEqual({ node: "s", anchor: "se" });
    });
  }
});

describe("varios conectores en el mismo anclaje (G-048, CL-2)", () => {
  it("tres conectores pueden terminar en el mismo anclaje", () => {
    let x = make();
    x = addNode(x, { shape: "note", x: 0, y: 300, id: "d" }).diagram;
    for (const from of ["a", "c", "d"]) x = must(connect(x, { node: from, anchor: "e" }, { node: "b", anchor: "w" })).diagram;
    expect(x.edges.filter((e) => isAttached(e.to) && e.to.node === "b" && e.to.anchor === "w")).toHaveLength(3);
  });
});

describe("radio del imán (G-049, RF-2, CL-12)", () => {
  it("16 px de pantalla se convierten a unidades del lienzo según el zoom", () => {
    expect(magnetRadius(1)).toBe(16); expect(magnetRadius(0.5)).toBe(32); expect(magnetRadius(4)).toBe(4);
  });
  it("con puntero grueso son 24 px", () => {
    expect(magnetRadius(1, true)).toBe(24); expect(magnetRadius(0.5, true)).toBe(48);
  });
  it("un zoom no válido usa 1", () => { expect(magnetRadius(0)).toBe(16); expect(magnetRadius(NaN)).toBe(16); });
});

describe("historial de la conexión (G-050, RF-17)", () => {
  it("conectar, reubicar, despegar y borrar una forma con conectores son un paso cada uno, con deshacer y rehacer exactos", () => {
    const h = new DiagramHistory(make());
    const c = must(connect(h.current, { node: "a", anchor: "e" }, { node: "b", anchor: "w" })); h.push(c.diagram);
    h.push(must(reconnectEnd(h.current, c.edge.id, "to", { node: "b", anchor: "n" })));
    h.push(must(detachEnd(h.current, c.edge.id, "from")));
    h.push(deleteNode(h.current, "b").diagram);
    const states = [serializeDiagram(h.current)];
    let steps = 0;
    while (h.undo()) { steps++; states.unshift(serializeDiagram(h.current)); }
    expect(steps).toBe(4);
    expect(states[0]).toBe(serializeDiagram(make()));
    while (h.redo()) { /* rehacer hasta el final */ }
    expect(serializeDiagram(h.current)).toBe(states[states.length - 1]);
  });
});

describe("trazado: operaciones del modelo (G-098, G-100, G-103, G-104, G-105, G-106)", () => {
  const base = () => { const r = must(connect(make(), { node: "a", anchor: "e" }, { node: "b", anchor: "w" })); return { d: r.diagram, id: r.edge.id }; };
  it("un conector nuevo nace con el trazado de 90° (G-105)", () => { expect(base().d.edges[0]!.route).toBe("orthogonal"); });
  it("restablecer la ruta vacía los puntos de paso (G-098)", () => {
    const { d: d0, id } = base();
    const withPins = must(setWaypoints(d0, id, [{ x: 1, y: 2 }]));
    expect(withPins.edges[0]!.waypoints).toEqual([{ x: 1, y: 2 }]);
    expect(must(resetRoute(withPins, id)).edges[0]!.waypoints).toEqual([]);
  });
  it("los puntos de paso solo se aceptan en el trazado de 90° y deben ser finitos", () => {
    const { d: d0, id } = base();
    expect(setWaypoints(d0, id, [{ x: NaN, y: 0 }]).ok).toBe(false);
    const curved = must(setRoute(d0, id, "curved")).diagram;
    expect(setWaypoints(curved, id, [{ x: 1, y: 1 }]).ok).toBe(false);
  });
  it("la curvatura se limita a 0,2–1 y se conserva al mover las formas (G-100)", () => {
    const { d: d0, id } = base();
    const curved = must(setRoute(d0, id, "curved")).diagram;
    expect(must(setCurvature(curved, id, 5)).edges[0]!.curvature).toBe(1);
    expect(must(setCurvature(curved, id, 0)).edges[0]!.curvature).toBe(0.2);
    const set = must(setCurvature(curved, id, 0.7));
    expect(moveNode(set, "b", 900, 900).edges[0]!.curvature).toBe(0.7);
    expect(setCurvature(d0, id, 0.7).ok).toBe(false); // no es un trazado redondeado
  });
  it("añadir, mover y eliminar un punto de control del trazado libre (G-103)", () => {
    const { d: d0, id } = base();
    let d = must(setRoute(d0, id, "free")).diagram;
    d = must(addControlPoint(d, id, 0, { x: 10, y: 10 }));
    d = must(addControlPoint(d, id, 1, { x: 30, y: 30 }));
    d = must(addControlPoint(d, id, 1, { x: 20, y: 20 }));
    expect(d.edges[0]!.points).toEqual([{ x: 10, y: 10 }, { x: 20, y: 20 }, { x: 30, y: 30 }]);
    d = must(moveControlPoint(d, id, 1, { x: 22, y: 21 }));
    expect(d.edges[0]!.points![1]).toEqual({ x: 22, y: 21 });
    d = must(removeControlPoint(d, id, 0));
    expect(d.edges[0]!.points).toEqual([{ x: 22, y: 21 }, { x: 30, y: 30 }]);
    expect(moveControlPoint(d, id, 9, { x: 0, y: 0 }).ok).toBe(false);
    expect(removeControlPoint(d, id, -1).ok).toBe(false);
    expect(addControlPoint(d, id, 99, { x: 0, y: 0 }).ok).toBe(false);
    expect(addControlPoint(d0, id, 0, { x: 0, y: 0 }).ok).toBe(false); // no es un trazado libre
  });
  it("el suavizado se alterna sin perder los puntos (G-113)", () => {
    const { d: d0, id } = base();
    let d = must(setRoute(d0, id, "free")).diagram;
    d = must(addControlPoint(d, id, 0, { x: 5, y: 5 }));
    d = must(setSmooth(d, id, true));
    expect(d.edges[0]).toMatchObject({ smooth: true, points: [{ x: 5, y: 5 }] });
    d = must(setSmooth(d, id, false));
    expect(d.edges[0]).toMatchObject({ smooth: false, points: [{ x: 5, y: 5 }] });
  });
  it("cambiar de trazado conserva anclajes, texto y estilo y descarta solo los ajustes del trazado anterior (G-104, CL-9)", () => {
    const { d: d0, id } = base();
    let d = setEdgeLabel(d0, id, "sí");
    d = must(setWaypoints(d, id, [{ x: 1, y: 1 }]));
    d = { ...d, edges: d.edges.map((e) => ({ ...e, style: { ...e.style, color: "#ff0000" } })) };
    const r = must(setRoute(d, id, "curved"));
    expect(r.discarded).toBe(true);
    expect(r.diagram.edges[0]).toMatchObject({ route: "curved", label: "sí", from: { node: "a", anchor: "e" }, to: { node: "b", anchor: "w" }, style: { color: "#ff0000" } });
    expect(r.diagram.edges[0]!.waypoints).toBeUndefined();
  });
  it("cambiar de trazado sin ajustes que perder no avisa, y repetir el mismo trazado no cambia nada", () => {
    const { d: d0, id } = base();
    expect(must(setRoute(d0, id, "free")).discarded).toBe(false);
    const same = must(setRoute(d0, id, "orthogonal"));
    expect(same.discarded).toBe(false); expect(serializeDiagram(same.diagram)).toBe(serializeDiagram(d0));
    expect(setRoute(d0, id, "zigzag" as never).ok).toBe(false);
    expect(setRoute(d0, "no-existe", "curved").ok).toBe(false);
  });
  it("cada acción de trazado es un paso del historial, con deshacer y rehacer exactos (G-106)", () => {
    const { d: d0, id } = base();
    const h = new DiagramHistory(d0);
    h.push(must(setWaypoints(h.current, id, [{ x: 5, y: 6 }])));
    h.push(must(setRoute(h.current, id, "curved")).diagram);
    h.push(must(setCurvature(h.current, id, 0.8)));
    h.push(must(setRoute(h.current, id, "free")).diagram);
    h.push(must(addControlPoint(h.current, id, 0, { x: 1, y: 1 })));
    h.push(must(moveControlPoint(h.current, id, 0, { x: 2, y: 2 })));
    const final = serializeDiagram(h.current);
    let steps = 0; while (h.undo()) steps++;
    expect(steps).toBe(6); expect(serializeDiagram(h.current)).toBe(serializeDiagram(d0));
    while (h.redo()) { /* hasta el final */ }
    expect(serializeDiagram(h.current)).toBe(final);
  });
});


describe("estilo de las formas (G-124, G-125, RF-11)", () => {
  it("cambia relleno, contorno, grosor, línea, texto y opacidad por separado", () => {
    let x = make();
    x = setNodeStyle(x, ["a"], { fill: "palette:red" }); expect(x.nodes[0]!.style.fill).toBe("palette:red");
    x = setNodeStyle(x, ["a"], { stroke: "#b45309" }); expect(x.nodes[0]!.style.stroke).toBe("#b45309");
    x = setNodeStyle(x, ["a"], { strokeWidth: 4 }); expect(x.nodes[0]!.style.strokeWidth).toBe(4);
    x = setNodeStyle(x, ["a"], { strokeDash: "dotted" }); expect(x.nodes[0]!.style.strokeDash).toBe("dotted");
    x = setNodeStyle(x, ["a"], { textColor: "#112233" }); expect(x.nodes[0]!.style.textColor).toBe("#112233");
    x = setNodeStyle(x, ["a"], { fillOpacity: 0.4 }); expect(x.nodes[0]!.style.fillOpacity).toBe(0.4);
    expect(x.nodes[0]!.style).toEqual({ fill: "palette:red", fillOpacity: 0.4, stroke: "#b45309", strokeWidth: 4, strokeDash: "dotted", textColor: "#112233" });
  });
  it("«sin relleno» es un relleno válido y la opacidad solo afecta al relleno (no a contorno ni texto)", () => {
    const x = setNodeStyle(make(), ["a"], { fill: "none", fillOpacity: 0 });
    expect(x.nodes[0]!.style).toMatchObject({ fill: "none", fillOpacity: 0, stroke: "palette:ink", textColor: "palette:ink" });
  });
  it("los valores inválidos se ignoran y no cambian nada; los válidos del mismo cambio sí se aplican", () => {
    const d0 = make();
    expect(serializeDiagram(setNodeStyle(d0, ["a"], { fill: "rojo", strokeWidth: 9 as never, fillOpacity: 2, strokeDash: "x" as never, stroke: "no", textColor: 5 as never }))).toBe(serializeDiagram(d0));
    const mixed = setNodeStyle(d0, ["a"], { fill: "rojo", stroke: "palette:blue" });
    expect(mixed.nodes[0]!.style.fill).toBe(d0.nodes[0]!.style.fill); expect(mixed.nodes[0]!.style.stroke).toBe("palette:blue");
  });
  it("sobre una selección múltiple se aplica a todas y es un solo paso del historial (G-125)", () => {
    const h = new DiagramHistory(make());
    h.push(setNodeStyle(h.current, ["a", "b", "c"], { fill: "palette:green", strokeWidth: 3 }));
    expect(h.current.nodes.every((n) => n.style.fill === "palette:green" && n.style.strokeWidth === 3)).toBe(true);
    h.undo(); expect(h.canUndo).toBe(false);
    expect(h.current.nodes.every((n) => n.style.fill !== "palette:green")).toBe(true);
  });
  it("ids inexistentes se ignoran", () => {
    expect(serializeDiagram(setNodeStyle(make(), ["zz"], { fill: "palette:red" }))).toBe(serializeDiagram(make()));
  });
});

describe("estilo de los conectores (G-135, RF-12)", () => {
  const withEdge = () => { const r = must(connect(make(), { node: "a", anchor: "e" }, { node: "b", anchor: "w" })); return { d: r.diagram, id: r.edge.id }; };
  it("cambia color, grosor, línea, color del texto y la punta de cada extremo", () => {
    const { d: d0, id } = withEdge();
    let d = setEdgeStyle(d0, [id], { color: "#dc2626" }); expect(d.edges[0]!.style.color).toBe("#dc2626");
    d = setEdgeStyle(d, [id], { width: "thick" }); expect(d.edges[0]!.style.width).toBe("thick");
    d = setEdgeStyle(d, [id], { dash: "dashed" }); expect(d.edges[0]!.style.dash).toBe("dashed");
    d = setEdgeStyle(d, [id], { textColor: "palette:blue" }); expect(d.edges[0]!.style.textColor).toBe("palette:blue");
    d = setEdgeStyle(d, [id], { startCap: "circle", endCap: "diamond" }); expect(d.edges[0]!.style).toMatchObject({ startCap: "circle", endCap: "diamond" });
  });
  it("ignora lo inválido y los conectores inexistentes", () => {
    const { d: d0, id } = withEdge();
    expect(serializeDiagram(setEdgeStyle(d0, [id], { color: "rojo", width: "gordo" as never, endCap: "flecha" as never }))).toBe(serializeDiagram(d0));
    expect(serializeDiagram(setEdgeStyle(d0, ["zz"], { color: "#fff" }))).toBe(serializeDiagram(d0));
  });
  it("conectar con un estilo inicial lo aplica (predeterminados)", () => {
    const r = must(connect(make(), { node: "a", anchor: "e" }, { node: "b", anchor: "w" }, { style: { ...must(connect(make(), { x: 0, y: 0 }, { x: 1, y: 1 })).edge.style, width: "thick" } }));
    expect(r.edge.style.width).toBe("thick");
  });
});

describe("búsqueda: solo el texto (G-157)", () => {
  it("el texto de formas y etiquetas se indexa; colores, estilos y coordenadas no", () => {
    let x = make(); x = setNodeText(x, "a", "Aprobación"); x = setNodeStyle(x, ["a"], { fill: "#ff8800", stroke: "palette:red" });
    x = must(connect(x, { node: "a", anchor: "e" }, { node: "b", anchor: "w" })).diagram; x = setEdgeLabel(x, x.edges[0]!.id, "sí");
    x = setEdgeStyle(x, [x.edges[0]!.id], { color: "#dc2626", endCap: "diamond" });
    const t = diagramText(x);
    expect(t).toContain("Aprobación"); expect(t).toContain("sí");
    for (const noise of ["ff8800", "palette", "dc2626", "diamond", "orthogonal", "300", "terminator"]) expect(t, noise).not.toContain(noise);
  });
});
