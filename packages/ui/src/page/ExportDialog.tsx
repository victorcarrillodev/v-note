import { useEffect, useRef, useState } from "react";
import { ProgressIndicator } from "../components/ProgressIndicator";
import { InlineAlert } from "../components/InlineAlert";
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { useTranslation } from "react-i18next";
import type { AssetStore } from "@vnote/core";
import type { WorkspaceController } from "../workspace/controller";

/** Lo que cada plataforma aporta para entregar la exportación: guardar el HTML o abrir el diálogo de impresión (para guardar como PDF). */
export type ExportRuntime = {
  /** Devuelve la ruta donde quedó el archivo, si la plataforma la conoce (en la web lo descarga el navegador). */
  saveHtml(fileName: string, html: string): Promise<string | void>;
  printHtml(html: string): Promise<void>;
};

/** Nombre de archivo seguro a partir del título: sin separadores de ruta ni caracteres reservados. */
export function exportFileName(title: string, ext: string): string {
  // eslint-disable-next-line no-control-regex
  const base = title.replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_").replace(/\s+/g, " ").trim().replace(/^\.+/, "").slice(0, 80).trim();
  return `${base || "Sin título"}.${ext}`;
}

type Phase = "idle" | "running" | "done";

/** Exportar una página a HTML o PDF, con o sin hijas (RF-24). Muestra el avance, se puede cancelar y avisa de los adjuntos que faltan. */
export function ExportDialog({ controller, pageId, assets, runtime, onClose }: { controller: WorkspaceController; pageId: string; assets: AssetStore; runtime: ExportRuntime; onClose: () => void }) {
  const { t } = useTranslation();
  const [format, setFormat] = useState<"html" | "pdf">("html");
  const [withChildren, setWithChildren] = useState(false);
  const [views, setViews] = useState<{ id: string; name: string }[]>([]);
  const [viewId, setViewId] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState({ done: 0, total: 1 });
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const ac = useRef<AbortController | null>(null);

  useEffect(() => { void controller.exportViews(pageId).then((v) => { setViews(v); setViewId(v[0]?.id ?? ""); }); }, [controller, pageId]);
  useEffect(() => () => ac.current?.abort(), []);

  const title = (() => {
    const find = (ns: ReturnType<typeof controller.getSnapshot>["tree"]): string | null => { for (const n of ns) { if (n.page.id === pageId) return n.page.title; const r = find(n.children); if (r !== null) return r; } return null; };
    return find(controller.getSnapshot().tree) ?? "";
  })();

  const run = async () => {
    setError(null); setNotice(null); setWarning(null); setPhase("running"); setProgress({ done: 0, total: 1 });
    const controllerAbort = new AbortController();
    ac.current = controllerAbort;
    try {
      const r = await controller.exportPages(pageId, { withChildren, ...(viewId ? { viewId } : {}), assets, signal: controllerAbort.signal, onProgress: (done, total) => setProgress({ done, total }) });
      if (!r.ok) { setError(r.error.message); setPhase("idle"); return; }
      if (r.value.status === "cancelled") { setNotice(t("export.cancelled")); setPhase("idle"); return; }
      const { html, report } = r.value;
      const savedTo = format === "html" ? await runtime.saveHtml(exportFileName(title, "html"), html) : await runtime.printHtml(html);
      if (!savedTo && report.missing.length === 0 && report.warnings.length === 0) { onClose(); return; }
      setNotice([...(savedTo ? [t("export.savedTo", { path: savedTo })] : [])].join(" "));
      setWarning([...(report.missing.length ? [t("export.missing", { names: report.missing.map((m) => m.name || m.url).join(", ") })] : []), ...report.warnings].join(" "));
      setPhase("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPhase("idle");
    } finally { ac.current = null; }
  };

  const running = phase === "running";
  return (
    <AlertDialog.Root open onOpenChange={(o) => { if (!o && !running) onClose(); }}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 bg-black/40" />
        <AlertDialog.Content className="fixed left-1/2 top-1/2 w-[28rem] -translate-x-1/2 -translate-y-1/2 rounded bg-[var(--bg)] p-4 shadow">
          <AlertDialog.Title className="font-semibold">{t("export.title")}</AlertDialog.Title>
          <AlertDialog.Description className="my-2 text-sm">{t("export.description")}</AlertDialog.Description>

          <fieldset className="mb-2 flex gap-4" disabled={running}>
            <legend className="sr-only">{t("export.format")}</legend>
            <label className="flex items-center gap-1"><input type="radio" name="export-format" checked={format === "html"} onChange={() => setFormat("html")} /> HTML</label>
            <label className="flex items-center gap-1"><input type="radio" name="export-format" checked={format === "pdf"} onChange={() => setFormat("pdf")} /> PDF</label>
          </fieldset>
          {format === "pdf" && <p className="mb-2 text-sm opacity-80">{t("export.pdfHint")}</p>}

          <label className="mb-2 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={withChildren} disabled={running} onChange={(e) => setWithChildren(e.target.checked)} />
            {t("export.withChildren")}
          </label>

          {views.length > 1 && (
            <label className="mb-2 flex flex-col gap-1 text-sm">
              {t("export.view")}
              <select value={viewId} disabled={running} onChange={(e) => setViewId(e.target.value)}>
                {views.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </label>
          )}

          {running && (
            <div className="mb-2">
              <ProgressIndicator label={t("export.progress")} done={progress.done} total={progress.total} cancelLabel={t("export.cancel")} />
            </div>
          )}
          {notice && <p role="status" className="mb-2 text-sm">{notice}</p>}
          {warning && <div className="mb-2"><InlineAlert tone="warning">{warning}</InlineAlert></div>}
          {error && <InlineAlert tone="error">{t("export.failed", { message: error })}</InlineAlert>}

          <div className="flex justify-end gap-2">
            {running ? (
              <button type="button" onClick={() => ac.current?.abort()}>{t("export.cancel")}</button>
            ) : (
              <>
                <button type="button" onClick={onClose}>{phase === "done" ? t("export.close") : t("page.cancel")}</button>
                {phase !== "done" && <button type="button" onClick={() => void run()}>{t("export.run")}</button>}
              </>
            )}
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
