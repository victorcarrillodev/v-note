import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { CAPS, DASHES, EDGE_WIDTHS, NODE_STROKE_WIDTHS, type Cap, type DEdge, type DNode, type EdgeStyle, type NodeStyle } from "@vnote/core";
import { ColorPicker } from "./ColorPicker";
import { hasLowContrast } from "./diagramContrast";
import { loadRecentColors, pushRecentColor } from "./recentColors";
import { FIELD_CONTROL, FIELD_LABEL, MENU_CHIP, PANEL_BUTTON } from "./panelStyles";
import { fillFor, strokeFor } from "../design/diagramPalette";
import { Icon } from "../design/Icon";

const currentTheme = (): "light" | "dark" => (typeof document !== "undefined" && document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light");

/** Últimos colores personalizados de este dispositivo: se actualizan al aplicar un color con su valor propio. */
export function useRecents(): [string[], (c: string) => void] {
  const [list, setList] = useState<string[]>(() => loadRecentColors());
  return [list, (c) => setList(pushRecentColor(c))];
}

type Section = { id: string; label: string; short?: string; dot?: string; content: ReactNode };

/**
 * Barra compacta de fichas: cada una despliega su sección debajo y solo hay una abierta a la vez (la misma ficha la pliega).
 * Así el menú ocupa una fila hasta que se pide un grupo de controles.
 */
function Sections({ sections, children }: { sections: Section[]; children?: ReactNode }) {
  const [open, setOpen] = useState<string | null>(null);
  const current = sections.find((s) => s.id === open);
  return (
    <>
      <div className="flex flex-wrap items-center gap-0.5">
        {sections.map((s) => (
          <button key={s.id} type="button" aria-label={s.label} title={s.label} aria-expanded={open === s.id} data-section={s.id} onClick={() => setOpen(open === s.id ? null : s.id)} className={MENU_CHIP}>
            {s.dot !== undefined
              ? <span aria-hidden="true" className="h-4 w-4 rounded-[var(--radius-full)] border border-[var(--c-border-control)]" style={{ background: s.dot }} />
              : <Icon name="more" />}
            {s.short ? <span aria-hidden="true">{s.short}</span> : null}
          </button>
        ))}
      </div>
      {current ? <div data-section-body={current.id} className="flex flex-wrap items-start gap-x-4 gap-y-3 px-1 pb-1">{current.content}</div> : null}
      {children}
    </>
  );
}

function FormatButtons({ defaults, format }: { defaults: DefaultsActions; format: FormatActions }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap gap-1.5">
      <button type="button" className={PANEL_BUTTON} onClick={format.onCopy}>{t("diagram.copyFormat")}</button>
      <button type="button" className={PANEL_BUTTON} onClick={format.onPaste}>{t("diagram.pasteFormat")}</button>
      {defaults && <button type="button" className={PANEL_BUTTON} onClick={defaults.onUse}>{t("diagram.useDefault")}</button>}
      {defaults && <button type="button" className={PANEL_BUTTON} onClick={defaults.onReset}>{t("diagram.resetDefaults")}</button>}
    </div>
  );
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
  const sections: Section[] = [
    { id: "fill", label: t("diagram.fillColor"), short: t("diagram.fillColor"), dot: st.fill === "none" ? "transparent" : fillFor(st.fill), content: (
      <>
        <ColorPicker label={t("diagram.fillColor")} role="fill" allowNone value={st.fill} recents={recents} onChange={(v) => apply({ fill: v })} />
        <label className={FIELD_LABEL}>{t("diagram.fillOpacity")}
          <span className="flex h-7 items-center gap-2 text-[var(--c-text)]">
            <input type="range" className="w-28 accent-[var(--c-accent)]" aria-label={t("diagram.fillOpacity")} min={0} max={100} step={5} value={Math.round(st.fillOpacity * 100)} onChange={(e) => apply({ fillOpacity: Number(e.target.value) / 100 })} />
            <output>{Math.round(st.fillOpacity * 100)} %</output>
          </span>
        </label>
      </>
    ) },
    { id: "stroke", label: t("diagram.strokeColor"), short: t("diagram.strokeColor"), dot: strokeFor(st.stroke), content: (
      <>
        <ColorPicker label={t("diagram.strokeColor")} role="stroke" value={st.stroke} recents={recents} onChange={(v) => apply({ stroke: v })} />
        <div className="flex gap-2">
          <label className={FIELD_LABEL}>{t("diagram.strokeWidth")}
            <select className={FIELD_CONTROL} aria-label={t("diagram.strokeWidth")} value={st.strokeWidth} onChange={(e) => apply({ strokeWidth: Number(e.target.value) as NodeStyle["strokeWidth"] })}>
              {NODE_STROKE_WIDTHS.map((w) => <option key={w} value={w}>{w} px</option>)}
            </select>
          </label>
          <label className={FIELD_LABEL}>{t("diagram.strokeDash")}
            <select className={FIELD_CONTROL} aria-label={t("diagram.strokeDash")} value={st.strokeDash} onChange={(e) => apply({ strokeDash: e.target.value as NodeStyle["strokeDash"] })}>
              {DASHES.map((d) => <option key={d} value={d}>{t(`diagram.dashes.${d}`)}</option>)}
            </select>
          </label>
        </div>
      </>
    ) },
    { id: "text", label: t("diagram.textColor"), short: t("diagram.text"), dot: strokeFor(st.textColor), content: (
      <ColorPicker label={t("diagram.textColor")} role="text" value={st.textColor} recents={recents} onChange={(v) => apply({ textColor: v })} />
    ) },
    { id: "more", label: t("diagram.moreOptions"), content: <FormatButtons defaults={defaults} format={format} /> },
  ];
  return (
    <div role="group" aria-label={t("diagram.shapeStyle")} className="flex w-full flex-col gap-1.5">
      <Sections sections={sections}>
        {low && <p data-contrast-warning="" role="status" className="px-1 text-[length:var(--text-ui-small-size)] text-[var(--c-warning)]">{t("diagram.lowContrast")}</p>}
      </Sections>
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
    <label className={FIELD_LABEL}>{label}
      <select className={FIELD_CONTROL} aria-label={label} value={st[key]} onChange={(e) => apply({ [key]: e.target.value as Cap })}>
        {CAPS.map((c) => <option key={c} value={c}>{t(`diagram.caps.${c}`)}</option>)}
      </select>
    </label>
  );
  const sections: Section[] = [
    { id: "line", label: t("diagram.lineSection"), short: t("diagram.lineSection"), dot: strokeFor(st.color), content: (
      <>
        <ColorPicker label={t("diagram.lineColor")} role="stroke" value={st.color} recents={recents} onChange={(v) => apply({ color: v })} />
        <div className="flex flex-wrap gap-2">
          <label className={FIELD_LABEL}>{t("diagram.lineWidth")}
            <select className={FIELD_CONTROL} aria-label={t("diagram.lineWidth")} value={st.width} onChange={(e) => apply({ width: e.target.value as EdgeStyle["width"] })}>
              {EDGE_WIDTHS.map((w) => <option key={w} value={w}>{t(`diagram.widths.${w}`)}</option>)}
            </select>
          </label>
          <label className={FIELD_LABEL}>{t("diagram.lineDash")}
            <select className={FIELD_CONTROL} aria-label={t("diagram.lineDash")} value={st.dash} onChange={(e) => apply({ dash: e.target.value as EdgeStyle["dash"] })}>
              {DASHES.map((d) => <option key={d} value={d}>{t(`diagram.dashes.${d}`)}</option>)}
            </select>
          </label>
          {capSelect(t("diagram.startCap"), "startCap")}{capSelect(t("diagram.endCap"), "endCap")}
        </div>
      </>
    ) },
    { id: "text", label: t("diagram.edgeTextColor"), short: t("diagram.text"), dot: strokeFor(st.textColor), content: (
      <ColorPicker label={t("diagram.edgeTextColor")} role="text" value={st.textColor} recents={recents} onChange={(v) => apply({ textColor: v })} />
    ) },
    { id: "more", label: t("diagram.moreOptions"), content: <FormatButtons defaults={defaults} format={format} /> },
  ];
  return (
    <div role="group" aria-label={t("diagram.edgeStyle")} className="flex w-full flex-col gap-1.5">
      <Sections sections={sections} />
    </div>
  );
}
