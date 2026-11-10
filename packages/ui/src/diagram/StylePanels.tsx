import { useState } from "react";
import { useTranslation } from "react-i18next";
import { CAPS, DASHES, EDGE_WIDTHS, NODE_STROKE_WIDTHS, type Cap, type DEdge, type DNode, type EdgeStyle, type NodeStyle } from "@vnote/core";
import { ColorPicker } from "./ColorPicker";
import { hasLowContrast } from "./diagramContrast";
import { loadRecentColors, pushRecentColor } from "./recentColors";

const currentTheme = (): "light" | "dark" => (typeof document !== "undefined" && document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light");

/** Últimos colores personalizados de este dispositivo: se actualizan al aplicar un color con su valor propio. */
export function useRecents(): [string[], (c: string) => void] {
  const [list, setList] = useState<string[]>(() => loadRecentColors());
  return [list, (c) => setList(pushRecentColor(c))];
}

type DefaultsActions = { onUse: () => void; onReset: () => void } | null;
type FormatActions = { onCopy: () => void; onPaste: () => void };

/** Estilo de las formas seleccionadas: relleno (con opacidad), contorno y color del texto; vale para una o varias. */
export function ShapeStylePanel({ nodes, onPatch, defaults, format }: { nodes: DNode[]; onPatch: (p: Partial<NodeStyle>) => void; defaults: DefaultsActions; format: FormatActions }) {
  const { t } = useTranslation();
  const [recents, push] = useRecents();
  const st = nodes[0]!.style;
  const apply = (p: Partial<NodeStyle>) => { for (const v of Object.values(p)) if (typeof v === "string") push(v); onPatch(p); };
  const low = nodes.some((n) => hasLowContrast(n.style.textColor, n.style.fill, n.style.fillOpacity, currentTheme()));
  return (
    <div role="group" aria-label={t("diagram.shapeStyle")} className="flex flex-wrap items-start gap-4">
      <ColorPicker label={t("diagram.fillColor")} role="fill" allowNone value={st.fill} recents={recents} onChange={(v) => apply({ fill: v })} />
      <label className="flex flex-col gap-1 text-xs">{t("diagram.fillOpacity")}
        <span className="flex items-center gap-1">
          <input type="range" aria-label={t("diagram.fillOpacity")} min={0} max={100} step={5} value={Math.round(st.fillOpacity * 100)} onChange={(e) => apply({ fillOpacity: Number(e.target.value) / 100 })} />
          <output>{Math.round(st.fillOpacity * 100)} %</output>
        </span>
      </label>
      <ColorPicker label={t("diagram.strokeColor")} role="stroke" value={st.stroke} recents={recents} onChange={(v) => apply({ stroke: v })} />
      <div className="flex flex-col gap-2 text-xs">
        <label className="flex flex-col gap-1">{t("diagram.strokeWidth")}
          <select aria-label={t("diagram.strokeWidth")} value={st.strokeWidth} onChange={(e) => apply({ strokeWidth: Number(e.target.value) as NodeStyle["strokeWidth"] })}>
            {NODE_STROKE_WIDTHS.map((w) => <option key={w} value={w}>{w} px</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1">{t("diagram.strokeDash")}
          <select aria-label={t("diagram.strokeDash")} value={st.strokeDash} onChange={(e) => apply({ strokeDash: e.target.value as NodeStyle["strokeDash"] })}>
            {DASHES.map((d) => <option key={d} value={d}>{t(`diagram.dashes.${d}`)}</option>)}
          </select>
        </label>
      </div>
      <ColorPicker label={t("diagram.textColor")} role="text" value={st.textColor} recents={recents} onChange={(v) => apply({ textColor: v })} />
      {low && <p data-contrast-warning="" role="status" className="basis-full text-xs text-[var(--c-warning)]">{t("diagram.lowContrast")}</p>}
      <div className="flex basis-full flex-wrap gap-2">
        <button type="button" onClick={format.onCopy}>{t("diagram.copyFormat")}</button>
        <button type="button" onClick={format.onPaste}>{t("diagram.pasteFormat")}</button>
        {defaults && <button type="button" onClick={defaults.onUse}>{t("diagram.useDefault")}</button>}
        {defaults && <button type="button" onClick={defaults.onReset}>{t("diagram.resetDefaults")}</button>}
      </div>
    </div>
  );
}

/** Estilo del conector: color, grosor, tipo de línea, punta de cada extremo y color del texto. */
export function EdgeStylePanel({ edge, onPatch, defaults, format }: { edge: DEdge; onPatch: (p: Partial<EdgeStyle>) => void; defaults: DefaultsActions; format: FormatActions }) {
  const { t } = useTranslation();
  const [recents, push] = useRecents();
  const st = edge.style;
  const apply = (p: Partial<EdgeStyle>) => { for (const v of Object.values(p)) if (typeof v === "string") push(v); onPatch(p); };
  const capSelect = (label: string, key: "startCap" | "endCap") => (
    <label className="flex flex-col gap-1 text-xs">{label}
      <select aria-label={label} value={st[key]} onChange={(e) => apply({ [key]: e.target.value as Cap })}>
        {CAPS.map((c) => <option key={c} value={c}>{t(`diagram.caps.${c}`)}</option>)}
      </select>
    </label>
  );
  return (
    <div role="group" aria-label={t("diagram.edgeStyle")} className="flex flex-wrap items-start gap-4">
      <ColorPicker label={t("diagram.lineColor")} role="stroke" value={st.color} recents={recents} onChange={(v) => apply({ color: v })} />
      <div className="flex flex-col gap-2 text-xs">
        <label className="flex flex-col gap-1">{t("diagram.lineWidth")}
          <select aria-label={t("diagram.lineWidth")} value={st.width} onChange={(e) => apply({ width: e.target.value as EdgeStyle["width"] })}>
            {EDGE_WIDTHS.map((w) => <option key={w} value={w}>{t(`diagram.widths.${w}`)}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1">{t("diagram.lineDash")}
          <select aria-label={t("diagram.lineDash")} value={st.dash} onChange={(e) => apply({ dash: e.target.value as EdgeStyle["dash"] })}>
            {DASHES.map((d) => <option key={d} value={d}>{t(`diagram.dashes.${d}`)}</option>)}
          </select>
        </label>
      </div>
      <div className="flex flex-col gap-2">{capSelect(t("diagram.startCap"), "startCap")}{capSelect(t("diagram.endCap"), "endCap")}</div>
      <ColorPicker label={t("diagram.edgeTextColor")} role="text" value={st.textColor} recents={recents} onChange={(v) => apply({ textColor: v })} />
      <div className="flex basis-full flex-wrap gap-2">
        <button type="button" onClick={format.onCopy}>{t("diagram.copyFormat")}</button>
        <button type="button" onClick={format.onPaste}>{t("diagram.pasteFormat")}</button>
        {defaults && <button type="button" onClick={defaults.onUse}>{t("diagram.useDefault")}</button>}
        {defaults && <button type="button" onClick={defaults.onReset}>{t("diagram.resetDefaults")}</button>}
      </div>
    </div>
  );
}
