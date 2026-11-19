import type { CSSProperties } from "react";
import { NodeResizer, type Node, type NodeProps } from "@xyflow/react";
import type { NodeStyle, Shape } from "@vnote/core";
import { fillFor, strokeFor } from "../design/diagramPalette";
import { StretchSvg } from "../design/StretchSvg";

export type NodeData = { shape: Shape; text: string; style: NodeStyle; label: string; onResize: (id: string, x: number, y: number, w: number, h: number) => void };

const dashOf = (d: NodeStyle["strokeDash"]): CSSProperties["borderStyle"] => (d === "dashed" ? "dashed" : d === "dotted" ? "dotted" : "solid");

const DIAMOND_CLIP = "polygon(50% 0, 100% 50%, 50% 100%, 0 50%)";

/** Trazo del rombo de decisión. El trazo mide el doble del grosor y el recorte de la forma deja ver solo la mitad interior. */
export function DecisionOutline({ style: st }: { style: NodeStyle }) {
  const w = st.strokeWidth, fill = fillFor(st.fill);
  const fillOpacity = st.fill === "none" ? 1 : st.fillOpacity;
  const dash = st.strokeDash === "dashed" ? `${w * 3} ${w * 2}` : st.strokeDash === "dotted" ? `${w} ${w}` : undefined;
  return (
    <StretchSvg>
      <polygon data-decision-outline="" points="50,0 100,50 50,100 0,50" fill={fill} fillOpacity={fillOpacity} stroke={strokeFor(st.stroke)} strokeWidth={w * 2} strokeDasharray={dash} strokeLinejoin="miter" vectorEffect="non-scaling-stroke" />
    </StretchSvg>
  );
}

/** Aspecto de cada forma a partir de su estilo; los colores salen de la paleta del tema. */
export const shapeStyle = (shape: Shape, st: NodeStyle): CSSProperties => {
  const line = strokeFor(st.stroke), w = st.strokeWidth;
  // La opacidad afecta solo al relleno: se mezcla el color de relleno con transparente (el contorno y el texto no se tocan).
  const fill = fillFor(st.fill);
  const background = st.fill === "none" || st.fillOpacity >= 1 ? fill : `color-mix(in srgb, ${fill} ${Math.round(st.fillOpacity * 100)}%, transparent)`;
  const base: CSSProperties = { background, border: `${w}px ${dashOf(st.strokeDash)} ${line}`, width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", padding: 6, boxSizing: "border-box", overflow: "hidden", fontSize: 13, color: strokeFor(st.textColor) };
  switch (shape) {
    case "terminator": return { ...base, borderRadius: 999 };
    // El rombo se dibuja con un SVG (DecisionOutline): un borde o una sombra interior siguen la caja rectangular y,
    // al recortarla, solo dejaban ver las puntas. El recorte se conserva para que el clic responda solo dentro del rombo.
    case "decision": return { ...base, position: "relative", background: "transparent", border: "none", clipPath: DIAMOND_CLIP };
    case "io": return { ...base, transform: "skewX(-15deg)" };
    default: return { ...base, borderRadius: 4 };
  }
};

/** Forma del lienzo. Sin puntos de unión de la librería: los anclajes los dibuja la capa propia (spec 003, RF-1). */
export function ShapeNode({ id, data, selected, positionAbsoluteX, positionAbsoluteY, width, height }: NodeProps<Node<NodeData>>) {
  return (
    <>
      <NodeResizer isVisible={selected} minWidth={40} minHeight={24} onResizeEnd={(_e, p) => data.onResize(id, p.x, p.y, p.width, p.height)} />
      <div role="group" aria-label={data.label} data-shape={data.shape} data-fill={data.style.fill} data-fill-opacity={data.style.fillOpacity} data-x={Math.round(positionAbsoluteX)} data-y={Math.round(positionAbsoluteY)} data-w={width} data-h={height} style={shapeStyle(data.shape, data.style)}>
        {data.shape === "decision" && <DecisionOutline style={data.style} />}
        <span style={data.shape === "io" ? { transform: "skewX(15deg)" } : data.shape === "decision" ? { position: "relative" } : undefined}>{data.text}</span>
      </div>
    </>
  );
}
