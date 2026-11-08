import type { CSSProperties } from "react";
import { NodeResizer, type Node, type NodeProps } from "@xyflow/react";
import type { NodeStyle, Shape } from "@vnote/core";
import { fillFor, strokeFor } from "../design/diagramPalette";

export type NodeData = { shape: Shape; text: string; style: NodeStyle; label: string; onResize: (id: string, x: number, y: number, w: number, h: number) => void };

const dashOf = (d: NodeStyle["strokeDash"]): CSSProperties["borderStyle"] => (d === "dashed" ? "dashed" : d === "dotted" ? "dotted" : "solid");

/** Aspecto de cada forma a partir de su estilo; los colores salen de la paleta del tema. */
export const shapeStyle = (shape: Shape, st: NodeStyle): CSSProperties => {
  const line = strokeFor(st.stroke), w = st.strokeWidth;
  // La opacidad afecta solo al relleno: se mezcla el color de relleno con transparente (el contorno y el texto no se tocan).
  const fill = fillFor(st.fill);
  const background = st.fill === "none" || st.fillOpacity >= 1 ? fill : `color-mix(in srgb, ${fill} ${Math.round(st.fillOpacity * 100)}%, transparent)`;
  const base: CSSProperties = { background, border: `${w}px ${dashOf(st.strokeDash)} ${line}`, width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", padding: 6, boxSizing: "border-box", overflow: "hidden", fontSize: 13, color: strokeFor(st.textColor) };
  switch (shape) {
    case "terminator": return { ...base, borderRadius: 999 };
    case "decision": return { ...base, clipPath: "polygon(50% 0, 100% 50%, 50% 100%, 0 50%)", border: "none", boxShadow: `inset 0 0 0 ${w}px ${line}` };
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
        <span style={data.shape === "io" ? { transform: "skewX(15deg)" } : undefined}>{data.text}</span>
      </div>
    </>
  );
}
