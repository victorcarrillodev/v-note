import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { PreferenceStore } from "../theme/theme";
import { IconButton } from "../components/IconButton";
import { sidebarMode, layoutMode, type LayoutMode } from "./layoutMode";

type ShellCtx = { closeOverlay: () => void; mode: LayoutMode };
const ShellContext = createContext<ShellCtx>({ closeOverlay: () => {}, mode: "wide" });
/** Para que una pantalla (por ejemplo, el árbol) cierre el panel superpuesto de la barra lateral al elegir una página. */
export const useShell = (): ShellCtx => useContext(ShellContext);

function useWindowWidth(): number {
  const [w, setW] = useState(() => (typeof window === "undefined" ? 1280 : window.innerWidth));
  useEffect(() => {
    const on = () => setW(window.innerWidth);
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  return w;
}

/**
 * Marco de la ventana (RF-3, RF-15): barra lateral de 240 px, cabecera de 44 px y contenido. Misma posición en todas las pantallas.
 * Por debajo de 1 040 px la barra se pliega sola y se abre superpuesta con velo. Por debajo de 900 px el contenido de lectura sigue reflujando (también al 200 % de zoom);
 * lo que no cabe (tablas, tablero, calendario) se desplaza por sí solo dentro de su región (ScrollRegion).
 */
export function AppShell({ sidebar, header, children, preferences }: { sidebar: ReactNode; header?: ReactNode; children: ReactNode; preferences?: PreferenceStore }) {
  const { t } = useTranslation();
  const width = useWindowWidth();
  const mode = layoutMode(width);
  const overlay = sidebarMode(width) === "overlay";
  const [docked, setDocked] = useState(() => preferences?.get("sidebar") !== "closed");
  const [overlayOpen, setOverlayOpen] = useState(false);
  const visible = overlay ? overlayOpen : docked;

  const toggle = useCallback(() => {
    if (overlay) { setOverlayOpen((o) => !o); return; }
    setDocked((d) => { preferences?.set("sidebar", d ? "closed" : "open"); return !d; });
  }, [overlay, preferences]);
  const closeOverlay = useCallback(() => setOverlayOpen(false), []);
  useEffect(() => { if (!overlay) setOverlayOpen(false); }, [overlay]);

  // Atajo del marco (Ctrl/Cmd + \) y Escape para cerrar el panel superpuesto.
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "\\") { e.preventDefault(); toggle(); }
      else if (e.key === "Escape" && overlay && overlayOpen) setOverlayOpen(false);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [toggle, overlay, overlayOpen]);

  const ctx = useMemo(() => ({ closeOverlay, mode }), [closeOverlay, mode]);
  const label = visible ? t("shell.hideSidebar") : t("shell.showSidebar");

  return (
    <ShellContext.Provider value={ctx}>
      <div className={`h-screen w-screen bg-[var(--c-canvas)] text-[var(--c-text)] ${mode === "scroll" ? "overflow-x-auto" : "overflow-hidden"}`}>
        <div className="flex h-full">
          <a href="#contenido" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-[var(--z-skip-link)] focus:rounded focus:bg-[var(--c-card)] focus:px-3 focus:py-2">
            {t("shell.skipToContent")}
          </a>
          {overlay && visible && <div data-shell-scrim onClick={closeOverlay} className="fixed inset-0 z-[var(--z-sidebar-overlay)] bg-[var(--c-scrim)]" />}
          <aside
            id="barra-lateral"
            aria-label={t("shell.sidebar")}
            style={{
              visibility: visible ? "visible" : "hidden",
              transition: `${overlay ? "transform" : "width"} var(--motion-slow) var(--ease-out), visibility 0s linear ${visible ? "0s" : "var(--motion-slow)"}`,
              ...(overlay ? { transform: visible ? "translateX(0)" : "translateX(-100%)" } : { width: visible ? "var(--size-sidebar-width)" : "0px" }),
            }}
            className={
              overlay
                ? "fixed left-0 top-0 z-[calc(var(--z-sidebar-overlay)+1)] h-full w-[var(--size-sidebar-width)] overflow-hidden border-r border-[var(--c-border)] bg-[var(--c-sidebar)] shadow-[var(--elevation-3)]"
                : "w-[var(--size-sidebar-width)] shrink-0 overflow-hidden bg-[var(--c-sidebar)]"
            }
          >
            <div className={`h-full w-[var(--size-sidebar-width)] overflow-y-auto ${overlay ? "" : "border-r border-[var(--c-border)]"}`}>{sidebar}</div>
          </aside>
          <div className="flex min-w-0 flex-1 flex-col">
            <header className="flex h-[var(--size-header-height)] shrink-0 items-center gap-2 border-b border-[var(--c-border)] bg-[var(--c-canvas)] px-3">
              <IconButton icon="sidebar" label={label} aria-expanded={visible} aria-controls="barra-lateral" onClick={toggle} />
              <div className="flex min-w-0 flex-1 items-center gap-2">{header}</div>
            </header>
            <main id="contenido" className="min-h-0 flex-1 overflow-y-auto [container-type:inline-size]">{children}</main>
          </div>
        </div>
      </div>
    </ShellContext.Provider>
  );
}
