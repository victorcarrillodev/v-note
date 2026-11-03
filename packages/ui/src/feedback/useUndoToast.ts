import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useToasts } from "./ToastContext";

/** Anuncia una acción ya hecha con un aviso temporal y el botón «Deshacer» (RF-11.1). */
export function useUndoToast() {
  const { t } = useTranslation();
  const toasts = useToasts();
  return useCallback((key: string, message: string, undo: () => Promise<void>) => {
    toasts.add({ key, tone: "success", message, undo: { label: t("toast.undo", { defaultValue: "Deshacer" }), run: () => void undo() } });
  }, [toasts, t]);
}
