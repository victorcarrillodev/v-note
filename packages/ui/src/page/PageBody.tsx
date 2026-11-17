import type { ReactNode } from "react";
import type { PageStyle } from "@vnote/core";
import { PageStyleScope } from "./PageStyleScope";

/**
 * Clases del contenedor de página: el ancho sale de la variable `--size-reading-width` que declara el estilo de la página
 * (estrecho, normal, amplio o sin límite). Sin estilo vale el ancho de lectura de siempre (720 px).
 */
export const pageLayoutClass = (): string => "mx-auto w-full max-w-[var(--size-reading-width)] p-6";

/** Cuerpo de página: lo muy ancho (tablas) se desplaza dentro de su caja, nunca la página entera (CL-24). */
export function PageBody({ style, children }: { style: PageStyle; children: ReactNode }) {
  return (
    <PageStyleScope as="article" style={style} className={pageLayoutClass()}>
      <div data-testid="page-body" className="min-w-0 [&_table]:block [&_table]:max-w-full [&_table]:overflow-x-auto">{children}</div>
    </PageStyleScope>
  );
}
