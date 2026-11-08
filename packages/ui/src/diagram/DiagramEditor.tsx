import "@xyflow/react/dist/style.css";
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import { Background, ReactFlow, ReactFlowProvider, ViewportPortal, useNodesState, useReactFlow, useStore, type Node } from "@xyflow/react";
import { useTranslation } from "react-i18next";
import {
  DiagramHistory, SHAPES, addEdge, addNode, centerOnEdgeEnd, connect, deleteEdge, deleteNode, emptyDiagram, fitToView, inflate, isAttached, magnetRadius, moveNode,
  nearestAnchor, parseDiagram, reconnectEnd, resizeNode, serializeDiagram, setEdgeLabel, setNodeText,
  applyDefaultsToDiagramParts, copySelection, copyStyle, pasteClip, pasteStyle, setEdgeStyle, setNodeStyle, addControlPoint, connectorPath, curvatureForPoint, insertIndexFor, moveControlPoint, removeControlPoint, resetRoute, routeWithPin, setCurvature, setRoute, setSmooth, setWaypoints,
  type Attached, type DEdge, type DNode, type Diagram, type DiagramDefaults, type Endpoint, type Point, type Route, type Shape,
} from "@vnote/core";
import { AnchorOverlay } from "./AnchorOverlay";
import { CanvasControls } from "./CanvasControls";
import { ConnectorLayer } from "./ConnectorLayer";
import { EdgeEnds } from "./EdgeEnds";
import { RouteControls } from "./RouteControls";
import { EdgeStylePanel, ShapeStylePanel } from "./StylePanels";
import { useDiagramDefaults } from "./DiagramDefaults";
import { diagramClipboard } from "./diagramClipboard";
import { ShapeNode, type NodeData } from "./ShapeNode";
import { endLabel, nodeLabel } from "./labels";

const MIN_ZOOM = 0.02, MAX_ZOOM = 4;
const nodeTypes = { shape: ShapeNode };
/**
 * Los tiradores de redimensión de las esquinas coinciden con los anclajes de las esquinas: se desplazan 14 px (en cada eje) hacia afuera, fuera del área activa del anclaje para que ambos
 * se puedan usar. (Los lados conservan su línea de arrastre; el área activa de un anclaje manda cerca de su punto.)
 */
const RESIZE_CORNER_CSS = [
  ".vn-diagram .react-flow__resize-control.handle.top.left{translate:-14px -14px}",
  ".vn-diagram .react-flow__resize-control.handle.top.right{translate:14px -14px}",
  ".vn-diagram .react-flow__resize-control.handle.bottom.left{translate:-14px 14px}",
  ".vn-diagram .react-flow__resize-control.handle.bottom.right{translate:14px 14px}",
].join("");
const matches = (q: string) => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(q).matches;

/** Gesto en curso: crear un conector desde un anclaje o mover un extremo de uno existente. Se confirma (un solo paso) al soltar. */
type Drag =
  | { kind: "new"; from: Attached; point: Point }
  | { kind: "end"; edgeId: string; end: "from" | "to"; point: Point }
  /** Ajuste del trazado de un conector (tramo, curvatura o punto de control): `apply` calcula el diagrama para cada posición del puntero. */
  | { kind: "edit"; edgeId: string; point: Point; apply: (d: Diagram, p: Point) => Diagram };

/** Funciones con identidad estable que siempre llaman a la versión más reciente: permite memorizar capas hijas sin perder datos nuevos. */
function useLatest<T extends Record<string, (...args: never[]) => unknown>>(fns: T): T {
  const ref = useRef(fns); ref.current = fns;
  return useMemo(() => Object.fromEntries(Object.keys(fns).map((k) => [k, (...args: never[]) => (ref.current[k] as (...a: never[]) => unknown)(...args)])) as T, []); // eslint-disable-line react-hooks/exhaustive-deps
}

