import { useEffect, useState } from "react";
import { activeHeading, type Heading } from "@vnote/core";

/** Línea de lectura (px desde el borde superior de la ventana): el encabezado «visible» es el último que ya la cruzó. */
export const READING_LINE = 96;

const tops = (headings: readonly Heading[]): Record<string, number> =>
  Object.fromEntries(headings.map((h) => [h.id, document.querySelector(`[data-id="${h.id}"]`)?.getBoundingClientRect().top ?? Infinity]));

/**
 * Encabezado de la sección visible (RF-7.2). Con `IntersectionObserver` solo se recalcula cuando un encabezado entra o sale de la
 * franja de lectura, en vez de en cada evento de desplazamiento (CL-12). Sin soporte, usa el evento de desplazamiento.
 */
export function useActiveHeading(headings: readonly Heading[]): string | null {
  const [active, setActive] = useState<string | null>(null);
  useEffect(() => {
    if (headings.length === 0) { setActive(null); return; }
    const update = () => setActive(activeHeading(headings, tops(headings), READING_LINE));
    update();
    if (typeof IntersectionObserver === "undefined") {
      window.addEventListener("scroll", update, true);
      return () => window.removeEventListener("scroll", update, true);
    }
    // Se observa el cruce de la línea de lectura: la franja va de la parte superior de la ventana hasta la línea.
    const io = new IntersectionObserver(update, { rootMargin: `0px 0px -${Math.max(0, window.innerHeight - READING_LINE)}px 0px`, threshold: [0, 1] });
    for (const h of headings) { const el = document.querySelector(`[data-id="${h.id}"]`); if (el) io.observe(el); }
    // Al alcanzar el final de la página no hay más cruces: se recalcula una vez al dejar de desplazar.
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onScrollEnd = () => { clearTimeout(timer); timer = setTimeout(update, 120); };
    window.addEventListener("scroll", onScrollEnd, true);
    return () => { io.disconnect(); clearTimeout(timer); window.removeEventListener("scroll", onScrollEnd, true); };
  }, [headings]);
  return active;
}
