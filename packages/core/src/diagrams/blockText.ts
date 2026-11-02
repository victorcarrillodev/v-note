import type { Block } from "../blocks/types";
import { diagramText, parseDiagram } from "./diagram";
import { parseMatrix, matrixText } from "./matrix";
import { parseTimeline, timelineText } from "./timeline";
import { parseTree, treeText } from "./tree";

export const GRAPHIC_TYPES = ["diagram", "mindmap", "orgchart", "timeline", "matrix"] as const;
export const isGraphicBlock = (b: Block): boolean => (GRAPHIC_TYPES as readonly string[]).includes(b.type);

/** Texto de un bloque gráfico para el índice de búsqueda; un contenido dañado simplemente no aporta texto. */
export function graphicBlockText(b: Block): string {
  const data = typeof b.props.data === "string" ? b.props.data : "";
  switch (b.type) {
    case "diagram": { const r = parseDiagram(data); return r.ok ? diagramText(r.value) : ""; }
    case "mindmap": case "orgchart": { const r = parseTree(data); return r.ok ? treeText(r.value) : ""; }
    case "timeline": { const r = parseTimeline(data); return r.ok ? timelineText(r.value) : ""; }
    case "matrix": { const r = parseMatrix(data); return r.ok ? matrixText(r.value) : ""; }
    default: return "";
  }
}
