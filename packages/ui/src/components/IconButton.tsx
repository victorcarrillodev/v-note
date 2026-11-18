import type { ButtonHTMLAttributes } from "react";
import { cx } from "../design/cx";
import { Icon } from "../design/Icon";
import type { IconName } from "../design/iconMap";
import { Tooltip } from "./Tooltip";

/** Botón solo de ícono: el nombre accesible es OBLIGATORIO (también se muestra como tooltip). */
export function IconButton({ icon, label, className, ...rest }: Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label"> & { icon: IconName; label: string }) {
  if (!label || label.trim() === "") throw new Error("IconButton requiere un nombre accesible (label)");
  return (
    <Tooltip label={label}>
      <button
        type="button"
        {...rest}
        aria-label={label}
        className={cx("inline-flex h-8 w-8 items-center justify-center rounded text-[var(--c-text-muted)] transition-colors duration-100 hover:bg-[var(--c-raised)] hover:text-[var(--c-text)] disabled:cursor-not-allowed disabled:opacity-50", className)}
      >
        <Icon name={icon} />
      </button>
    </Tooltip>
  );
}
