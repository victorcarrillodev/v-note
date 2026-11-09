// Reglas puras del menú emergente (plan 004, §5.3): visibilidad según el área visible del lienzo y tamaño máximo.
export type Rect = { left: number; top: number; width: number; height: number };
export type ScreenPoint = { x: number; y: number };

/** Parte del alto visible que puede ocupar el menú (RNF-4). */
export const MENU_HEIGHT_RATIO = 0.4;
/** Separación entre el menú y el elemento, para no taparlo. */
export const MENU_OFFSET = 8;

const isPoint = (a: ScreenPoint | Rect): a is ScreenPoint => "x" in a;

/** ¿El ancla (un punto o un rectángulo) está dentro del área visible? Sin área conocida se considera visible. */
export function anchorVisible(anchor: ScreenPoint | Rect, area: Rect | undefined): boolean {
  if (!area) return true;
  const r = isPoint(anchor) ? { left: anchor.x, top: anchor.y, width: 0, height: 0 } : anchor;
  return r.left <= area.left + area.width && r.left + r.width >= area.left && r.top <= area.top + area.height && r.top + r.height >= area.top;
}

export const maxMenuHeight = (areaHeight: number, ratio: number = MENU_HEIGHT_RATIO): number =>
  Number.isFinite(areaHeight) && areaHeight > 0 ? Math.floor(areaHeight * ratio) : 0;
