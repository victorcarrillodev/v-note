import { memo, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import { curveHandle, connectorPath, dashArray, isAttached, pathToSvg, styledPath, EDGE_WIDTH_PX, type CapShape, type DEdge, type Diagram, type Cap } from "@vnote/core";
import { OverlaySvg } from "../design/OverlaySvg";
import { strokeFor } from "../design/diagramPalette";
import { ANCHOR_DOT, Z_ABOVE, Z_BELOW, hitRadiusFlow, hitPx, symbolScale } from "./metrics";

/** Punta de un extremo: la forma la calcula el núcleo y hereda el color de la línea. */
function CapMark({ shape, kind, color }: { shape: CapShape | null; kind: Cap; color: string }) {
  if (!shape) return null;
  return shape.kind === "circle"
    ? <circle data-cap={kind} cx={shape.center.x} cy={shape.center.y} r={shape.r} fill={color} pointerEvents="none" />
    : <polygon data-cap={kind} points={shape.points.map((q) => `${q.x},${q.y}`).join(" ")} fill={color} pointerEvents="none" />;
}

/** Capa de conectores: dibuja el camino del núcleo, su selección y las asas de sus extremos. */
function ConnectorLayerImpl({ part, diagram, selectedEdge, previewEdge, zoom, coarse, name, onSelect, onEndDown, onSegmentDown, onCurveDown, onPointDown, onPointDouble, onAddPoint, selectedPoint }: {
  /** `lines`: trazos, flechas y etiquetas, debajo de las formas. `handles`: asas de los extremos del conector seleccionado, encima de todo. */
  part: "lines" | "handles"; diagram: Diagram; selectedEdge: string | null; previewEdge: string | null; zoom: number; coarse: boolean;
  name: (e: DEdge) => string; onSelect: (id: string) => void; onEndDown: (edgeId: string, end: "from" | "to", e: ReactPointerEvent<SVGElement>) => void;
  onSegmentDown: (edgeId: string, index: number, e: ReactPointerEvent<SVGElement>) => void; onCurveDown: (edgeId: string, e: ReactPointerEvent<SVGElement>) => void;
  onPointDown: (edgeId: string, index: number, e: ReactPointerEvent<SVGElement>) => void; onPointDouble: (edgeId: string, index: number) => void; onAddPoint: (edgeId: string, clientX: number, clientY: number) => void;
  selectedPoint: { edgeId: string; index: number } | null; /** Idioma actual: los nombres accesibles se recalculan al cambiarlo. */ lang?: string;
}) {
  const [focused, setFocused] = useState<string | null>(null);
  const k = symbolScale(zoom), r = (ANCHOR_DOT / 2) * k, hitR = hitRadiusFlow(zoom, coarse);
  if (part === "handles") {
    const e = diagram.edges.find((x) => x.id === selectedEdge), p = e ? connectorPath(diagram, e) : null;
    if (!e || !p) return null;
    const grip = (cx: number, cy: number, on?: boolean) => <circle cx={cx} cy={cy} r={on ? r * 1.3 : r} fill={on ? "var(--c-accent)" : "var(--c-card)"} stroke="var(--c-accent)" strokeWidth={2 * k} pointerEvents="none" />;
    // Los tramos pegados a un extremo unido llevan el tramo corto de salida del anclaje y no se arrastran; solo los intermedios.
    const nSeg = p.vertices ? p.vertices.length - 1 : 0;
    const segs = e.route === "orthogonal" && p.vertices
      ? p.vertices.slice(0, -1).map((a, i) => ({ i, a, b: p.vertices![i + 1]! }))
        .filter(({ a, b, i }) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y) >= 12 && !(i === 0 && isAttached(e.from)) && !(i === nSeg - 1 && isAttached(e.to)))
      : [];
    return (
      <OverlaySvg z={Z_ABOVE}>
        {segs.map(({ i, a, b }) => {
          const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, horizontal = a.y === b.y;
          return (
            <g key={`s${i}`} data-segment-handle={i} aria-hidden="true">
              <line data-segment-hit="" x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="transparent" strokeWidth={hitPx(coarse) / zoom} strokeLinecap="butt" className={`nopan nodrag nowheel ${horizontal ? "vn-resize-ns" : "vn-resize-ew"}`} style={{ pointerEvents: "stroke" }} onPointerDown={(ev) => onSegmentDown(e.id, i, ev)} />
              {grip(mx, my)}
            </g>
          );
        })}
        {e.route === "curved" && (() => {
          const h = curveHandle(p.start, p.startDir, p.end, p.endDir, e.curvature);
          return (
            <g data-curve-handle="" aria-hidden="true">
              <circle data-curve-hit="" cx={h.x} cy={h.y} r={hitR} fill="transparent" className="nopan nodrag nowheel vn-grab" style={{ pointerEvents: "all" }} onPointerDown={(ev) => onCurveDown(e.id, ev)} />
              {grip(h.x, h.y)}
            </g>
          );
        })()}
        {/* Puntos de quiebre editables: de paso en 90°, de control en curvo y libre. Doble clic sobre uno lo elimina (no llega al lienzo). */}
        {(e.route === "orthogonal" ? e.waypoints ?? [] : e.route === "curved" || e.route === "free" ? e.points ?? [] : []).map((q, i) => (
          <g key={`p${i}`} data-control-point={i} aria-hidden="true">
            <circle data-control-hit="" cx={q.x} cy={q.y} r={hitR} fill="transparent" className="nopan nodrag nowheel vn-grab" style={{ pointerEvents: "all" }} onPointerDown={(ev) => onPointDown(e.id, i, ev)} onDoubleClick={(ev) => { ev.stopPropagation(); onPointDouble(e.id, i); }} />
            {grip(q.x, q.y, selectedPoint?.edgeId === e.id && selectedPoint.index === i)}
          </g>
        ))}
        {(["from", "to"] as const).map((end) => {
          const at = end === "from" ? p.start : p.end;
          return (
            <g key={end} data-end-handle={end}>
              <circle data-end-hit="" cx={at.x} cy={at.y} r={hitR} fill="transparent" className="nopan nodrag nowheel vn-grab" style={{ pointerEvents: "all" }} onPointerDown={(ev) => onEndDown(e.id, end, ev)} />
              <circle cx={at.x} cy={at.y} r={r} fill="var(--c-card)" stroke="var(--c-accent)" strokeWidth={2 * k} pointerEvents="none" />
            </g>
          );
        })}
      </OverlaySvg>
    );
  }
  return (
    <OverlaySvg z={Z_BELOW}>
      {diagram.edges.map((e) => {
        const p = connectorPath(diagram, e);
        if (!p) return null;
        const isPreview = e.id === previewEdge, sel = e.id === selectedEdge, color = strokeFor(e.style.color);
        const onKey = (ev: ReactKeyboardEvent<SVGGElement>) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); onSelect(e.id); } };
        return (
          <g key={e.id} data-connector={e.id} {...(isPreview ? {} : { role: "button", tabIndex: 0, "aria-label": name(e), "aria-pressed": sel })} onKeyDown={onKey} onClick={() => !isPreview && onSelect(e.id)} onDoubleClick={(ev) => { if (!isPreview && sel) { ev.stopPropagation(); onAddPoint(e.id, ev.clientX, ev.clientY); } }} onFocus={() => setFocused(e.id)} onBlur={() => setFocused((cur) => (cur === e.id ? null : cur))} style={{ outline: "none" }}>
            {focused === e.id && (
              <>
                {/* Foco por teclado: anillo doble siguiendo el trazo (acento + separación), visible sobre cualquier fondo */}
                <path d={pathToSvg(p)} fill="none" stroke="var(--c-accent)" strokeWidth={EDGE_WIDTH_PX[e.style.width] + 8} strokeLinecap="round" pointerEvents="none" />
                <path d={pathToSvg(p)} fill="none" stroke="var(--c-canvas)" strokeWidth={EDGE_WIDTH_PX[e.style.width] + 4} strokeLinecap="round" pointerEvents="none" />
              </>
            )}
            {!isPreview && <path data-connector-hit="" d={pathToSvg(p)} fill="none" stroke="transparent" strokeWidth={hitPx(coarse) / zoom} className="nopan nodrag nowheel vn-clickable" style={{ pointerEvents: "stroke" }} />}
            {(() => {
              const sp = styledPath(p, e.style), w = EDGE_WIDTH_PX[e.style.width];
              return (
                <>
                  <path data-connector-path="" d={pathToSvg({ ...p, cmds: sp.cmds })} fill="none" stroke={color} strokeWidth={w + (sel ? 1 : 0)} strokeDasharray={isPreview ? "6 4" : dashArray(e.style.dash, w)} pointerEvents="none" />
                  <CapMark shape={sp.start} kind={e.style.startCap} color={color} />
                  <CapMark shape={sp.end} kind={e.style.endCap} color={color} />
                </>
              );
            })()}
            {e.label.trim() !== "" && <text x={p.midpoint.x} y={p.midpoint.y - 6} textAnchor="middle" fontSize={13} fill={strokeFor(e.style.textColor)} stroke="var(--c-canvas)" strokeWidth={3} paintOrder="stroke" pointerEvents="none">{e.label}</text>}
          </g>
        );
      })}
    </OverlaySvg>
  );
}

/** Con cientos de conectores, redibujar la capa en cada movimiento del puntero es lo más caro: solo se redibuja si cambia algo que ella usa. */
export const ConnectorLayer = memo(ConnectorLayerImpl);
