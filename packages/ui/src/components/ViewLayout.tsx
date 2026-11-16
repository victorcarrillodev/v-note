import type { HTMLAttributes, ReactNode } from "react";
import { cx } from "../design/cx";

const WIDTH = { reading: "max-w-[var(--size-reading-width)]", wide: "max-w-6xl", full: "" } as const;

/** Marco común de las vistas secundarias (papelera, ajustes, respaldo…): columna centrada, título grande, descripción y acciones a la derecha. */
export function ViewLayout({ title, description, actions, width = "reading", className, children, ...rest }: Omit<HTMLAttributes<HTMLElement>, "title"> & { title: string; description?: ReactNode; actions?: ReactNode; width?: keyof typeof WIDTH }) {
  return (
    <section aria-label={title} {...rest} className={cx("mx-auto flex w-full flex-col gap-6 px-6 py-10", WIDTH[width], className)}>
      <div data-slot="view-header" className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-[length:var(--text-h1-size)] font-bold leading-tight tracking-tight">{title}</h1>
          {description && <p className="mt-1 text-[length:var(--text-ui-size)] text-[var(--c-text-muted)]">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
      {children}
    </section>
  );
}

/** Bloque de una vista: tarjeta con título de nivel 2 y nota opcionales. `flush` quita el relleno (listas con filas a sangre). */
export function ViewSection({ title, hint, actions, flush = false, className, children }: { title?: string; hint?: ReactNode; actions?: ReactNode; flush?: boolean; className?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      {(title || actions) && (
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            {title && <h2 className="text-[length:var(--text-ui-size)] font-semibold">{title}</h2>}
            {hint && <p className="text-[length:var(--text-ui-small-size)] text-[var(--c-text-muted)]">{hint}</p>}
          </div>
          {actions}
        </div>
      )}
      {!title && !actions && hint && <p className="text-[length:var(--text-ui-small-size)] text-[var(--c-text-muted)]">{hint}</p>}
      <div className={cx("rounded-[var(--radius-lg)] border border-[var(--c-border)] bg-[var(--c-card)]", !flush && "p-4", className)}>{children}</div>
    </div>
  );
}

/** Fila de una lista dentro de un `ViewSection flush`: separador suave, resalte al pasar el puntero. */
export const VIEW_ROW = "flex min-h-11 items-center gap-3 border-b border-[var(--c-border)] px-4 py-2 last:border-b-0 hover:bg-[var(--c-raised)]";