function Inner({ value, onChange }: { value: string; onChange: (data: string) => void }) {
  const { t, i18n } = useTranslation();
  const rf = useReactFlow();
  const zoom = useStore((s) => s.transform[2]);
  const box = useRef<HTMLDivElement>(null);
  const coarse = useMemo(() => matches("(pointer: coarse)"), []);
  const initial = useMemo(() => { const r = parseDiagram(value); return r.ok ? r.value : emptyDiagram(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const history = useRef(new DiagramHistory(initial));
  const [diagram, setDiagram] = useState<Diagram>(initial);
  const [selectedEdge, setSelectedEdge] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [hoverNode, setHoverNode] = useState<string | null>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const defaultsApi = useDiagramDefaults();
  const [defaults, setDefaults] = useState<DiagramDefaults>({});
  const defaultsRef = useRef<DiagramDefaults>({});
  defaultsRef.current = defaults;
  useEffect(() => { let off = false; void defaultsApi?.load().then((d) => { if (!off) setDefaults(d); }); return () => { off = true; }; }, [defaultsApi]);
  const selectAfter = useRef<Set<string> | null>(null);
  const [selectedPoint, setSelectedPoint] = useState<{ edgeId: string; index: number } | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const [, bump] = useState(0);
  const lastSaved = useRef(serializeDiagram(initial));

  const shapeName = useCallback((s: Shape) => t(`diagram.shape.${s}`), [t]);
  const commit = useCallback((next: Diagram) => {
    history.current.push(next);
    setDiagram(history.current.current);
    const text = serializeDiagram(history.current.current);
    if (text !== lastSaved.current) { lastSaved.current = text; onChange(text); }
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
    data: { shape: n.shape, text: n.text, style: n.style, label: `${shapeName(n.shape)}: ${n.text}`, onResize },
  })), [shapeName, onResize]);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<NodeData>>(toRf(initial));
  useEffect(() => {
    const pending = selectAfter.current; selectAfter.current = null;
    setNodes((prev) => toRf(diagram).map((n) => ({ ...n, selected: pending ? pending.has(n.id) : prev.find((p) => p.id === n.id)?.selected ?? false })));
  }, [diagram, toRf, setNodes]);

  const viewportSize = () => ({ w: box.current?.clientWidth ?? 800, h: box.current?.clientHeight ?? 400 });
  const animMs = matches("(prefers-reduced-motion: reduce)") ? 0 : 150;
  const fit = () => { const v = fitToView(history.current.current, viewportSize()); void rf.setViewport({ x: v.x, y: v.y, zoom: v.zoom }, { duration: animMs }); };
  const centerEnd = (edgeId: string, end: "from" | "to") => { const v = centerOnEdgeEnd(history.current.current, edgeId, end, viewportSize(), rf.getZoom()); if (v) void rf.setViewport({ x: v.x, y: v.y, zoom: v.zoom }); };

  const addAt = (shape: Shape, p: { x: number; y: number }) => commit(addNode(history.current.current, { shape, x: Math.round(p.x), y: Math.round(p.y), style: applyDefaultsToDiagramParts(defaultsRef.current).node }).diagram);
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
    let freed = 0, named = "";
    for (const id of nodeIds) {
      const n = d.nodes.find((x) => x.id === id);
      named = n ? nodeLabel(t, n) : "";
      const r = deleteNode(d, id); freed += r.releasedEdges.length; d = r.diagram;
    }
    for (const id of edgeIds) d = deleteEdge(d, id);
    if (nodeIds.length > 0) setNotice(freed > 0 ? t("diagram.removedWithEdges", { name: named, count: freed }) : t("diagram.removed", { name: named }));
    commit(d);
    setSelectedEdge(null);
  };

  // --- Conexión por anclajes ---------------------------------------------------------------------------------------------------------
  const toFlow = (e: { clientX: number; clientY: number }): Point => rf.screenToFlowPosition({ x: e.clientX, y: e.clientY });
  const candidateFor = useCallback((p: Point) => nearestAnchor(diagram.nodes, p, magnetRadius(zoom, coarse)), [diagram.nodes, zoom, coarse]);
  const stopDrag = useRef<(() => void) | null>(null);
  const dragEndedAt = useRef(0);
  const cancelDrag = useCallback(() => { stopDrag.current?.(); stopDrag.current = null; dragRef.current = null; setDrag(null); }, []);
  useEffect(() => () => { stopDrag.current?.(); if (hoverTimer.current) clearTimeout(hoverTimer.current); }, []);

  const startDrag = (initialDrag: Drag) => {
    cancelDrag();
    dragRef.current = initialDrag; setDrag(initialDrag);
    const onMove = (m: PointerEvent) => { const cur = dragRef.current; if (!cur) return; const next = { ...cur, point: toFlow(m) } as Drag; dragRef.current = next; setDrag(next); };
    const onUp = (u: PointerEvent) => {
      const cur = dragRef.current; if (!cur) return;
      const p = toFlow(u);
      dragEndedAt.current = Date.now(); // al soltar sobre el fondo el navegador lanza un «clic» sobre él: no debe deseleccionar el conector
      cancelDrag();
      const hit = candidateFor(p);
      const target: Endpoint = hit ? { node: hit.node, anchor: hit.anchor } : p;
      const d = history.current.current;
      if (cur.kind === "edit") { commit(cur.apply(d, p)); return; }
      if (cur.kind === "new") {
        const r = connect(d, cur.from, target, applyDefaultsToDiagramParts(defaultsRef.current).edge);
        if (r.ok) { commit(r.value.diagram); setSelectedEdge(r.value.edge.id); } else setNotice(r.error.message);
      } else {
        const r = reconnectEnd(d, cur.edgeId, cur.end, target);
        if (r.ok) commit(r.value); else setNotice(r.error.message);
      }
    };
    const onKey = (k: KeyboardEvent) => { if (k.key === "Escape") cancelDrag(); };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp, { once: true });
    window.addEventListener("keydown", onKey, true);
    stopDrag.current = () => { window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); window.removeEventListener("keydown", onKey, true); };
  };

  const onAnchorDown = (nodeId: string, e: ReactPointerEvent<SVGElement>) => {
    if (e.button !== 0) return;
    e.preventDefault(); e.stopPropagation();
    const n = diagram.nodes.find((x) => x.id === nodeId);
    if (!n) return;
    const p = toFlow(e);
    // Con zoom muy alejado las áreas activas de los ocho anclajes se solapan: se elige siempre el más cercano al puntero.
    const near = nearestAnchor([n], p, Infinity);
    if (near) startDrag({ kind: "new", from: { node: nodeId, anchor: near.anchor }, point: p });
  };
  const onEndDown = (edgeId: string, end: "from" | "to", e: ReactPointerEvent<SVGElement>) => {
    if (e.button !== 0) return;
    e.preventDefault(); e.stopPropagation();
    startDrag({ kind: "end", edgeId, end, point: toFlow(e) });
  };

  // Ajustes del trazado: cada gesto crea su función `apply`, que da el diagrama para cada posición del puntero (vista previa y resultado final).
  const edgeOf = (id: string) => history.current.current.edges.find((x) => x.id === id);
  const onSegmentDown = (edgeId: string, index: number, e: ReactPointerEvent<SVGElement>) => {
    if (e.button !== 0) return;
    e.preventDefault(); e.stopPropagation();
    const edge = edgeOf(edgeId), path = edge && connectorPath(history.current.current, edge);
    if (!edge || !path?.vertices) return;
    const vertices = path.vertices, pins = edge.waypoints ?? [];
    startDrag({ kind: "edit", edgeId, point: toFlow(e), apply: (d, p) => { const r = setWaypoints(d, edgeId, routeWithPin(vertices, index, p, pins)); return r.ok ? r.value : d; } });
  };
  const onCurveDown = (edgeId: string, e: ReactPointerEvent<SVGElement>) => {
    if (e.button !== 0) return;
    e.preventDefault(); e.stopPropagation();
    const edge = edgeOf(edgeId), path = edge && connectorPath(history.current.current, edge);
    if (!edge || !path) return;
    startDrag({ kind: "edit", edgeId, point: toFlow(e), apply: (d, p) => { const r = setCurvature(d, edgeId, curvatureForPoint(path.start, path.startDir, path.end, path.endDir, p)); return r.ok ? r.value : d; } });
  };
  const onPointDown = (edgeId: string, index: number, e: ReactPointerEvent<SVGElement>) => {
    if (e.button !== 0) return;
    e.preventDefault(); e.stopPropagation();
    setSelectedPoint({ edgeId, index });
    startDrag({ kind: "edit", edgeId, point: toFlow(e), apply: (d, p) => { const r = moveControlPoint(d, edgeId, index, p); return r.ok ? r.value : d; } });
  };
  const applyEdit = (r: { ok: true; value: Diagram } | { ok: false; error: { message: string } }) => { if (r.ok) commit(r.value); else setNotice(r.error.message); };
  const addPointAt = (edgeId: string, p: Point) => {
    const edge = edgeOf(edgeId), path = edge && connectorPath(history.current.current, edge);
    if (!edge || !path) return;
    applyEdit(addControlPoint(history.current.current, edgeId, insertIndexFor(path.start, edge.points ?? [], path.end, p), p));
    setSelectedPoint(null);
  };
  const changeRoute = (edgeId: string, route: Route) => {
    const r = setRoute(history.current.current, edgeId, route);
    if (!r.ok) { setNotice(r.error.message); return; }
    commit(r.value.diagram); setSelectedPoint(null);
    if (r.value.discarded) setNotice(t("diagram.routeDiscarded"));
  };

  // --- Estilo, valores predeterminados y portapapeles (spec 003, RF-11 a RF-14b) ----------------------------------------------------
  const selectedNodeIds = () => nodes.filter((n) => n.selected).map((n) => n.id);
  const copyShapes = () => {
    const clip = copySelection(history.current.current, selectedNodeIds());
    if (!clip) return;
    diagramClipboard.copyShapes(clip);
    setNotice(t("diagram.copiedShapes", { count: clip.nodes.length }));
  };
  const pasteShapes = () => {
    const c = diagramClipboard.shapes();
    if (!c) { setNotice(t("diagram.nothingToPaste")); return; }
    const r = pasteClip(history.current.current, c.clip, c.pastes);
    diagramClipboard.countPaste();
    selectAfter.current = new Set(r.nodeIds);
    setSelectedEdge(null);
    commit(r.diagram);
  };
  const copyFormat = (id: string) => { const f = copyStyle(history.current.current, id); if (f) { diagramClipboard.copyFormat(f); setNotice(t("diagram.formatCopied")); } };
  const pasteFormat = (targets: string[], kind: "node" | "edge") => {
    const f = diagramClipboard.format();
    if (!f || f.kind !== kind || targets.length === 0) { setNotice(t("diagram.noFormatToPaste")); return; }
    commit(pasteStyle(history.current.current, f, targets));
  };
  const shapeDefaults = defaultsApi ? {
    onUse: () => { const st = nodes.filter((n) => n.selected)[0] && diagram.nodes.find((n) => n.id === nodes.filter((x) => x.selected)[0]!.id)?.style; if (!st) return; void defaultsApi.saveShape(st).then(() => { setDefaults((d) => ({ ...d, shape: st })); setNotice(t("diagram.defaultSavedShape")); }); },
    onReset: () => void defaultsApi.reset().then(() => { setDefaults({}); setNotice(t("diagram.defaultsReset")); }),
  } : null;
  const edgeDefaults = (e: DEdge) => (defaultsApi ? {
    onUse: () => void defaultsApi.saveEdge(e.style, e.route).then(() => { setDefaults((d) => ({ ...d, edge: { style: e.style, route: e.route } })); setNotice(t("diagram.defaultSavedEdge")); }),
    onReset: () => void defaultsApi.reset().then(() => { setDefaults({}); setNotice(t("diagram.defaultsReset")); }),
  } : null);

  const hover = (id: string | null) => {
    if (hoverTimer.current) { clearTimeout(hoverTimer.current); hoverTimer.current = null; }
    if (id) setHoverNode(id);
    else hoverTimer.current = setTimeout(() => setHoverNode(null), 150);
  };

  const selectEdge = (id: string) => { setSelectedEdge(id); setSelectedPoint(null); setNodes((ns) => ns.map((n) => (n.selected ? { ...n, selected: false } : n))); };
  const pickedNodes = nodes.filter((n) => n.selected);
  const selectedIds = useMemo(() => new Set(pickedNodes.map((n) => n.id)), [pickedNodes]);

  // Diagrama que se dibuja: durante un gesto muestra la vista previa; nada se guarda hasta soltar.
  const { shown, previewEdge, active } = useMemo(() => {
    if (!drag) return { shown: diagram, previewEdge: null as string | null, active: null };
    if (drag.kind === "edit") return { shown: drag.apply(diagram, drag.point), previewEdge: null as string | null, active: null };
    const hit = candidateFor(drag.point);
    const target: Endpoint = hit ? { node: hit.node, anchor: hit.anchor } : drag.point;
    const active = hit ? { node: hit.node, anchor: hit.anchor } : null;
    if (drag.kind === "new") {
      const r = connect(diagram, drag.from, target, applyDefaultsToDiagramParts(defaults).edge);
      return r.ok ? { shown: r.value.diagram, previewEdge: r.value.edge.id, active } : { shown: diagram, previewEdge: null, active };
    }
    const r = reconnectEnd(diagram, drag.edgeId, drag.end, target);
    return { shown: r.ok ? r.value : diagram, previewEdge: null, active };
  }, [diagram, drag, candidateFor, defaults]);

  const showFor = useMemo(() => {
    const s = new Set<string>(selectedIds);
    if (hoverNode) s.add(hoverNode);
    if (drag && drag.kind !== "edit") { const reach = magnetRadius(zoom, coarse) * 3; for (const n of diagram.nodes) { const b = inflate(n, reach); if (drag.point.x >= b.x && drag.point.x <= b.x + b.w && drag.point.y >= b.y && drag.point.y <= b.y + b.h) s.add(n.id); } }
    return s;
  }, [selectedIds, hoverNode, drag, diagram.nodes, zoom, coarse]);

  const connectorName = (e: DEdge) => {
    const from = endLabel(t, shown, e.from), to = endLabel(t, shown, e.to);
    return e.label.trim() ? t("diagram.connectorNameLabel", { from, to, label: e.label }) : t("diagram.connectorName", { from, to });
  };

  const layerHandlers = useLatest({
    name: connectorName, onSelect: selectEdge, onEndDown, onSegmentDown, onCurveDown, onPointDown,
    onAddPoint: (id: string, x: number, y: number) => addPointAt(id, toFlow({ clientX: x, clientY: y })),
  });

  const onKeyDown = (e: ReactKeyboardEvent) => {
    e.stopPropagation(); // el editor de la nota no debe interpretar estas teclas
    const mod = e.ctrlKey || e.metaKey;
    const inField = (e.target as HTMLElement).closest("input, textarea, select") !== null;
    const letter = (l: string) => e.key.toLowerCase() === l || e.code === `Key${l.toUpperCase()}`;
    if (e.key === "Escape" && dragRef.current) cancelDrag();
    else if (mod && !inField && letter("c")) { e.preventDefault(); if (e.altKey) { const id = selectedEdge ?? selectedNodeIds()[0]; if (id) copyFormat(id); } else copyShapes(); }
    else if (mod && !inField && letter("v")) { e.preventDefault(); if (e.altKey) { if (selectedEdge) pasteFormat([selectedEdge], "edge"); else pasteFormat(selectedNodeIds(), "node"); } else pasteShapes(); }
    else if (mod && e.key.toLowerCase() === "z") { e.preventDefault(); apply(e.shiftKey ? history.current.redo() : history.current.undo()); }
    else if (mod && e.key.toLowerCase() === "y") { e.preventDefault(); apply(history.current.redo()); }
    else if ((e.key === "Delete" || e.key === "Backspace") && selectedPoint && !inField) { e.preventDefault(); applyEdit(removeControlPoint(history.current.current, selectedPoint.edgeId, selectedPoint.index)); setSelectedPoint(null); }
    else if ((e.key === "Delete" || e.key === "Backspace") && selectedEdge && !inField) { e.preventDefault(); removeSelection([], [selectedEdge]); }
  };

  // Solo cuentan las formas que siguen existiendo en el diagrama (la selección de la librería puede ir un instante por detrás al borrar).
  const selectedNodes = diagram.nodes.filter((n) => selectedIds.has(n.id));
  const node = selectedNodes.length === 1 ? selectedNodes[0] : undefined;
  const edge = selectedNodes.length === 0 && selectedEdge ? diagram.edges.find((x) => x.id === selectedEdge) : undefined;

  return (
    <div className="flex flex-col gap-2" onKeyDown={onKeyDown} data-testid="diagram" contentEditable={false}>
      <div role="toolbar" aria-label={t("diagram.palette")} className="flex flex-wrap items-center gap-2 text-sm">
        {SHAPES.map((s) => (
          <button key={s} type="button" data-shape-button={s} onPointerDown={dragShape(s)} onClick={() => { if (suppressClick.current) { suppressClick.current = false; return; } addAtCenter(s); }} className="cursor-grab rounded border px-2 py-1">
            {shapeName(s)}
          </button>
        ))}
        <button type="button" onClick={copyShapes}>{t("diagram.copy")}</button>
        <button type="button" onClick={pasteShapes}>{t("diagram.paste")}</button>
        <span className="flex-1" />
        <button type="button" disabled={!history.current.canUndo} onClick={() => apply(history.current.undo())}>{t("diagram.undo")}</button>
        <button type="button" disabled={!history.current.canRedo} onClick={() => apply(history.current.redo())}>{t("diagram.redo")}</button>
      </div>

      <div ref={box} style={{ height: 420 }} className="vn-diagram relative rounded border" role="application" aria-label={t("diagram.canvas")} aria-description={t("diagram.canvasHint")}>
        <style>{RESIZE_CORNER_CSS}</style>
        <ReactFlow
          nodes={nodes} edges={[]} onlyRenderVisibleElements nodeTypes={nodeTypes} onNodesChange={onNodesChange}
          onNodeDragStop={(_e, _n, dragged) => { let d = history.current.current; for (const n of dragged) d = moveNode(d, n.id, Math.round(n.position.x), Math.round(n.position.y)); commit(d); }}
          onNodeMouseEnter={(_e, n) => hover(n.id)} onNodeMouseLeave={() => hover(null)}
          onNodeClick={() => setSelectedEdge(null)}
          onPaneClick={() => { if (Date.now() - dragEndedAt.current > 400) { setSelectedEdge(null); setSelectedPoint(null); } }}
          onDelete={({ nodes: ns }) => removeSelection(ns.map((n) => n.id), [])}
          minZoom={MIN_ZOOM} maxZoom={MAX_ZOOM} deleteKeyCode={["Backspace", "Delete"]} proOptions={{ hideAttribution: true }}
        >
          <Background />
          <ViewportPortal>
            <ConnectorLayer part="lines" diagram={shown} selectedEdge={selectedEdge} previewEdge={previewEdge} zoom={zoom} coarse={coarse} selectedPoint={selectedPoint} lang={i18n.language} {...layerHandlers} />
            <ConnectorLayer part="handles" diagram={shown} selectedEdge={selectedEdge} previewEdge={previewEdge} zoom={zoom} coarse={coarse} selectedPoint={selectedPoint} lang={i18n.language} {...layerHandlers} />
            <AnchorOverlay diagram={shown} showFor={showFor} selected={selectedIds} active={active} zoom={zoom} coarse={coarse} onAnchorDown={onAnchorDown} onHover={hover} />
          </ViewportPortal>
        </ReactFlow>
        <CanvasControls zoom={zoom} minZoom={MIN_ZOOM} maxZoom={MAX_ZOOM} onZoomIn={() => void rf.zoomIn({ duration: animMs })} onZoomOut={() => void rf.zoomOut({ duration: animMs })} onFit={fit} />
      </div>

      {notice && <p role="status" data-diagram-notice="" className="text-sm">{notice} <button type="button" onClick={() => setNotice(null)}>{t("diagram.dismiss")}</button></p>}

      {selectedNodes.length > 0 && (
        <section role="region" aria-label={t("diagram.shapePanel")} className="flex flex-col gap-2 rounded border p-2 text-sm">
          {node && (
            <div className="flex flex-wrap items-end gap-3">
              <label className="flex flex-col gap-1">{t("diagram.text")}
                <input aria-label={t("diagram.text")} value={node.text} onChange={(e) => commit(setNodeText(history.current.current, node.id, e.target.value))} className="rounded border px-1" />
              </label>
              <button type="button" onClick={() => removeSelection([node.id], [])}>{t("diagram.deleteShape")}</button>
            </div>
          )}
          <ShapeStylePanel
            nodes={selectedNodes}
            onPatch={(patch) => commit(setNodeStyle(history.current.current, [...selectedIds], patch))}
            defaults={shapeDefaults}
            format={{ onCopy: () => { const id = [...selectedIds][0]; if (id) copyFormat(id); }, onPaste: () => pasteFormat([...selectedIds], "node") }}
          />
        </section>
      )}
      {edge && (
        <section role="region" aria-label={t("diagram.connectorPanel")} className="flex flex-col gap-2 rounded border p-2 text-sm">
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1">{t("diagram.text")}
              <input aria-label={t("diagram.connectorText")} value={edge.label} onChange={(e) => commit(setEdgeLabel(history.current.current, edge.id, e.target.value))} className="rounded border px-1" />
            </label>
            <button type="button" onClick={() => centerEnd(edge.id, "from")}>{t("diagram.centerFrom")}</button>
            <button type="button" onClick={() => centerEnd(edge.id, "to")}>{t("diagram.centerTo")}</button>
            <button type="button" onClick={() => removeSelection([], [edge.id])}>{t("diagram.deleteConnector")}</button>
          </div>
          <RouteControls
            edge={edge} onRoute={(r) => changeRoute(edge.id, r)} onReset={() => applyEdit(resetRoute(history.current.current, edge.id))}
            onCurvature={(v) => applyEdit(setCurvature(history.current.current, edge.id, v))} onSmooth={(v) => applyEdit(setSmooth(history.current.current, edge.id, v))}
            onPointChange={(i, p) => applyEdit(moveControlPoint(history.current.current, edge.id, i, p))} onRemovePoint={(i) => applyEdit(removeControlPoint(history.current.current, edge.id, i))}
            onAddPoint={() => { const path = connectorPath(history.current.current, edge); if (!path) return; const P = [path.start, ...(edge.points ?? []), path.end]; const a = P[P.length - 2]!, b = P[P.length - 1]!; addPointAt(edge.id, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }); }}
          />
          <EdgeStylePanel edge={edge} onPatch={(patch) => commit(setEdgeStyle(history.current.current, [edge.id], patch))} defaults={edgeDefaults(edge)} format={{ onCopy: () => copyFormat(edge.id), onPaste: () => pasteFormat([edge.id], "edge") }} />
          <EdgeEnds diagram={diagram} edge={edge} onChange={(end, target) => { const r = reconnectEnd(history.current.current, edge.id, end, target); if (r.ok) commit(r.value); else setNotice(r.error.message); }} />
        </section>
      )}
    </div>
  );
}

/** Lienzo de diagrama de flujo (RF-9). `value` es el diagrama serializado; `onChange` recibe el nuevo texto en cada cambio. */
export function DiagramEditor(props: { value: string; onChange: (data: string) => void }) {
  return <ReactFlowProvider><Inner {...props} /></ReactFlowProvider>;
}
