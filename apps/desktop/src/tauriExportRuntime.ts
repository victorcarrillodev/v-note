import type { ExportRuntime } from "@vnote/ui";

type Invoke = (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;

/**
 * Exportar en escritorio: el HTML se guarda en Descargas (nunca sobrescribe) y se informa la ruta.
 * El PDF usa el diálogo de impresión del sistema («Guardar como PDF»): la impresión directa a archivo no funciona en WebKitGTK (spikes/RESULTS.md, T-023).
 */
export function tauriExportRuntime(invoke: Invoke): ExportRuntime {
  return {
    saveHtml: async (fileName, html) => (await invoke("export_save", { fileName, content: html })) as string,
    printHtml: async (html) => { await invoke("print_html", { html }); },
  };
}
