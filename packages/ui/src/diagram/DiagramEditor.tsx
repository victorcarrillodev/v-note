import "@xyflow/react/dist/style.css";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import { Background, ConnectionMode, Controls, Handle, MarkerType, NodeResizer, Position, ReactFlow, ReactFlowProvider, useNodesState, useReactFlow, type Edge, type Node, type NodeProps } from "@xyflow/react";
import { useTranslation } from "react-i18next";
import {
  DiagramHistory, SHAPES, addEdge, addNode, centerOnEdgeEnd, deleteEdge, deleteNode, fitToView, moveNode, parseDiagram, resizeNode, serializeDiagram,
  setEdgeLabel, setNodeColor, setNodeText, type DNode, type Diagram, type Shape,
} from "@vnote/core";

export const COLORS: { id: string; hex: string }[] = [
  { id: "blue", hex: "#dbeafe" }, { id: "green", hex: "#dcfce7" }, { id: "yellow", hex: "#fef9c3" }, { id: "red", hex: "#fee2e2" },
  { id: "purple", hex: "#ede9fe" }, { id: "orange", hex: "#ffedd5" }, { id: "gray", hex: "#e5e7eb" }, { id: "white", hex: "#ffffff" },
];

type NodeData = { shape: Shape; text: string; color: string; label: string; onResize: (id: string, x: number, y: number, w: number, h: number) => void };

