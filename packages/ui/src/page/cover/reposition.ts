// Reposicionar la portada (plan 005, §5.3 y RF-3.1): cálculo puro de la posición visible, con ratón y con teclado.

export type Pos = { x: number; y: number };
const clamp = (v: number) => Math.min(100, Math.max(0, Math.round(v)));

/**
 * Posición nueva al arrastrar `dx`, `dy` píxeles. La imagen cubre el recuadro (`object-fit: cover`), así que solo se puede
 * mover en la dimensión que sobra; el porcentaje de `object-position` se reparte sobre ese sobrante, por lo que el
 * arrastre sigue al puntero uno a uno. Sin medidas de la imagen no hay movimiento.
 */
export function dragPosition(start: Pos, delta: { dx: number; dy: number }, box: { w: number; h: number }, natural: { w: number; h: number } | null): Pos {
  if (!natural || natural.w <= 0 || natural.h <= 0 || box.w <= 0 || box.h <= 0) return start;
  const scale = Math.max(box.w / natural.w, box.h / natural.h);
  const overflowX = natural.w * scale - box.w, overflowY = natural.h * scale - box.h;
  // Arrastrar a la derecha muestra más de la izquierda de la imagen: la posición baja.
  return {
    x: overflowX > 0.5 ? clamp(start.x - (delta.dx / overflowX) * 100) : start.x,
    y: overflowY > 0.5 ? clamp(start.y - (delta.dy / overflowY) * 100) : start.y,
  };
}

/** Flechas ±1 %, con Mayús ±10 % (RNF-3). Una tecla que no mueve devuelve `null`. */
export function keyPosition(pos: Pos, key: string, shift: boolean): Pos | null {
  const step = shift ? 10 : 1;
  switch (key) {
    case "ArrowLeft": return { x: clamp(pos.x - step), y: pos.y };
    case "ArrowRight": return { x: clamp(pos.x + step), y: pos.y };
    case "ArrowUp": return { x: pos.x, y: clamp(pos.y - step) };
    case "ArrowDown": return { x: pos.x, y: clamp(pos.y + step) };
    default: return null;
  }
}
