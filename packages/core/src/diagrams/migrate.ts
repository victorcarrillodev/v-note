// Migración del diagrama de la versión 1 a la 2 (plan 003, §4.4). Pura, determinista y sin pérdida.
import type { DEdge, DNode, Diagram } from "./diagram";
import type { Shape } from "./anchors";
import { completeNodeStyle, defaultEdgeStyle, isColor, paletteIdForHex } from "./style";

type V1Node = { id: string; shape: Shape; x: number; y: number; w: number; h: number; text: string; color: string };
type V1Edge = { id: string; from: string; to: string; label: string };

/** El color único de la forma pasa a ser su relleno: un hexadecimal de la paleta se vuelve id de paleta (así ya se dibujaba); otro color se conserva. */
function fillFrom(color: unknown): string | undefined {
  if (typeof color !== "string" || !isColor(color)) return undefined;
  if (color.startsWith("palette:")) return color;
  const id = paletteIdForHex(color);
  return id ? `palette:${id}` : color;
}

/**
 * Recibe un diagrama v1 ya validado. Los conectores se dibujaban del lado derecho de la forma de origen al izquierdo de la de destino
 * (el editor usaba esos puntos de unión), así que quedan unidos a los anclajes este → oeste, con trazado redondeado y flecha al final.
 */
export function migrateV1(raw: unknown): Diagram {
  const r = raw as { nodes: V1Node[]; edges: V1Edge[] };
  const nodes: DNode[] = r.nodes.map((n) => ({
    id: n.id, shape: n.shape, x: n.x, y: n.y, w: n.w, h: n.h, text: n.text,
    style: completeNodeStyle(n.shape, fillFrom(n.color) === undefined ? {} : { fill: fillFrom(n.color)! }),
  }));
  const edges: DEdge[] = r.edges.map((e) => ({
    id: e.id, from: { node: e.from, anchor: "e" }, to: { node: e.to, anchor: "w" }, route: "curved", label: e.label, style: defaultEdgeStyle(),
  }));
  return { nodes, edges };
}
