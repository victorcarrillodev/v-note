import type { TFunction } from "i18next";
import { isAttached, type DNode, type Diagram, type Endpoint } from "@vnote/core";

/** Nombre de una forma para personas: su texto o, si no tiene, su tipo con «(sin texto)». */
export const nodeLabel = (t: TFunction, n: DNode): string => n.text.trim() || `${t(`diagram.shape.${n.shape}`)} ${t("diagram.noText")}`;
/** «Forma (punto de unión)» o «extremo libre». */
export function endLabel(t: TFunction, d: Diagram, e: Endpoint): string {
  if (!isAttached(e)) return t("diagram.freeEnd");
  const n = d.nodes.find((x) => x.id === e.node);
  return t("diagram.endUnion", { shape: n ? nodeLabel(t, n) : "?", anchor: t(`diagram.anchors.${e.anchor}`) });
}
