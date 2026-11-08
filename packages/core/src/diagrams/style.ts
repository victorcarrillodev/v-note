// Estilo de los diagramas (plan 003, §4 y §7): colores, conjuntos permitidos y estilos del sistema. TypeScript puro.
import type { Shape } from "./anchors";

export const DASHES = ["solid", "dashed", "dotted"] as const;
export type Dash = (typeof DASHES)[number];
export const CAPS = ["none", "arrow", "circle", "diamond"] as const;
export type Cap = (typeof CAPS)[number];
export const ROUTES = ["straight", "orthogonal", "curved", "free"] as const;
export type Route = (typeof ROUTES)[number];
export const EDGE_WIDTHS = ["thin", "medium", "thick"] as const;
export type EdgeWidth = (typeof EDGE_WIDTHS)[number];
export const EDGE_WIDTH_PX: Record<EdgeWidth, number> = { thin: 1, medium: 2, thick: 4 };
export const NODE_STROKE_WIDTHS = [1, 2, 3, 4] as const;

/** Los tonos de relleno de la paleta y la tinta (texto principal). Los ids coinciden con los de la paleta de la interfaz. */
const FILL_LIGHT: Record<string, string> = {
  blue: "#dbeafe", green: "#dcfce7", yellow: "#fef9c3", red: "#fee2e2", purple: "#ede9fe", orange: "#ffedd5", gray: "#e5e7eb", white: "#ffffff",
  brown: "#efe3da", pink: "#f8dfec", // rellenos de los colores de bloque marrón y rosa (tema claro)
};
export const PALETTE_IDS: readonly string[] = [...Object.keys(FILL_LIGHT), "ink"];
export const fillHexLight = (id: string): string | undefined => FILL_LIGHT[id];

/** Tonos fuertes (tema claro) de los colores de bloque, para contorno, línea y texto al exportar. Una prueba de la interfaz los compara con los tokens. */
const STRONG_LIGHT: Record<string, string> = {
  gray: "#6B6A66", brown: "#8A4F2A", red: "#C0312F", orange: "#A8540A", yellow: "#8A6500", green: "#1B7F4E", blue: "#0B6BCB", purple: "#7A3FB5", pink: "#B5307A",
};
export const strongHexLight = (id: string): string | undefined => STRONG_LIGHT[id];

const HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
export function isColor(v: unknown): v is string {
  if (typeof v !== "string") return false;
  if (v.startsWith("palette:")) return PALETTE_IDS.includes(v.slice(8));
  return HEX.test(v);
}
export const isFillColor = (v: unknown): v is string => v === "none" || isColor(v);

/** Id de paleta cuyo relleno coincide con un hexadecimal de la versión 1 (sin importar mayúsculas), o null. */
export function paletteIdForHex(hex: string): string | null {
  const h = hex.toLowerCase();
  return Object.keys(FILL_LIGHT).find((id) => FILL_LIGHT[id] === h) ?? null;
}

export type NodeStyle = { fill: string; fillOpacity: number; stroke: string; strokeWidth: number; strokeDash: Dash; textColor: string };
export type EdgeStyle = { color: string; width: EdgeWidth; dash: Dash; startCap: Cap; endCap: Cap; textColor: string };

/** La nota se dibujaba con el contorno discontinuo; el resto, continuo. */
export const defaultNodeStyle = (shape: Shape): NodeStyle => ({ fill: "palette:blue", fillOpacity: 1, stroke: "palette:ink", strokeWidth: 2, strokeDash: shape === "note" ? "dashed" : "solid", textColor: "palette:ink" });
export const defaultEdgeStyle = (): EdgeStyle => ({ color: "palette:ink", width: "medium", dash: "solid", startCap: "none", endCap: "arrow", textColor: "palette:ink" });

const oneOf = <T extends string | number>(set: readonly T[], v: unknown, fallback: T): T => (set.includes(v as T) ? (v as T) : fallback);

/** Rellena un estilo parcial con el del sistema; lo inválido se sustituye (nunca se dibuja algo incorrecto). */
export function completeNodeStyle(shape: Shape, s: Partial<NodeStyle> | undefined): NodeStyle {
  const d = defaultNodeStyle(shape), p = s ?? {};
  return {
    fill: isFillColor(p.fill) ? p.fill : d.fill,
    fillOpacity: typeof p.fillOpacity === "number" && p.fillOpacity >= 0 && p.fillOpacity <= 1 ? p.fillOpacity : d.fillOpacity,
    stroke: isColor(p.stroke) ? p.stroke : d.stroke,
    strokeWidth: oneOf(NODE_STROKE_WIDTHS, p.strokeWidth, d.strokeWidth as 1 | 2 | 3 | 4),
    strokeDash: oneOf(DASHES, p.strokeDash, d.strokeDash),
    textColor: isColor(p.textColor) ? p.textColor : d.textColor,
  };
}
export function completeEdgeStyle(s: Partial<EdgeStyle> | undefined): EdgeStyle {
  const d = defaultEdgeStyle(), p = s ?? {};
  return {
    color: isColor(p.color) ? p.color : d.color,
    width: oneOf(EDGE_WIDTHS, p.width, d.width),
    dash: oneOf(DASHES, p.dash, d.dash),
    startCap: oneOf(CAPS, p.startCap, d.startCap),
    endCap: oneOf(CAPS, p.endCap, d.endCap),
    textColor: isColor(p.textColor) ? p.textColor : d.textColor,
  };
}

/** Trama (`stroke-dasharray`) de una línea según su tipo y su grosor en píxeles; la continua no lleva. */
export const dashArray = (dash: Dash, widthPx: number): string | undefined =>
  dash === "dashed" ? `${4 * widthPx + 2} ${3 * widthPx + 2}` : dash === "dotted" ? `${widthPx} ${2 * widthPx + 2}` : undefined;
