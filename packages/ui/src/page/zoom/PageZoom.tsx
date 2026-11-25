import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { PreferenceStore } from "../../theme/theme";
import { IconButton } from "../../components/IconButton";
import { ZoomContext } from "./zoomContext";
import "./pageZoom.css";

const MIN = 50, MAX = 200, STEP = 10;
/** Recorrido de rueda que equivale a un paso: una muesca de ratón lo supera; el panel táctil envía muchos valores pequeños. */
const WHEEL_THRESHOLD = 50;
/** Tiempo que el indicador sigue visible al volver al 100 %. */
const LINGER_MS = 2500;

const clamp = (n: number) => Math.min(MAX, Math.max(MIN, n));
export const parseZoom = (raw: string | null): number => {
  const n = Number(raw ?? "");
  return Number.isFinite(n) && n > 0 ? clamp(Math.round(n)) : 100;
};
export const stepZoom = (zoom: number, direction: 1 | -1): number => clamp(zoom + direction * STEP);

/** Zoom del contenido (no de los controles) con Ctrl/Cmd + rueda e indicador con controles. El porcentaje se recuerda en las preferencias. */
export function PageZoom({ preferences, children }: { preferences: PreferenceStore; children: ReactNode }) {
  const { t } = useTranslation();
  const [zoom, setZoom] = useState(() => parseZoom(preferences.get("zoom")));
  const [recent, setRecent] = useState(false);
  const [held, setHeld] = useState(false);
  const host = useRef<HTMLDivElement>(null);
  const travel = useRef(0);

  const change = useCallback((next: (z: number) => number) => {
    setZoom((z) => next(z));
    setRecent(true);
  }, []);
  useEffect(() => { preferences.set("zoom", String(zoom)); }, [zoom, preferences]);

  useEffect(() => {
    if (!recent || held || zoom !== 100) return;
    const timer = setTimeout(() => setRecent(false), LINGER_MS);
    return () => clearTimeout(timer);
  }, [recent, held, zoom]);

  useEffect(() => {
    // Se escucha en todo el área desplazable (también los márgenes), sin pasividad para impedir el zoom del navegador.
    const target: HTMLElement | null = host.current?.closest("main") ?? host.current;
    if (!target) return;
    const onWheel = (e: WheelEvent) => {
      // `defaultPrevented`: otro componente (lienzo, grafo) ya usó este gesto para su propio zoom.
      if (!(e.ctrlKey || e.metaKey) || e.defaultPrevented) return;
      e.preventDefault();
      travel.current += e.deltaY;
      if (Math.abs(travel.current) < WHEEL_THRESHOLD) return;
      const direction = travel.current < 0 ? 1 : -1;
      travel.current = 0;
      change((z) => stepZoom(z, direction));
    };
    target.addEventListener("wheel", onWheel, { passive: false });
    return () => target.removeEventListener("wheel", onWheel);
  }, [change]);

  const factor = zoom / 100;
  return (
    <ZoomContext.Provider value={factor}>
      <div ref={host} data-testid="page-zoom" {...(factor === 1 ? {} : { "data-page-zoom": "", style: { "--page-zoom": factor } as CSSProperties })}>{children}</div>
      {(zoom !== 100 || recent) && (
        <div
          role="group"
          aria-label={t("zoom.label")}
          onPointerEnter={() => setHeld(true)}
          onPointerLeave={() => setHeld(false)}
          onFocus={() => setHeld(true)}
          onBlur={() => setHeld(false)}
          className="fixed bottom-4 left-1/2 z-40 flex -translate-x-1/2 items-center gap-1 rounded-[var(--radius-lg)] border border-[var(--c-border)] bg-[var(--c-card)] p-1 shadow-[var(--elevation-3)]"
        >
          <IconButton icon="zoomOut" label={t("zoom.out")} disabled={zoom <= MIN} onClick={() => change((z) => stepZoom(z, -1))} />
          <span role="status" className="min-w-14 text-center text-[length:var(--text-ui-small-size)] tabular-nums">{zoom} %</span>
          <IconButton icon="zoomIn" label={t("zoom.in")} disabled={zoom >= MAX} onClick={() => change((z) => stepZoom(z, 1))} />
          <IconButton icon="restore" label={t("zoom.reset")} disabled={zoom === 100} onClick={() => change(() => 100)} />
        </div>
      )}
    </ZoomContext.Provider>
  );
}
