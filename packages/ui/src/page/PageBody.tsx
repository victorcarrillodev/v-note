import type { ReactNode } from "react";

/** Clases del contenedor de página: ancho de lectura (720 px) o todo el ancho (RF-10.3). */
export const pageLayoutClass = (fullWidth: boolean): string =>
  fullWidth ? "mx-auto w-full p-6" : "mx-auto w-full max-w-[var(--size-reading-width)] p-6";

/** Cuerpo de página: lo muy ancho (tablas) se desplaza dentro de su caja, nunca la página entera (CL-24). */
export function PageBody({ fullWidth, children }: { fullWidth: boolean; children: ReactNode }) {
  return (
    <article className={pageLayoutClass(fullWidth)}>
      <div data-testid="page-body" className="min-w-0 [&_table]:block [&_table]:max-w-full [&_table]:overflow-x-auto">{children}</div>
    </article>
  );
}
