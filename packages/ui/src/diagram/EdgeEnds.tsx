import { useTranslation } from "react-i18next";
import { ANCHORS, anchorPosition, isAttached, type DEdge, type Diagram, type Endpoint } from "@vnote/core";
import { nodeLabel } from "./labels";
import { FIELD_CONTROL, FIELD_LABEL } from "./panelStyles";
import { Dropdown } from "../components/ChoiceMenu";

const FREE = "__free__";
type End = "from" | "to";

/** Panel de extremos del conector: forma y punto de unión (o posición libre) de origen y destino. Equivale a arrastrar, con teclado y lector de pantalla. */
export function EdgeEnds({ diagram, edge, onChange }: { diagram: Diagram; edge: DEdge; onChange: (end: End, target: Endpoint) => void }) {
  const { t } = useTranslation();
  const one = (end: End, title: string) => {
    const e = edge[end];
    const field = (name: string) => `${title}: ${name}`;
    const attached = isAttached(e);
    const pickShape = (id: string) => {
      if (id === FREE) {
        const n = attached ? diagram.nodes.find((x) => x.id === e.node) : undefined;
        if (n && attached) onChange(end, anchorPosition(n, e.anchor));
        return;
      }
      onChange(end, { node: id, anchor: attached ? e.anchor : end === "from" ? "e" : "w" });
    };
    const setPoint = (axis: "x" | "y", raw: string) => {
      if (raw.trim() === "" || isAttached(e)) return;
      const v = Number(raw);
      if (Number.isFinite(v)) onChange(end, { x: e.x, y: e.y, [axis]: v });
    };
    return (
      <fieldset key={end} className="flex flex-wrap items-end gap-2 rounded-[var(--radius-md)] border border-[var(--c-border)] p-2">
        <legend className="px-1 text-[length:var(--text-note-size)] font-medium text-[var(--c-text-muted)]">{title}</legend>
        <label className={FIELD_LABEL}>{t("diagram.endShape")}
          <Dropdown aria-label={field(t("diagram.endShape"))} value={attached ? e.node : FREE} onChange={(ev) => pickShape(ev.target.value)}>
            {diagram.nodes.map((n) => <option key={n.id} value={n.id}>{nodeLabel(t, n)}</option>)}
            <option value={FREE}>{t("diagram.endFree")}</option>
          </Dropdown>
        </label>
        {attached ? (
          <label className={FIELD_LABEL}>{t("diagram.endAnchor")}
            <Dropdown aria-label={field(t("diagram.endAnchor"))} value={e.anchor} onChange={(ev) => onChange(end, { node: e.node, anchor: ev.target.value as typeof e.anchor })}>
              {ANCHORS.map((a) => <option key={a} value={a}>{t(`diagram.anchors.${a}`)}</option>)}
            </Dropdown>
          </label>
        ) : (
          <>
            <label className={FIELD_LABEL}>{t("diagram.endX")}
              <input type="number" aria-label={field(t("diagram.endX"))} value={e.x} onChange={(ev) => setPoint("x", ev.target.value)} className={`w-24 ${FIELD_CONTROL}`} />
            </label>
            <label className={FIELD_LABEL}>{t("diagram.endY")}
              <input type="number" aria-label={field(t("diagram.endY"))} value={e.y} onChange={(ev) => setPoint("y", ev.target.value)} className={`w-24 ${FIELD_CONTROL}`} />
            </label>
          </>
        )}
      </fieldset>
    );
  };
  return <div className="flex flex-wrap gap-3">{one("from", t("diagram.origin"))}{one("to", t("diagram.destination"))}</div>;
}
