import { useTranslation } from "react-i18next";
import { Icon } from "../design/Icon";
import type { IconName } from "../design/iconMap";
import { cx } from "../design/cx";

// Botones: 32 px (44 px con puntero grueso), ícono y texto con el texto principal para cumplir contraste, y los cinco estados.
const BTN = cx(
  "inline-flex h-8 w-8 items-center justify-center rounded border border-transparent text-[var(--c-text)] transition-colors duration-100",
  "[@media(pointer:coarse)]:h-11 [@media(pointer:coarse)]:w-11",
  "hover:bg-[var(--c-raised)] active:bg-[var(--c-border)] focus-visible:outline-2 focus-visible:outline-[var(--c-accent)]",
  "disabled:cursor-not-allowed disabled:text-[var(--c-text-disabled)]",
);

/** Controles de zoom del lienzo del diagrama (RF-15, RF-16). Sustituyen a los de la librería, que no usan los tokens del estándar. */
export function CanvasControls({ zoom, minZoom, maxZoom, onZoomIn, onZoomOut, onFit }: { zoom: number; minZoom: number; maxZoom: number; onZoomIn: () => void; onZoomOut: () => void; onFit: () => void }) {
  const { t } = useTranslation();
  const btn = (icon: IconName, label: string, onClick: () => void, disabled = false) => (
    <button type="button" aria-label={label} title={label} onClick={onClick} disabled={disabled} className={BTN}><Icon name={icon} size={20} /></button>
  );
  return (
    <div
      role="group" aria-label={t("diagram.zoomControls")} data-canvas-controls
      className="absolute bottom-3 left-3 z-[var(--z-sticky)] flex items-center gap-1 rounded-[var(--radius-md)] border border-[var(--c-border-control)] bg-[var(--c-card)] p-1 text-[var(--c-text)] shadow-[var(--elevation-1)]"
    >
      {btn("zoomOut", t("diagram.zoomOut"), onZoomOut, zoom <= minZoom + 1e-9)}
      <output aria-label={t("diagram.zoomLevel")} className="min-w-[4ch] text-center text-[length:var(--text-ui-size)] tabular-nums">{Math.round(zoom * 100)} %</output>
      {btn("zoomIn", t("diagram.zoomIn"), onZoomIn, zoom >= maxZoom - 1e-9)}
      {btn("fitView", t("diagram.fit"), onFit)}
    </div>
  );
}
