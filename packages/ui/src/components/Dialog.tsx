import * as D from "@radix-ui/react-dialog";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { cx } from "../design/cx";
import { ConfirmDialog } from "./ConfirmDialog";
import { IconButton } from "./IconButton";
import { registerModal } from "./modalStack";

const WIDTH = { s: "w-[var(--size-modal-s)]", m: "w-[var(--size-modal-m)]", l: "w-[var(--size-modal-l)]" } as const;

/**
 * Modal de formulario: foco atrapado y devuelto, Escape, velo que bloquea el fondo, cuerpo con desplazamiento y pie fijo.
 * Con `dirty`, Escape y el clic en el velo piden confirmar el descarte en lugar de cerrar.
 */
export function Dialog({ open, onOpenChange, title, description, children, footer, size = "m", dirty = false, tall = false }: {
  open: boolean; onOpenChange: (o: boolean) => void; title: string; description?: string; children: ReactNode; footer?: ReactNode; size?: keyof typeof WIDTH; dirty?: boolean; /** Contenido alto (vista previa): empieza arriba para no salirse de la pantalla. */ tall?: boolean;
}) {
  const { t } = useTranslation();
  const [askDiscard, setAskDiscard] = useState(false);
  const body = useRef<HTMLDivElement>(null);
  // Radix solo devuelve el foco a un <Trigger>; aquí el modal se controla desde fuera, así que se recuerda quién lo abrió.
  const opener = useRef<HTMLElement | null>(null);
  const wasOpen = useRef(false);
  if (open && !wasOpen.current) opener.current = document.activeElement as HTMLElement | null;
  wasOpen.current = open;
  useEffect(() => (open ? registerModal() : undefined), [open]);

  const guard = (e: Event) => { if (dirty) { e.preventDefault(); setAskDiscard(true); } };
  return (
    <>
      <D.Root open={open} onOpenChange={(o) => { if (!o && dirty) { setAskDiscard(true); return; } onOpenChange(o); }}>
        <D.Portal>
          <D.Overlay data-dialog-overlay className="fixed inset-0 z-[var(--z-scrim)] bg-[var(--c-scrim)]" />
          <D.Content
            onOpenAutoFocus={(e) => {
              // El foco inicial va al primer campo del cuerpo (no al botón de cerrar).
              const first = body.current?.querySelector<HTMLElement>("input, textarea, select, button, [href], [tabindex]:not([tabindex='-1'])");
              if (first) { e.preventDefault(); first.focus(); }
            }}
            onCloseAutoFocus={(e) => { e.preventDefault(); opener.current?.focus(); }}
            onEscapeKeyDown={guard}
            onInteractOutside={guard}
            aria-describedby={description ? undefined : undefined}
            className={cx("fixed left-1/2 z-[var(--z-dialog)] flex max-h-[calc(100vh-var(--space-12))] max-w-[calc(100vw-var(--space-12))] -translate-x-1/2 flex-col rounded-lg border border-[var(--c-border)] bg-[var(--c-card)] shadow-[var(--elevation-4)]", tall ? "top-6" : "top-1/3", WIDTH[size])}
          >
            <div className="flex shrink-0 items-center justify-between px-6 pt-6">
              <D.Title className="text-[length:var(--text-dialog-title-size)] font-semibold text-[var(--c-text)]">{title}</D.Title>
              <D.Close asChild><IconButton icon="close" label={t("shell.close", { defaultValue: "Cerrar" })} /></D.Close>
            </div>
            {description && <D.Description className="px-6 pt-1 text-[length:var(--text-ui-size)] text-[var(--c-text-muted)]">{description}</D.Description>}
            <div ref={body} data-dialog-body className="min-h-0 flex-1 overflow-y-auto px-6 py-4 text-[length:var(--text-ui-size)]">{children}</div>
            {footer && <div data-dialog-footer className="flex shrink-0 justify-end gap-2 border-t border-[var(--c-border)] px-6 py-4">{footer}</div>}
          </D.Content>
        </D.Portal>
      </D.Root>
      <ConfirmDialog
        open={askDiscard}
        onOpenChange={setAskDiscard}
        title={t("dialog.discardTitle", { defaultValue: "¿Descartar los cambios?" })}
        description={t("dialog.discardBody", { defaultValue: "Hay cambios sin guardar que se perderán." })}
        confirmLabel={t("dialog.discard", { defaultValue: "Descartar cambios" })}
        cancelLabel={t("dialog.keepEditing", { defaultValue: "Seguir editando" })}
        onConfirm={() => { setAskDiscard(false); onOpenChange(false); }}
      />
    </>
  );
}
