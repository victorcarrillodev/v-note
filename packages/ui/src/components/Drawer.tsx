import * as D from "@radix-ui/react-dialog";
import { useRef, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { cx } from "../design/cx";
import { IconButton } from "./IconButton";

const WIDTH = { m: "w-[var(--size-panel-width)]", l: "w-[var(--size-drawer-width)]" } as const;

/**
 * Barra lateral que entra desde la derecha y sale hacia la derecha (animaciones en `tokens.css`). Se cierra con Escape, con la X o con un clic fuera.
 * - `modal` (por defecto): velo que atenúa el fondo, foco atrapado y el resto de la interfaz bloqueada (ajustes de la app).
 * - `modal={false}`: sin velo y la página sigue viva, para ver los cambios al instante y usar «Deshacer» en los avisos (opciones de la página).
 * `restoreFocus` decide al cerrar si el foco vuelve a quien abrió (falso cuando otro panel toma el relevo).
 * `keepOpenOn`: selector de elementos de fuera cuyo clic no cierra (el propio botón que la abre, para que funcione como alternador).
 */
export function Drawer({ open, onOpenChange, title, children, size = "l", modal = true, restoreFocus, keepOpenOn }: {
  open: boolean; onOpenChange: (o: boolean) => void; title: string; children: ReactNode; size?: keyof typeof WIDTH; modal?: boolean; restoreFocus?: () => boolean; keepOpenOn?: string;
}) {
  const { t } = useTranslation();
  // Radix solo devuelve el foco a un <Trigger>; aquí se abre desde fuera, así que se recuerda quién la abrió.
  const opener = useRef<HTMLElement | null>(null);
  const body = useRef<HTMLDivElement>(null);
  const wasOpen = useRef(false);
  if (open && !wasOpen.current) opener.current = document.activeElement as HTMLElement | null;
  wasOpen.current = open;
  // Los avisos («Deshacer») nunca cierran el panel.
  const keep = ["[data-toast-viewport]", keepOpenOn].filter(Boolean).join(", ");
  return (
    <D.Root open={open} onOpenChange={onOpenChange} modal={modal}>
      <D.Portal>
        {modal && <D.Overlay data-drawer-overlay className="fixed inset-0 z-[var(--z-scrim)] bg-[var(--c-scrim)]" />}
        <D.Content
          data-drawer
          aria-describedby={undefined}
          onOpenAutoFocus={(e) => {
            // El foco inicial va al primer control del cuerpo: si fuera la X, su tooltip se abriría y se quedaría el primer Escape.
            const first = body.current?.querySelector<HTMLElement>("input, textarea, select, button, [href], [tabindex]:not([tabindex='-1'])");
            if (first) { e.preventDefault(); first.focus(); }
          }}
          onCloseAutoFocus={(e) => { e.preventDefault(); if (restoreFocus?.() !== false) opener.current?.focus(); }}
          onInteractOutside={(e) => { if ((e.target as Element | null)?.closest?.(keep)) e.preventDefault(); }}
          className={cx("fixed right-0 top-0 z-[var(--z-dialog)] flex h-full max-w-full flex-col border-l border-[var(--c-border)] bg-[var(--bg)] shadow-[var(--elevation-4)]", WIDTH[size])}
        >
          <div className="flex shrink-0 items-center justify-between border-b border-[var(--c-border)] px-5 py-3">
            <D.Title className="text-[length:var(--text-dialog-title-size)] font-semibold text-[var(--c-text)]">{title}</D.Title>
            <D.Close asChild><IconButton icon="close" label={t("shell.close", { defaultValue: "Cerrar" })} /></D.Close>
          </div>
          <div ref={body} data-drawer-body className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-5 py-5 text-[length:var(--text-ui-size)]">{children}</div>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
