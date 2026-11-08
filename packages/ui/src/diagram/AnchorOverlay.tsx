import type { PointerEvent as ReactPointerEvent } from "react";
import { ANCHORS, anchorOutline, anchorPosition, inflate, type Anchor, type Diagram } from "@vnote/core";
import { OverlaySvg } from "../design/OverlaySvg";
import { ANCHOR_DOT, Z_ABOVE, hitRadiusFlow, symbolScale } from "./metrics";

export type ActiveAnchor = { node: string; anchor: Anchor } | null;

/**
 * Capa de anclajes y selección. Cada símbolo es un anillo doble (relleno de tarjeta + trazo de acento) que contrasta con cualquier relleno,
 * mantiene su tamaño en pantalla al hacer zoom (con tope) y tiene un área activa de 32 px (44 px con puntero grueso).
 */
export function AnchorOverlay({ diagram, showFor, selected, active, zoom, coarse, onAnchorDown, onHover }: {
  diagram: Diagram; showFor: ReadonlySet<string>; selected: ReadonlySet<string>; active: ActiveAnchor; zoom: number; coarse: boolean;
  onAnchorDown: (nodeId: string, e: ReactPointerEvent<SVGElement>) => void; onHover: (nodeId: string | null) => void;
}) {
  const k = symbolScale(zoom), r = (ANCHOR_DOT / 2) * k, hitR = hitRadiusFlow(zoom, coarse);
  return (
    <OverlaySvg z={Z_ABOVE}>
      {diagram.nodes.filter((n) => selected.has(n.id)).map((n) => {
        const pts = anchorOutline({ ...inflate(n, 4), shape: n.shape });
        return <path key={`ring-${n.id}`} data-selection-ring={n.id} d={`M ${pts.map((p) => `${p.x} ${p.y}`).join(" L ")} Z`} fill="none" stroke="var(--c-accent)" strokeWidth={2} vectorEffect="non-scaling-stroke" />;
      })}
      {diagram.nodes.filter((n) => showFor.has(n.id)).map((n) => (
        <g key={n.id} onPointerEnter={() => onHover(n.id)} onPointerLeave={() => onHover(null)}>
          {ANCHORS.map((a) => {
            const p = anchorPosition(n, a), on = active?.node === n.id && active.anchor === a;
            return (
              <g key={a} data-anchor-group="" data-node={n.id} data-anchor={a} data-x={p.x} data-y={p.y} data-active={on ? "true" : "false"}>
                <circle data-anchor-hit="" cx={p.x} cy={p.y} r={hitR} fill="transparent" className="nopan nodrag nowheel" style={{ pointerEvents: "all", cursor: "crosshair" }} onPointerDown={(e) => onAnchorDown(n.id, e)} />
                <circle cx={p.x} cy={p.y} r={on ? r * 1.4 : r} fill={on ? "var(--c-accent)" : "var(--c-card)"} stroke="var(--c-accent)" strokeWidth={2 * k} pointerEvents="none" />
              </g>
            );
          })}
        </g>
      ))}
    </OverlaySvg>
  );
}
