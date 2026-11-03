import type { ReactNode } from "react";
import { cx } from "../design/cx";

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("rounded-md border border-[var(--c-border)] bg-[var(--c-card)] p-4 shadow-[var(--elevation-2)]", className)}>{children}</div>;
}

export function CountBadge({ value }: { value: number }) {
  return <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-[var(--c-raised)] px-1.5 text-[length:var(--text-note-size)] font-medium text-[var(--c-text-muted)]">{value > 99 ? "99+" : value}</span>;
}

/** Barra de progreso (valor conocido) o indicador sin valor. Siempre con nombre accesible. */
export function Progress({ label, value, max = 100 }: { label: string; value?: number; max?: number }) {
  const known = value !== undefined;
  return (
    <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={max} {...(known ? { "aria-valuenow": value } : {})} className="h-2 w-full overflow-hidden rounded-full bg-[var(--c-raised)]">
      <div className={cx("h-full rounded-full bg-[var(--c-accent)]", !known && "w-1/3 animate-pulse motion-reduce:animate-none")} style={known ? { width: `${Math.min(100, Math.round((value! / max) * 100))}%` } : undefined} />
    </div>
  );
}

/** Fila de lista/árbol: 32 px (28 compacta). La seleccionada lleva barra de acento (no depende solo del color). */
export function ListRow({ children, selected = false, onClick }: { children: ReactNode; selected?: boolean; onClick?: () => void }) {
  return (
    <div data-row role={onClick ? "button" : undefined} tabIndex={onClick ? 0 : undefined} onClick={onClick} {...(selected ? { "aria-current": "true" as const } : {})}
      className={cx("flex h-8 [:root[data-density=compact]_&]:h-7 items-center gap-2 rounded px-2 text-[length:var(--text-ui-small-size)] hover:bg-[var(--c-raised)]", selected ? "border-l-2 border-[var(--c-accent)] bg-[var(--c-raised)] font-medium" : "border-l-2 border-transparent")}>
      {children}
    </div>
  );
}
