import * as T from "@radix-ui/react-tooltip";
import type { ReactNode } from "react";

/** Compatibilidad: cada `Tooltip` lleva su propio proveedor (500 ms con ratón; con foco por teclado, al instante), así que este envoltorio es opcional. */
export function TooltipProvider({ children }: { children: ReactNode }) {
  return <T.Provider delayDuration={500} skipDelayDuration={200}>{children}</T.Provider>;
}

/** Descripción corta de un control, normalmente solo de ícono. Nunca contiene información esencial. */
export function Tooltip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <T.Provider delayDuration={500} skipDelayDuration={200}>
    <T.Root>
      <T.Trigger asChild>{children}</T.Trigger>
      <T.Portal>
        <T.Content
          sideOffset={4}
          className="z-[var(--z-tooltip)] rounded bg-[var(--c-text)] px-2 py-1 text-[length:var(--text-note-size)] text-[var(--c-canvas)]"
        >
          {label}
        </T.Content>
      </T.Portal>
    </T.Root>
    </T.Provider>
  );
}
