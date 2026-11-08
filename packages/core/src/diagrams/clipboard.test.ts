// G-148 a G-156 (prueba primero): copiar y pegar formas (con sus conectores) y estilos dentro de la aplicación.
import { describe, it, expect } from "vitest";
import { copySelection, pasteClip, copyStyle, pasteStyle, isClip } from "./clipboard";
import { addNode, connect, deleteEdge, DiagramHistory, emptyDiagram, isAttached, parseDiagram, serializeDiagram, setNodeColor, setNodeText, type Diagram } from "./diagram";
import { anchorPosition } from "./anchors";

const must = <T,>(r: { ok: boolean; value?: T; error?: { message: string } }): T => { if (!r.ok) throw new Error(r.error?.message); return r.value as T; };
const base = (): Diagram => {
  let d = emptyDiagram();
  d = addNode(d, { shape: "process", x: 0, y: 0, id: "a", text: "A", color: "palette:green" }).diagram;
  d = addNode(d, { shape: "decision", x: 300, y: 0, id: "b", text: "B" }).diagram;
  d = addNode(d, { shape: "note", x: 600, y: 0, id: "c", text: "C" }).diagram;
  d = must(connect(d, { node: "a", anchor: "e" }, { node: "b", anchor: "w" }, { route: "orthogonal" })).diagram;
  d = must(connect(d, { node: "b", anchor: "e" }, { node: "c", anchor: "w" })).diagram;
  return d;
};

describe("copiar (G-148, G-149, G-153)", () => {
  it("copia las formas con los conectores cuyos dos extremos están en la selección", () => {
    const clip = copySelection(base(), ["a", "b"])!;
    expect(clip.nodes.map((n) => n.id)).toEqual(["a", "b"]);
    expect(clip.edges).toHaveLength(2);
    const internal = clip.edges.find((e) => isAttached(e.from) && isAttached(e.to))!;
    expect(internal.from).toMatchObject({ node: "a" }); expect(internal.to).toMatchObject({ node: "b" });
  });
  it("un conector con un solo extremo en la selección se copia con el otro extremo libre en su posición actual", () => {
    const d = base();
    const clip = copySelection(d, ["b"])!;
    expect(clip.edges).toHaveLength(2);
    const fromA = clip.edges.find((e) => !isAttached(e.from))!;
    expect(fromA.from).toEqual(anchorPosition(d.nodes[0]!, "e")); expect(fromA.to).toMatchObject({ node: "b", anchor: "w" });
    const toC = clip.edges.find((e) => !isAttached(e.to))!;
    expect(toC.to).toEqual(anchorPosition(d.nodes[2]!, "w"));
  });
  it("no copia conectores que no tocan la selección ni una selección vacía o inexistente", () => {
    expect(copySelection(base(), ["c"])!.edges).toHaveLength(1);
    expect(copySelection(base(), [])).toBeNull(); expect(copySelection(base(), ["zz"])).toBeNull();
  });
  it("el contenido copiado es independiente del diagrama (no comparte objetos)", () => {
    const d = base(); const clip = copySelection(d, ["a"])!;
    clip.nodes[0]!.text = "cambiado";
    expect(d.nodes[0]!.text).toBe("A");
  });
  it("es solo datos propios: reconocible y sin referencias al sistema ni a funciones", () => {
    const clip = copySelection(base(), ["a"])!;
    expect(isClip(clip)).toBe(true); expect(isClip({})).toBe(false); expect(isClip(null)).toBe(false);
    expect(() => JSON.stringify(clip)).not.toThrow();
  });
});

