import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

/** Diseño principal: barra lateral (ocultable) y área de página. Las etiquetas vienen de i18n. */
export function AppShell({ sidebar, children }: { sidebar: ReactNode; children: ReactNode }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(true);
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[var(--bg)] text-[var(--fg)]">
      <a href="#contenido" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-[var(--bg)] focus:px-3 focus:py-2">
        {t("shell.skipToContent")}
      </a>
      <aside id="barra-lateral" aria-label={t("shell.sidebar")} hidden={!open} className="w-72 shrink-0 overflow-y-auto border-r border-[var(--border)]">
        {sidebar}
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center border-b border-[var(--border)] px-2 py-1">
          <button
            type="button"
            aria-expanded={open}
            aria-controls="barra-lateral"
            onClick={() => setOpen((o) => !o)}
            className="rounded px-2 py-1 hover:bg-[var(--hover)]"
          >
            <span className="sr-only">{open ? t("shell.hideSidebar") : t("shell.showSidebar")}</span>
            <span aria-hidden="true">☰</span>
          </button>
        </div>
        <main id="contenido" className="min-h-0 flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
