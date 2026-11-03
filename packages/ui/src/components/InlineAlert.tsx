import type { ReactNode } from "react";
import { cx } from "../design/cx";
import { Icon } from "../design/Icon";
import type { IconName } from "../design/iconMap";
import { Button } from "./Button";

export type AlertTone = "info" | "success" | "warning" | "error";
const ICON: Record<AlertTone, IconName> = { info: "info", success: "success", warning: "warning", error: "error" };
const TONE: Record<AlertTone, string> = {
  info: "bg-[var(--chip-info-bg)] text-[var(--chip-info-fg)]",
  success: "bg-[var(--chip-success-bg)] text-[var(--chip-success-fg)]",
  warning: "bg-[var(--chip-warning-bg)] text-[var(--chip-warning-fg)]",
  error: "bg-[var(--chip-error-bg)] text-[var(--chip-error-fg)]",
};

/**
 * Aviso persistente en el lugar donde ocurre algo (nivel 2 y 3 de la matriz de avisos).
 * El estado se comunica con ícono + texto (no solo color) y NO desaparece solo: solo se cierra manualmente si se ofrece `onDismiss`.
 */
export function InlineAlert({ tone, title, children, action, onDismiss, dismissLabel = "Cerrar aviso" }: {
  tone: AlertTone; title?: string; children?: ReactNode; action?: { label: string; onClick: () => void }; onDismiss?: () => void; dismissLabel?: string;
}) {
  return (
    <div role={tone === "error" || tone === "warning" ? "alert" : "status"} className={cx("flex items-start gap-2 rounded-md p-3 text-[length:var(--text-ui-size)]", TONE[tone])}>
      <span className="mt-0.5 shrink-0"><Icon name={ICON[tone]} size={20} /></span>
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div>{children}</div>}
      </div>
      {action && <Button size="sm" onClick={action.onClick}>{action.label}</Button>}
      {onDismiss && <button type="button" aria-label={dismissLabel} onClick={onDismiss} className="shrink-0 rounded p-1 hover:bg-[var(--c-raised)]"><Icon name="close" /></button>}
    </div>
  );
}
