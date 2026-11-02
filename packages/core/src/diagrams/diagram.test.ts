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
  edgeEndpoints, diagramBounds, fitToView, centerOn, centerOnEdgeEnd, serializeDiagram, parseDiagram, diagramText, DiagramHistory, SHAPES, type Diagram,
} from "./diagram";

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
    d = setNodeColor(d, "a", "#ff0000"); expect(d.nodes[0]!.color).toBe("#ff0000");
  });
  it("las operaciones sobre un nodo inexistente no cambian nada", () => {
    d = make();
    const before = serializeDiagram(d);
    expect(serializeDiagram(moveNode(d, "zzz", 1, 1))).toBe(before);
    expect(serializeDiagram(setNodeText(d, "zzz", "x"))).toBe(before);
  });
  it("rechaza colores que no son un color válido (se conserva el anterior)", () => {
    d = make();
    const before = d.nodes[0]!.color;
    expect(setNodeColor(d, "a", "rojo-oscuro; background:url(x)").nodes[0]!.color).toBe(before);
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
  it("el conector sigue a las formas: sus extremos son los centros actuales de cada una", () => {
    d = make();
    const e = must(addEdge(d, "a", "b")); d = e.diagram;
    const before = edgeEndpoints(d, e.edge.id)!;
    d = moveNode(d, "b", 500, 300);
    const after = edgeEndpoints(d, e.edge.id)!;
    expect(after.from).toEqual(before.from);
    expect(after.to).not.toEqual(before.to);
    expect(after.to).toEqual({ x: 500 + d.nodes[1]!.w / 2, y: 300 + d.nodes[1]!.h / 2 });
  });
  it("borrar un conector", () => {
    d = make();
    const e = must(addEdge(d, "a", "b")); d = deleteEdge(e.diagram, e.edge.id);
    expect(d.edges).toEqual([]);
  });
});

describe("eliminar una forma elimina sus conectores explícitamente (T-333)", () => {
  it("devuelve cuántos conectores se eliminaron y cuáles, y no deja ninguno huérfano", () => {
    d = make();
    d = must(addEdge(d, "a", "b")).diagram; d = must(addEdge(d, "b", "c")).diagram; d = must(addEdge(d, "a", "c")).diagram;
    const r = deleteNode(d, "b");
    expect(r.removedEdges).toHaveLength(2);
    expect(r.removedEdges.every((e) => e.from === "b" || e.to === "b")).toBe(true);
    expect(r.diagram.nodes.map((n) => n.id)).toEqual(["a", "c"]);
    expect(r.diagram.edges).toHaveLength(1);
  });
  it("una forma sin conectores se elimina informando 0", () => {
    d = make();
    expect(deleteNode(d, "c").removedEdges).toEqual([]);
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
      for (const e of x.edges) { expect(ids.has(e.from)).toBe(true); expect(ids.has(e.to)).toBe(true); }
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
    expect(md).toContain("→");
  });
});

