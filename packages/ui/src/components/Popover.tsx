import * as P from "@radix-ui/react-popover";
import type { ReactNode } from "react";

/** Popover con detección de colisiones (se voltea y desplaza), Escape y devolución de foco. Máximo 360 px. */
export function Popover({ trigger, children, align = "start", open, onOpenChange, onCloseAutoFocus, wide = false }: { wide?: boolean; trigger: ReactNode; children: ReactNode; align?: "start" | "center" | "end"; open?: boolean; onOpenChange?: (o: boolean) => void; onCloseAutoFocus?: (e: Event) => void }) {
  return (
    <P.Root {...(open !== undefined ? { open } : {})} {...(onOpenChange ? { onOpenChange } : {})}>
      <P.Trigger asChild>{trigger}</P.Trigger>
      <P.Portal>
        <P.Content sideOffset={4} align={align} collisionPadding={8} {...(onCloseAutoFocus ? { onCloseAutoFocus } : {})} className={`z-[var(--z-menu)] ${wide ? "max-w-[calc(100vw-1rem)]" : "max-w-[var(--size-popover-max)]"} rounded-md border border-[var(--c-border)] bg-[var(--c-card)] p-3 text-[length:var(--text-ui-size)] text-[var(--c-text)] shadow-[var(--elevation-3)]`}>
          {children}
        </P.Content>
      </P.Portal>
    </P.Root>
  );
}
