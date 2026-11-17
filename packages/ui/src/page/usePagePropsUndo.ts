import { useEffect } from "react";
import type { WorkspaceController } from "../workspace/controller";

const isEditing = (el: EventTarget | null): boolean =>
  el instanceof HTMLElement && el.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]') !== null;

/**
 * Ctrl+Z / Ctrl+Mayús+Z (o Ctrl+Y) fuera del editor y de los campos de texto deshacen y rehacen el último cambio de
 * portada, estilo, descripción o bloqueo de la página (RF-3.5, RF-4.6). Dentro del editor manda el historial del texto.
 */
export function usePagePropsUndo(controller: WorkspaceController, pageId: string): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey || isEditing(e.target)) return;
      const k = e.key.toLowerCase();
      if (k === "z" && !e.shiftKey) { if (controller.canUndoPageProps(pageId)) { e.preventDefault(); void controller.undoPageProps(pageId); } }
      else if ((k === "z" && e.shiftKey) || k === "y") { if (controller.canRedoPageProps(pageId)) { e.preventDefault(); void controller.redoPageProps(pageId); } }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [controller, pageId]);
}
