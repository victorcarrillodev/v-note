import * as A from "@radix-ui/react-alert-dialog";
import type { ReactNode } from "react";
import { Button } from "./Button";

/** Confirmación destructiva: foco inicial en el botón SEGURO, el velo no cierra, el botón de acción usa el color de peligro. */
export function ConfirmDialog({ open, onOpenChange, title, description, confirmLabel, cancelLabel, onConfirm, tone = "danger", confirmDisabled = false, children }: {
  open: boolean; onOpenChange: (o: boolean) => void; title: string; description: ReactNode; confirmLabel: string; cancelLabel: string; onConfirm: () => void; tone?: "danger" | "primary"; confirmDisabled?: boolean; children?: ReactNode;
}) {
  return (
    <A.Root open={open} onOpenChange={onOpenChange}>
      <A.Portal>
        <A.Overlay data-dialog-overlay className="fixed inset-0 z-[var(--z-scrim)] bg-[var(--c-scrim)]" />
        <A.Content className="fixed left-1/2 top-1/3 z-[var(--z-dialog)] w-[var(--size-modal-s)] max-w-[calc(100vw-var(--space-12))] -translate-x-1/2 rounded-lg border border-[var(--c-border)] bg-[var(--c-card)] p-6 shadow-[var(--elevation-4)]">
          <A.Title className="text-[length:var(--text-dialog-title-size)] font-semibold text-[var(--c-text)]">{title}</A.Title>
          <A.Description className="mt-2 text-[length:var(--text-ui-size)] text-[var(--c-text-muted)]">{description}</A.Description>
          {children && <div className="mt-3 flex flex-col gap-2 text-[length:var(--text-ui-size)]">{children}</div>}
          <div className="mt-6 flex justify-end gap-2">
            <A.Cancel asChild><Button>{cancelLabel}</Button></A.Cancel>
            <A.Action asChild><Button variant={tone === "danger" ? "danger" : "primary"} disabled={confirmDisabled} onClick={onConfirm}>{confirmLabel}</Button></A.Action>
          </div>
        </A.Content>
      </A.Portal>
    </A.Root>
  );
}
