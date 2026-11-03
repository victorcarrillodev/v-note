import type { ButtonHTMLAttributes } from "react";
import { cx } from "../design/cx";
import { Icon } from "../design/Icon";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
const VARIANT: Record<ButtonVariant, string> = {
  primary: "bg-[var(--c-accent)] text-[var(--c-on-accent)] hover:brightness-95 active:brightness-90 border border-transparent",
  secondary: "bg-transparent text-[var(--c-text)] border border-[var(--c-border-control)] hover:bg-[var(--c-raised)]",
  ghost: "bg-transparent text-[var(--c-text)] border border-transparent hover:bg-[var(--c-raised)]",
  danger: "bg-transparent text-[var(--c-danger)] border border-[var(--c-danger)] hover:bg-[var(--c-raised)]",
};

/** Botón del estándar. Primario: uno solo por vista. 32 px (principal) o 28 px (`sm`), radio base, foco global. */
export function Button({ variant = "secondary", size = "md", loading = false, disabled, className, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: "md" | "sm"; loading?: boolean }) {
  return (
    <button
      type="button"
      {...rest}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cx(
        "relative inline-flex items-center justify-center gap-1 rounded px-3 font-medium transition-colors duration-100 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent",
        size === "md" ? "h-8 text-[length:var(--text-ui-size)]" : "h-7 text-[length:var(--text-ui-small-size)]",
        VARIANT[variant],
        className,
      )}
    >
      {/* El texto se conserva siempre (el ancho no cambia y el botón mantiene su nombre accesible); el indicador se superpone. */}
      <span className={cx("inline-flex items-center gap-1", loading && "opacity-0")}>{children}</span>
      {loading && <span className="absolute inset-0 inline-flex items-center justify-center"><Icon name="loading" className="animate-spin" /></span>}
    </button>
  );
}
