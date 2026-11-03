import type { ReactNode } from "react";
import { cx } from "../design/cx";
import { Icon } from "../design/Icon";
import { Popover } from "./Popover";

export type ChipTone = "neutral" | "info" | "success" | "warning" | "error";
const TONE: Record<ChipTone, string> = {
  neutral: "bg-[var(--c-raised)] text-[var(--c-text)]",
  info: "bg-[var(--chip-info-bg)] text-[var(--chip-info-fg)]",
  success: "bg-[var(--chip-success-bg)] text-[var(--chip-success-fg)]",
  warning: "bg-[var(--chip-warning-bg)] text-[var(--chip-warning-fg)]",
  error: "bg-[var(--chip-error-bg)] text-[var(--chip-error-fg)]",
};

/** Etiqueta con color semántico; radio mínimo; con «quitar» opcional. */
export function Chip({ tone = "neutral", children, onRemove, removeLabel }: { tone?: ChipTone; children: ReactNode; onRemove?: () => void; removeLabel?: string }) {
  return (
    <span className={cx("inline-flex h-5 items-center gap-1 rounded-sm px-1.5 text-[length:var(--text-ui-small-size)] font-medium", TONE[tone])}>
      <span className="truncate" title={typeof children === "string" ? children : undefined}>{children}</span>
      {onRemove && (
        <button type="button" aria-label={removeLabel ?? "Quitar"} onClick={onRemove} className="inline-flex h-4 w-4 items-center justify-center rounded-sm hover:bg-[var(--c-raised)]">
          <Icon name="close" size={14} />
        </button>
      )}
    </span>
  );
}

/** Muestra los chips que caben (`max`) y un «+N» que abre el resto. */
export function ChipList({ chips, max, moreLabel, tone }: { chips: { id: string; label: string }[]; max: number; moreLabel: (n: number) => string; tone?: ChipTone }) {
  const shown = chips.slice(0, max), rest = chips.slice(max);
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {shown.map((c) => <Chip key={c.id} {...(tone ? { tone } : {})}>{c.label}</Chip>)}
      {rest.length > 0 && (
        <Popover trigger={<button type="button" className="h-5 rounded-sm bg-[var(--c-raised)] px-1.5 text-[length:var(--text-ui-small-size)] text-[var(--c-text-muted)]">{moreLabel(rest.length)}</button>}>
          <span className="flex flex-wrap gap-1">{rest.map((c) => <Chip key={c.id} {...(tone ? { tone } : {})}>{c.label}</Chip>)}</span>
        </Popover>
      )}
    </span>
  );
}
