import { useEffect, useState } from "react";
import { Button } from "./Button";

/** Una operación más corta que esto no muestra indicador: evita parpadeos (RF-12.3). */
export const PROGRESS_DELAY_MS = 300;

/** Progreso con porcentaje y «Cancelar» para operaciones largas; solo aparece tras el retardo. `total <= 0` = indeterminado. */
export function ProgressIndicator({ label, done, total, cancelLabel, onCancel, delayMs = PROGRESS_DELAY_MS }: {
  label: string; done: number; total: number; cancelLabel: string; onCancel?: () => void; delayMs?: number;
}) {
  const [visible, setVisible] = useState(delayMs <= 0);
  useEffect(() => {
    if (delayMs <= 0) { setVisible(true); return; }
    const id = setTimeout(() => setVisible(true), delayMs);
    return () => clearTimeout(id);
  }, [delayMs]);
  if (!visible) return null;
  const determinate = total > 0;
  const pct = determinate ? Math.min(100, Math.round((done / total) * 100)) : null;
  return (
    <div className="flex items-center gap-3 text-[length:var(--text-ui-size)]">
      <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} {...(pct !== null ? { "aria-valuenow": pct } : {})} className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--c-raised)]">
        <div className={`h-2 rounded-full bg-[var(--c-accent)] ${pct === null ? "w-1/3 animate-pulse" : ""}`} style={pct !== null ? { width: `${pct}%` } : {}} />
      </div>
      {pct !== null && <span className="w-12 text-right tabular-nums">{pct} %</span>}
      {onCancel && <Button size="sm" onClick={onCancel}>{cancelLabel}</Button>}
    </div>
  );
}
