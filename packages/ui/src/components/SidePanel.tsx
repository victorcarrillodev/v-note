import { useEffect, useRef, type ReactNode } from "react";
import { cx } from "../design/cx";
import { IconButton } from "./IconButton";

/** Panel lateral NO modal (detalle de un elemento): no atrapa el foco; Escape lo cierra y devuelve el foco a quien lo abrió. */
export function SidePanel({ open, onClose, title, children, closeLabel = "Cerrar" }: { open: boolean; onClose: () => void; title: string; children: ReactNode; closeLabel?: string }) {
  const opener = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!open) return;
    opener.current = document.activeElement as HTMLElement | null;
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("keydown", key); opener.current?.focus(); };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <aside role="complementary" aria-label={title} className={cx("fixed right-0 top-0 z-[var(--z-dialog)] flex h-full w-[var(--size-panel-width)] max-w-full flex-col border-l border-[var(--c-border)] bg-[var(--c-sidebar)] shadow-[var(--elevation-3)]")}>
      <div className="flex shrink-0 items-center justify-between px-4 py-3">
        <h2 className="text-[length:var(--text-dialog-title-size)] font-semibold text-[var(--c-text)]">{title}</h2>
        <IconButton icon="close" label={closeLabel} onClick={onClose} />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 text-[length:var(--text-ui-size)]">{children}</div>
    </aside>
  );
}
