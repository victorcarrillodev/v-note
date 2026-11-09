// Alto del lienzo de diagramas y mapas (plan 004, §4.3 y §5.1). Lectura tolerante: nunca lanza.
export const DEFAULT_DIAGRAM_HEIGHT = 420;
export const MIN_HEIGHT = 240;
export const MAX_HEIGHT = 1600;
const MAP_MIN = 320, MAP_MAX = 560, MAP_PAD = 40;

export type CanvasView = { height?: number };

/** Acota el alto al rango permitido y lo redondea; un valor que no es un número finito da el de por defecto. */
export function clampHeight(value: unknown, fallback: number = DEFAULT_DIAGRAM_HEIGHT): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, Math.round(value)));
}

/** Alto por defecto de un mapa nuevo: el contenido más un margen, entre 320 y 560 px. */
export const defaultMapHeight = (contentHeight: number): number => Math.min(MAP_MAX, Math.max(MAP_MIN, Math.round(contentHeight + MAP_PAD)));

/** Lee el `view` guardado: lo no válido se descarta y el alto se acota. */
export function readView(raw: unknown): CanvasView | undefined {
  if (typeof raw !== "object" || raw === null) return undefined;
  const h = (raw as { height?: unknown }).height;
  return typeof h === "number" && Number.isFinite(h) ? { height: clampHeight(h) } : undefined;
}

/** Valor a guardar: nada si no hay alto (así un dato sin editar se serializa igual que antes). */
export function writeView(view: CanvasView | undefined): CanvasView | undefined {
  return view && typeof view.height === "number" && Number.isFinite(view.height) ? { height: view.height } : undefined;
}
