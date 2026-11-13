import { useTranslation } from "react-i18next";
import { Icon } from "../design/Icon";
import type { IconName } from "../design/iconMap";
import { cx } from "../design/cx";

// Botones: 32 px (44 px con puntero grueso), ícono y texto con el texto principal para cumplir contraste, y los cinco estados.
const BTN = cx(
  "inline-flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] text-[var(--c-text-muted)] transition-colors duration-100 hover:text-[var(--c-text)]",
  "[@media(pointer:coarse)]:h-11 [@media(pointer:coarse)]:w-11",
  "hover:bg-[var(--c-raised)] active:bg-[var(--c-border)] focus-visible:outline-2 focus-visible:outline-[var(--c-accent)]",
  "disabled:cursor-not-allowed disabled:text-[var(--c-text-disabled)]",
);

/** Controles de zoom del lienzo del diagrama (RF-15, RF-16). Sustituyen a los de la librería, que no usan los tokens del estándar. */
export function CanvasControls({ zoom, minZoom, maxZoom, onZoomIn, onZoomOut, onFit, onReset }: { zoom: number; minZoom: number; maxZoom: number; onZoomIn: () => void; onZoomOut: () => void; onFit: () => void; onReset?: () => void }) {
  const { t } = useTranslation();
  const btn = (icon: IconName, label: string, onClick: () => void, disabled = false) => (
    <button type="button" aria-label={label} title={label} onClick={onClick} disabled={disabled} className={BTN}><Icon name={icon} size={16} /></button>
  );
  return (
    <div
      role="group" aria-label={t("diagram.zoomControls")} data-canvas-controls
      className="absolute bottom-3 left-3 z-[var(--z-sticky)] flex items-center gap-0.5 rounded-[var(--radius-lg)] border border-[var(--c-border-control)] bg-[var(--c-card)] p-0.5 text-[var(--c-text)] shadow-[var(--elevation-2)]"
    >
      {btn("zoomOut", t("diagram.zoomOut"), onZoomOut, zoom <= minZoom + 1e-9)}
      {/* El porcentaje es a la vez el botón que vuelve al 100 % (como en los lienzos de referencia): un control menos en la barra. */}
      {onReset ? (
        <button type="button" aria-label={t("canvas.frame.zoomReset")} title={t("canvas.frame.zoomReset")} onClick={onReset} className={cx(BTN, "w-auto min-w-[5ch] whitespace-nowrap px-1.5 text-[length:var(--text-ui-small-size)] tabular-nums text-[var(--c-text)]")}>
          <output aria-label={t("diagram.zoomLevel")}>{Math.round(zoom * 100)} %</output>
        </button>
      ) : <output aria-label={t("diagram.zoomLevel")} className="min-w-[5ch] whitespace-nowrap text-center text-[length:var(--text-ui-small-size)] tabular-nums">{Math.round(zoom * 100)} %</output>}
      {btn("zoomIn", t("diagram.zoomIn"), onZoomIn, zoom >= maxZoom - 1e-9)}
      <span aria-hidden="true" className="mx-0.5 h-4 w-px bg-[var(--c-border)]" />
      {btn("fitView", t("diagram.fit"), onFit)}
    </div>
  );
}
