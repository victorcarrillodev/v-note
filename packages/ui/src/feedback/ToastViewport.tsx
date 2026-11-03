import * as T from "@radix-ui/react-toast";
import { useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import { Icon } from "../design/Icon";
import { Button } from "../components/Button";
import type { createToastStore } from "./toastStore";

type Store = ReturnType<typeof createToastStore>;

/** Avisos temporales apilados abajo y al centro del área de contenido; la cuenta se pausa con el cursor o el foco; Escape cierra. */
export function ToastViewport({ store }: { store: Store }) {
  const { t } = useTranslation();
  const { visible } = useSyncExternalStore(store.subscribe, store.getSnapshot);
  return (
    <T.Provider swipeDirection="down">
      <T.Viewport data-toast-viewport role="region" label={t("toast.region", { defaultValue: "Avisos" })} className="fixed bottom-6 left-1/2 z-[var(--z-toast)] pointer-events-none m-0 flex w-[var(--size-popover-max)] max-w-[calc(100vw-var(--space-12))] -translate-x-1/2 list-none flex-col gap-2 p-0 outline-none">
      {visible.map((toast) => (
        <T.Root key={toast.id} role="status" duration={toast.duration} onOpenChange={(open) => { if (!open) store.dismiss(toast.id); }} className="pointer-events-auto flex items-center gap-3 rounded-md border border-[var(--c-border)] bg-[var(--c-card)] px-4 py-3 text-[length:var(--text-ui-size)] text-[var(--c-text)] shadow-[var(--elevation-3)]">
          <span className={toast.tone === "success" ? "text-[var(--c-success)]" : "text-[var(--c-accent)]"}><Icon name={toast.tone === "success" ? "success" : "info"} size={20} /></span>
          <T.Description className="min-w-0 flex-1">{toast.message}</T.Description>
          {toast.undo && (
            <T.Action altText={toast.undo.label} asChild>
              <Button size="sm" onClick={() => { toast.undo!.run(); store.dismiss(toast.id); }}>{toast.undo.label}</Button>
            </T.Action>
          )}
          <T.Close aria-label={t("toast.close", { defaultValue: "Cerrar aviso" })} className="rounded p-1 hover:bg-[var(--c-raised)]"><Icon name="close" /></T.Close>
        </T.Root>
      ))}
      </T.Viewport>
    </T.Provider>
  );
}
