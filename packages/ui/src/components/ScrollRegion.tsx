import { useEffect, useRef, useState, type ReactNode } from "react";

/** Región con desplazamiento horizontal propio (tablas anchas, tablero, calendario): no ensancha la pantalla y sugiere más contenido con un desvanecimiento. */
export function ScrollRegion({ label, children }: { label: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [overflow, setOverflow] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const check = () => setOverflow(el.scrollWidth > el.clientWidth);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div className="relative min-w-0" {...(overflow ? { "data-overflow": "" } : {})}>
      <div ref={ref} data-scroll-region role="region" aria-label={label} tabIndex={0} className="min-w-0 overflow-x-auto">{children}</div>
      {overflow && <span data-scroll-fade aria-hidden="true" className="pointer-events-none absolute right-0 top-0 h-full w-8 bg-gradient-to-l from-[var(--c-canvas)] to-transparent" />}
    </div>
  );
}
