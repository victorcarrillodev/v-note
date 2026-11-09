// R-054 (prueba primero): ninguna operación del modelo pierde el `view` (alto guardado) del diagrama.
import { describe, it, expect } from "vitest";
import { addNode, addEdge, connect, deleteNode, deleteEdge, moveNode, resizeNode, setNodeText, setNodeStyle, setEdgeStyle, setEdgeLabel, setRoute, setWaypoints, setCurvature, emptyDiagram, type Diagram } from "./diagram";
import { copySelection, pasteClip } from "./clipboard";

const start = (): Diagram => {
  let d: Diagram = { ...emptyDiagram(), view: { height: 600 } };
  d = addNode(d, { shape: "process", x: 0, y: 0, id: "a", text: "A" }).diagram;
  d = addNode(d, { shape: "process", x: 300, y: 0, id: "b", text: "B" }).diagram;
  const r = connect(d, { node: "a", anchor: "e" }, { node: "b", anchor: "w" });
  if (!r.ok) throw new Error("connect");
  return r.value.diagram;
};
const edgeId = (d: Diagram) => d.edges[0]!.id;

describe("el view sobrevive a toda operación", () => {
  const ops: [string, (d: Diagram) => Diagram][] = [
    ["addNode", (d) => addNode(d, { shape: "note", x: 1, y: 1 }).diagram],
    ["moveNode", (d) => moveNode(d, "a", 5, 5)],
    ["resizeNode", (d) => resizeNode(d, "a", 200, 100)],
    ["setNodeText", (d) => setNodeText(d, "a", "x")],
    ["setNodeStyle", (d) => setNodeStyle(d, ["a"], { fill: "palette:red" })],
    ["deleteNode", (d) => deleteNode(d, "a").diagram],
    ["setEdgeStyle", (d) => setEdgeStyle(d, [edgeId(d)], { width: "thick" })],
    ["setEdgeLabel", (d) => setEdgeLabel(d, edgeId(d), "sí")],
    ["deleteEdge", (d) => deleteEdge(d, edgeId(d))],
    ["addEdge", (d) => { const r = addEdge(d, "b", "a"); return r.ok ? r.value.diagram : d; }],
    ["setRoute", (d) => { const r = setRoute(d, edgeId(d), "curved"); return r.ok ? r.value.diagram : d; }],
    ["setWaypoints", (d) => { const r = setWaypoints(d, edgeId(d), [{ x: 100, y: 100 }]); return r.ok ? r.value : d; }],
    ["setCurvature", (d) => { const r = setCurvature(d, edgeId(d), 0.5); return r.ok ? r.value : d; }],
    ["pasteClip", (d) => { const c = copySelection(d, ["a", "b"]); return c ? pasteClip(d, c, 0).diagram : d; }],
  ];
  for (const [name, op] of ops) it(name, () => { expect(op(start()).view).toEqual({ height: 600 }); });
});
