import { useLayoutEffect, useState, type RefObject } from "react";

/** Medidas (px) para que un bloque salga de la columna de la página y ocupe todo el ancho del área desplazable. */
export type BleedBox = { left: number; width: number; top: number };

/**
 * Mide dónde está el bloque respecto al área desplazable (`main`): `left` es lo que falta hasta su borde izquierdo, `width` su ancho útil y
 * `top` la distancia desde su borde superior. Así la separación de los cuatro lados sale idéntica aunque la columna no esté centrada
 * o tenga relleno distinto. Devuelve `null` si no se puede medir (el llamador usa un cálculo aproximado).
 */
export function useBleedBox(ref: RefObject<HTMLElement | null>, deps: unknown[]): BleedBox | null {
  const [box, setBox] = useState<BleedBox | null>(null);
  useLayoutEffect(() => {
    const el = ref.current, parent = el?.parentElement;
    const scroller = parent?.closest<HTMLElement>("main") ?? null;
    if (!el || !parent || !scroller) { setBox(null); return; }
    const measure = () => {
      const p = parent.getBoundingClientRect(), m = scroller.getBoundingClientRect();
      if (scroller.clientWidth === 0) { setBox(null); return; }
      const next = { left: m.left + scroller.clientLeft - p.left, width: scroller.clientWidth, top: p.top - m.top - scroller.clientTop + scroller.scrollTop };
      setBox((cur) => (cur && cur.left === next.left && cur.width === next.width && cur.top === next.top ? cur : next));
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(scroller); ro.observe(parent);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return box;
}
