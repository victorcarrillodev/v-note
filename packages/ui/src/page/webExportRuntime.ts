import type { ExportRuntime } from "./ExportDialog";

/** Exportar en el navegador: el HTML se descarga como archivo y el PDF se obtiene con el diálogo de impresión («Guardar como PDF»). */
export const webExportRuntime: ExportRuntime = {
  async saveHtml(fileName, html) {
    const url = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  },
  printHtml(html) {
    return new Promise<void>((resolve) => {
      const frame = document.createElement("iframe");
      frame.setAttribute("aria-hidden", "true");
      frame.setAttribute("tabindex", "-1");
      // Sin scripts: el documento exportado es solo contenido. `allow-modals` permite abrir el diálogo de impresión.
      frame.setAttribute("sandbox", "allow-same-origin allow-modals");
      frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
      const cleanup = () => { frame.remove(); resolve(); };
      frame.addEventListener("load", () => {
        const w = frame.contentWindow;
        if (!w) { cleanup(); return; }
        w.addEventListener("afterprint", cleanup);
        w.focus();
        w.print();
        setTimeout(cleanup, 120_000); // por si el navegador nunca avisa del fin de la impresión
      });
      frame.srcdoc = html;
      document.body.appendChild(frame);
    });
  },
};