describe("pegar (G-150, G-151, G-154, G-156)", () => {
  it("crea copias con identificadores nuevos y únicos, y remapea los extremos internos", () => {
    const d = base(); const clip = copySelection(d, ["a", "b"])!;
    const r = pasteClip(d, clip, 0);
    expect(r.diagram.nodes).toHaveLength(5);
    expect(new Set(r.diagram.nodes.map((n) => n.id)).size).toBe(5);
    expect(new Set(r.diagram.edges.map((e) => e.id)).size).toBe(r.diagram.edges.length);
    const pastedIds = new Set(r.nodeIds);
    const internal = r.diagram.edges.filter((e) => r.edgeIds.includes(e.id) && isAttached(e.from) && isAttached(e.to));
    expect(internal).toHaveLength(1);
    expect(pastedIds.has((internal[0]!.from as { node: string }).node) && pastedIds.has((internal[0]!.to as { node: string }).node)).toBe(true);
  });
  it("se desplaza 24 en cada eje y el desplazamiento se acumula: el segundo pegado va a 48", () => {
    const d = base(); const clip = copySelection(d, ["a"])!;
    const one = pasteClip(d, clip, 0), two = pasteClip(d, clip, 1);
    const at = (r: typeof one) => r.diagram.nodes.find((n) => n.id === r.nodeIds[0])!;
    expect([at(one).x, at(one).y]).toEqual([24, 24]); expect([at(two).x, at(two).y]).toEqual([48, 48]);
  });
  it("también desplaza los puntos libres, los puntos de paso y los puntos de control", () => {
    let d = base();
    d = { ...d, edges: [
      { ...d.edges[0]!, waypoints: [{ x: 150, y: 80 }] },
      { ...d.edges[1]!, route: "free" as const, points: [{ x: 450, y: 70 }] },
    ] };
    const clip = copySelection(d, ["a", "b"])!;
    const r = pasteClip(d, clip, 0);
    const pasted = r.diagram.edges.filter((e) => r.edgeIds.includes(e.id));
    expect(pasted.find((e) => e.waypoints)!.waypoints).toEqual([{ x: 174, y: 104 }]);
    const free = pasted.find((e) => e.points)!;
    expect(free.points).toEqual([{ x: 474, y: 94 }]);
    expect(free.to).toEqual({ x: anchorPosition(d.nodes[2]!, "w").x + 24, y: anchorPosition(d.nodes[2]!, "w").y + 24 }); // el extremo libre también
  });
  it("el pegado conserva texto, tamaño y estilo", () => {
    const d = base(); const r = pasteClip(d, copySelection(d, ["a"])!, 0);
    const n = r.diagram.nodes.find((x) => x.id === r.nodeIds[0])!;
    expect(n).toMatchObject({ text: "A", w: d.nodes[0]!.w, h: d.nodes[0]!.h, shape: "process" });
    expect(n.style).toEqual(d.nodes[0]!.style);
  });
  it("se puede pegar en otro diagrama distinto con el mismo aspecto", () => {
    const clip = copySelection(base(), ["a", "b"])!;
    const other = addNode(emptyDiagram(), { shape: "note", x: 0, y: 0, id: "z" }).diagram;
    const r = pasteClip(other, clip, 0);
    expect(r.diagram.nodes).toHaveLength(3);
    expect(must(parseDiagram(serializeDiagram(r.diagram)))).toEqual(r.diagram);
  });
  it("pegar 5 formas es un solo paso del historial y se deshace entero", () => {
    let d = emptyDiagram();
    for (let i = 0; i < 5; i++) d = addNode(d, { shape: "process", x: i * 200, y: 0, id: `n${i}` }).diagram;
    const h = new DiagramHistory(d);
    h.push(pasteClip(h.current, copySelection(h.current, ["n0", "n1", "n2", "n3", "n4"])!, 0).diagram);
    expect(h.current.nodes).toHaveLength(10);
    h.undo(); expect(h.current.nodes).toHaveLength(5); expect(h.canUndo).toBe(false);
  });
});

describe("copiar y pegar estilo (G-152)", () => {
  it("de forma a forma: solo cambia el estilo, no el texto, tamaño, posición ni uniones", () => {
    let d = base(); d = setNodeColor(d, "a", "#ff0000"); d = setNodeText(d, "b", "B conserva");
    const clip = copyStyle(d, "a")!;
    const r = pasteStyle(d, clip, ["b", "c"]);
    expect(r.nodes[1]!.style).toEqual(d.nodes[0]!.style); expect(r.nodes[2]!.style).toEqual(d.nodes[0]!.style);
    expect(r.nodes[1]).toMatchObject({ text: "B conserva", x: 300, y: 0, w: d.nodes[1]!.w, shape: "decision" });
    expect(r.edges).toEqual(d.edges);
  });
  it("de conector a conector: copia el estilo, no las uniones, el trazado ni el texto", () => {
    let d = base(); d = { ...d, edges: [{ ...d.edges[0]!, style: { ...d.edges[0]!.style, color: "#dc2626", width: "thick" as const }, label: "no" }, { ...d.edges[1]!, label: "sí" }] };
    const clip = copyStyle(d, d.edges[0]!.id)!;
    const r = pasteStyle(d, clip, [d.edges[1]!.id]);
    expect(r.edges[1]!.style).toEqual(d.edges[0]!.style);
    expect(r.edges[1]).toMatchObject({ label: "sí", from: d.edges[1]!.from, to: d.edges[1]!.to });
  });
  it("entre tipos distintos no hace nada, y un elemento inexistente no se copia", () => {
    const d = base();
    const clip = copyStyle(d, "a")!;
    expect(pasteStyle(d, clip, [d.edges[0]!.id])).toEqual(d);
    expect(copyStyle(d, "zz")).toBeNull();
    expect(deleteEdge(d, d.edges[0]!.id).edges).toHaveLength(1);
  });
});