const shapeStyle = (shape: Shape, color: string): CSSProperties => {
  const base: CSSProperties = { background: color, border: "2px solid #334155", width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", padding: 6, boxSizing: "border-box", overflow: "hidden", fontSize: 13, color: "#0f172a" };
  switch (shape) {
    case "terminator": return { ...base, borderRadius: 999 };
    case "decision": return { ...base, clipPath: "polygon(50% 0, 100% 50%, 50% 100%, 0 50%)", border: "none", boxShadow: "inset 0 0 0 2px #334155" };
    case "io": return { ...base, transform: "skewX(-15deg)" };
    case "note": return { ...base, borderRadius: 4, borderStyle: "dashed" };
    default: return { ...base, borderRadius: 4 };
  }
};

function ShapeNode({ id, data, selected, positionAbsoluteX, positionAbsoluteY, width, height }: NodeProps<Node<NodeData>>) {
  return (
    <>
      <NodeResizer isVisible={selected} minWidth={40} minHeight={24} onResizeEnd={(_e, p) => data.onResize(id, p.x, p.y, p.width, p.height)} />
      {(["top", "right", "bottom", "left"] as const).map((side) => (
        <Handle key={side} id={side} type="source" style={{ zIndex: 5, width: 10, height: 10 }} position={side === "top" ? Position.Top : side === "right" ? Position.Right : side === "bottom" ? Position.Bottom : Position.Left} />
      ))}
      <div role="group" aria-label={data.label} data-shape={data.shape} data-x={Math.round(positionAbsoluteX)} data-y={Math.round(positionAbsoluteY)} data-w={width} data-h={height} style={shapeStyle(data.shape, data.color)}>
        <span style={data.shape === "io" ? { transform: "skewX(15deg)" } : undefined}>{data.text}</span>
      </div>
    </>
  );
}
const nodeTypes = { shape: ShapeNode };

function Inner({ value, onChange }: { value: string; onChange: (data: string) => void }) {
  const { t } = useTranslation();
  const rf = useReactFlow();
  const box = useRef<HTMLDivElement>(null);
  const initial = useMemo(() => { const r = parseDiagram(value); return r.ok ? r.value : { nodes: [], edges: [] }; }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const history = useRef(new DiagramHistory(initial));
  const [diagram, setDiagram] = useState<Diagram>(initial);
  const [selectedEdge, setSelectedEdge] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [, bump] = useState(0);
  const lastSaved = useRef(serializeDiagram(initial));

  const shapeName = useCallback((s: Shape) => t(`diagram.shape.${s}`), [t]);
  const commit = useCallback((next: Diagram) => {
    history.current.push(next);
    setDiagram(history.current.current);
    const text = serializeDiagram(history.current.current);
    lastSaved.current = text;
    onChange(text);
    bump((n) => n + 1);
  }, [onChange]);
  const apply = (d: Diagram | null) => { if (!d) return; setDiagram(d); const text = serializeDiagram(d); lastSaved.current = text; onChange(text); bump((n) => n + 1); };

  // Si el bloque cambia desde fuera (otra versión del documento), se reemplaza el estado
  useEffect(() => {
    if (value === lastSaved.current || (value === "" && diagram.nodes.length === 0)) return;
    const r = parseDiagram(value);
    if (r.ok) { history.current = new DiagramHistory(r.value); setDiagram(r.value); lastSaved.current = serializeDiagram(r.value); }
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  const onResize = useCallback((id: string, x: number, y: number, w: number, h: number) => commit(moveNode(resizeNode(history.current.current, id, w, h), id, x, y)), [commit]);
  const toRf = useCallback((d: Diagram): Node<NodeData>[] => d.nodes.map((n: DNode) => ({
    id: n.id, type: "shape", position: { x: n.x, y: n.y }, width: n.w, height: n.h, style: { width: n.w, height: n.h },
    data: { shape: n.shape, text: n.text, color: n.color, label: `${shapeName(n.shape)}: ${n.text}`, onResize },
  })), [shapeName, onResize]);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<NodeData>>(toRf(initial));
  useEffect(() => { setNodes((prev) => toRf(diagram).map((n) => ({ ...n, selected: prev.find((p) => p.id === n.id)?.selected ?? false }))); }, [diagram, toRf, setNodes]);

  const edges: Edge[] = useMemo(() => diagram.edges.map((e) => ({
    id: e.id, source: e.from, target: e.to, label: e.label || undefined, markerEnd: { type: MarkerType.ArrowClosed },
    selected: selectedEdge === e.id, ariaLabel: `${t("diagram.connector")}: ${e.label}`, sourceHandle: "right", targetHandle: "left",
  })), [diagram.edges, selectedEdge, t]);

  const viewportSize = () => ({ w: box.current?.clientWidth ?? 800, h: box.current?.clientHeight ?? 400 });
  const fit = () => { const v = fitToView(history.current.current, viewportSize()); void rf.setViewport({ x: v.x, y: v.y, zoom: v.zoom }); };
  const centerEnd = (edgeId: string, end: "from" | "to") => { const v = centerOnEdgeEnd(history.current.current, edgeId, end, viewportSize(), rf.getZoom()); if (v) void rf.setViewport({ x: v.x, y: v.y, zoom: v.zoom }); };

  const addAt = (shape: Shape, p: { x: number; y: number }) => commit(addNode(history.current.current, { shape, x: Math.round(p.x), y: Math.round(p.y) }).diagram);
  const addAtCenter = (shape: Shape) => { const s = viewportSize(); addAt(shape, rf.screenToFlowPosition({ x: (box.current?.getBoundingClientRect().left ?? 0) + s.w / 2 - 70, y: (box.current?.getBoundingClientRect().top ?? 0) + s.h / 2 - 30 })); };

  // Arrastrar una forma desde la paleta con el puntero (también funciona con ratón real automatizado)
  const dragShape = (shape: Shape) => (e: ReactPointerEvent) => {
    e.preventDefault();
    suppressClick.current = false;
    const sx = e.clientX, sy = e.clientY;
    let moved = false;
    const onMove = (m: PointerEvent) => { if (Math.abs(m.clientX - sx) + Math.abs(m.clientY - sy) > 5) moved = true; };
    const onUp = (u: PointerEvent) => {
      window.removeEventListener("pointermove", onMove);
      if (!moved) return; // un clic simple lo gestiona el botón (añade en el centro)
      const r = box.current?.getBoundingClientRect();
      if (r && u.clientX >= r.left && u.clientX <= r.right && u.clientY >= r.top && u.clientY <= r.bottom) addAt(shape, rf.screenToFlowPosition({ x: u.clientX, y: u.clientY }));
      suppressClick.current = true; // si el navegador lanza un clic tras soltar sobre el botón, no se añade otra forma
      setTimeout(() => { suppressClick.current = false; }, 0);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp, { once: true });
  };
  const suppressClick = useRef(false);

  const removeSelection = (nodeIds: string[], edgeIds: string[]) => {
    let d = history.current.current;
    let gone = 0, named = "";
    for (const id of nodeIds) { named = d.nodes.find((n) => n.id === id)?.text.trim() || shapeName(d.nodes.find((n) => n.id === id)?.shape ?? "process"); const r = deleteNode(d, id); gone += r.removedEdges.length; d = r.diagram; }
    for (const id of edgeIds) d = deleteEdge(d, id);
    if (nodeIds.length > 0) setNotice(gone > 0 ? t("diagram.removedWithEdges", { name: named, count: gone }) : t("diagram.removed", { name: named }));
    commit(d);
    setSelectedEdge(null);
  };

  const onKeyDown = (e: ReactKeyboardEvent) => {
    e.stopPropagation(); // el editor de la nota no debe interpretar estas teclas
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === "z") { e.preventDefault(); apply(e.shiftKey ? history.current.redo() : history.current.undo()); }
    else if (mod && e.key.toLowerCase() === "y") { e.preventDefault(); apply(history.current.redo()); }
  };

  const pickedNodes = nodes.filter((n) => n.selected);
  const node = pickedNodes.length === 1 ? diagram.nodes.find((n) => n.id === pickedNodes[0]!.id) : undefined;
  const edge = !node && selectedEdge ? diagram.edges.find((x) => x.id === selectedEdge) : undefined;

  return (
    <div className="flex flex-col gap-2" onKeyDown={onKeyDown} data-testid="diagram" contentEditable={false}>
      <div role="toolbar" aria-label={t("diagram.palette")} className="flex flex-wrap items-center gap-2 text-sm">
        {SHAPES.map((s) => (
          <button key={s} type="button" data-shape-button={s} onPointerDown={dragShape(s)} onClick={() => { if (suppressClick.current) { suppressClick.current = false; return; } addAtCenter(s); }} className="cursor-grab rounded border px-2 py-1">
            {shapeName(s)}
          </button>
        ))}
        <span className="flex-1" />
        <button type="button" disabled={!history.current.canUndo} onClick={() => apply(history.current.undo())}>{t("diagram.undo")}</button>
        <button type="button" disabled={!history.current.canRedo} onClick={() => apply(history.current.redo())}>{t("diagram.redo")}</button>
        <button type="button" onClick={fit}>{t("diagram.fit")}</button>
      </div>

      <div ref={box} style={{ height: 420 }} className="rounded border" role="application" aria-label={t("diagram.canvas")}>
        <ReactFlow
          nodes={nodes} edges={edges} onlyRenderVisibleElements nodeTypes={nodeTypes} onNodesChange={onNodesChange}
          onNodeDragStop={(_e, _n, dragged) => { let d = history.current.current; for (const n of dragged) d = moveNode(d, n.id, Math.round(n.position.x), Math.round(n.position.y)); commit(d); }}
          onConnect={(c) => { if (c.source && c.target) { const r = addEdge(history.current.current, c.source, c.target); if (r.ok) commit(r.value.diagram); else setNotice(r.error.message); } }}
          onEdgesChange={(changes) => {
            // La selección de conectores (por clic o por teclado) llega como cambios «select»
            for (const c of changes) if (c.type === "select") {
              if (c.selected) { setSelectedEdge(c.id); setNodes((ns) => ns.map((n) => (n.selected ? { ...n, selected: false } : n))); }
              else setSelectedEdge((cur) => (cur === c.id ? null : cur));
            }
          }}
          onEdgeClick={(_e, edge) => { setSelectedEdge(edge.id); setNodes((ns) => ns.map((n) => (n.selected ? { ...n, selected: false } : n))); }}
          onNodeClick={() => setSelectedEdge(null)}
          onPaneClick={() => setSelectedEdge(null)}
          onDelete={({ nodes: ns, edges: es }) => removeSelection(ns.map((n) => n.id), es.map((x) => x.id))}
          connectionMode={ConnectionMode.Loose} minZoom={0.02} maxZoom={4} deleteKeyCode={["Backspace", "Delete"]} connectionRadius={30} proOptions={{ hideAttribution: true }}
        >
          <Background />
          <Controls showInteractive={false} aria-label={t("diagram.zoomControls")} />
        </ReactFlow>
      </div>

      {notice && <p role="status" className="text-sm">{notice} <button type="button" onClick={() => setNotice(null)}>{t("diagram.dismiss")}</button></p>}

      {node && (
        <section role="region" aria-label={t("diagram.shapePanel")} className="flex flex-wrap items-end gap-3 rounded border p-2 text-sm">
          <label className="flex flex-col gap-1">{t("diagram.text")}
            <input aria-label={t("diagram.text")} value={node.text} onChange={(e) => commit(setNodeText(history.current.current, node.id, e.target.value))} className="rounded border px-1" />
          </label>
          <label className="flex flex-col gap-1">{t("diagram.color")}
            <select aria-label={t("diagram.color")} value={node.color} onChange={(e) => commit(setNodeColor(history.current.current, node.id, e.target.value))}>
              {COLORS.map((c) => <option key={c.id} value={c.hex}>{t(`diagram.colors.${c.id}`)}</option>)}
              {!COLORS.some((c) => c.hex === node.color) && <option value={node.color}>{node.color}</option>}
            </select>
          </label>
          <button type="button" onClick={() => removeSelection([node.id], [])}>{t("diagram.deleteShape")}</button>
        </section>
      )}
      {edge && (
        <section role="region" aria-label={t("diagram.connectorPanel")} className="flex flex-wrap items-end gap-3 rounded border p-2 text-sm">
          <label className="flex flex-col gap-1">{t("diagram.text")}
            <input aria-label={t("diagram.connectorText")} value={edge.label} onChange={(e) => commit(setEdgeLabel(history.current.current, edge.id, e.target.value))} className="rounded border px-1" />
          </label>
          <button type="button" onClick={() => centerEnd(edge.id, "from")}>{t("diagram.centerFrom")}</button>
          <button type="button" onClick={() => centerEnd(edge.id, "to")}>{t("diagram.centerTo")}</button>
          <button type="button" onClick={() => removeSelection([], [edge.id])}>{t("diagram.deleteConnector")}</button>
        </section>
      )}
    </div>
  );
}

/** Lienzo de diagrama de flujo (RF-9). `value` es el diagrama serializado; `onChange` recibe el nuevo texto en cada cambio. */
export function DiagramEditor(props: { value: string; onChange: (data: string) => void }) {
  return <ReactFlowProvider><Inner {...props} /></ReactFlowProvider>;
}
