import { useTranslation } from "react-i18next";
import { FIELD_CONTROL, FIELD_LABEL, PANEL_BUTTON } from "./panelStyles";
import { CURVATURE_MAX, CURVATURE_MIN, DEFAULT_CURVATURE, ROUTES, type DEdge, type Point, type Route } from "@vnote/core";
import { Checkbox } from "../components/controls";
import { Dropdown } from "../components/ChoiceMenu";

/** Controles del trazado del conector seleccionado: son la vía de teclado equivalente a arrastrar tramos, asas y puntos (RF-18, DP-10). */
export function RouteControls({ edge, onRoute, onReset, onCurvature, onSmooth, onPointChange, onAddPoint, onRemovePoint }: {
  edge: DEdge; onRoute: (r: Route) => void; onReset: () => void; onCurvature: (v: number) => void; onSmooth: (v: boolean) => void;
  onPointChange: (index: number, p: Point) => void; onAddPoint: () => void; onRemovePoint: (index: number) => void;
}) {
  const { t } = useTranslation();
  const points = edge.points ?? [];
  return (
    <div className="flex flex-wrap items-end gap-3">
      <label className={FIELD_LABEL}>{t("diagram.route")}
        <Dropdown aria-label={t("diagram.route")} value={edge.route} onChange={(e) => onRoute(e.target.value as Route)}>
          {ROUTES.map((r) => <option key={r} value={r}>{t(`diagram.routes.${r}`)}</option>)}
        </Dropdown>
      </label>
      {edge.route === "orthogonal" && (edge.waypoints?.length ?? 0) > 0 && <button type="button" className={PANEL_BUTTON} onClick={onReset}>{t("diagram.resetRoute")}</button>}
      {edge.route === "curved" && (
        <label className={FIELD_LABEL}>{t("diagram.curvature")}
          <input type="range" className="w-28 accent-[var(--c-accent)]" aria-label={t("diagram.curvature")} min={CURVATURE_MIN} max={CURVATURE_MAX} step={0.05} value={edge.curvature ?? DEFAULT_CURVATURE} onChange={(e) => onCurvature(Number(e.target.value))} />
        </label>
      )}
      {edge.route === "orthogonal" && <p className="max-w-[28ch] text-[length:var(--text-ui-small-size)] text-[var(--c-text-muted)]">{t("diagram.autoCornersHint")}</p>}
      {(edge.route === "free" || edge.route === "curved") && (
        <>
          {edge.route === "free" && <Checkbox className="text-[length:var(--text-ui-small-size)]" label={t("diagram.smooth")} checked={edge.smooth ?? false} onChange={onSmooth} />}
          <div role="group" aria-label={t("diagram.controlPoints")} className="flex flex-col gap-1">
            {points.map((q, i) => (
              <div key={i} className="flex items-end gap-2">
                <input type="number" className={`w-20 ${FIELD_CONTROL}`} aria-label={t("diagram.pointX", { n: i + 1 })} value={q.x} onChange={(e) => Number.isFinite(Number(e.target.value)) && e.target.value !== "" && onPointChange(i, { x: Number(e.target.value), y: q.y })} />
                <input type="number" className={`w-20 ${FIELD_CONTROL}`} aria-label={t("diagram.pointY", { n: i + 1 })} value={q.y} onChange={(e) => Number.isFinite(Number(e.target.value)) && e.target.value !== "" && onPointChange(i, { x: q.x, y: Number(e.target.value) })} />
                <button type="button" className={PANEL_BUTTON} onClick={() => onRemovePoint(i)}>{t("diagram.removePoint", { n: i + 1 })}</button>
              </div>
            ))}
            <button type="button" className={PANEL_BUTTON} onClick={onAddPoint}>{t("diagram.addPoint")}</button>
          </div>
        </>
      )}
    </div>
  );
}
