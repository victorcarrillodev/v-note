import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Condition, Filter, Property, Sort } from "@vnote/core";
import type { DatabaseController } from "./databaseController";
import { useDatabase } from "./useDatabase";
import { Dropdown } from "../components/ChoiceMenu";
import { Button } from "../components/Button";
import { INPUT_INLINE } from "../components/formStyles";
import { DateInput } from "../components/DateInput";

const TEXT_OPS = ["is", "is_not", "contains", "not_contains", "starts_with", "ends_with", "is_empty", "is_not_empty"];
const NUMBER_OPS = ["eq", "neq", "gt", "gte", "lt", "lte", "is_empty", "is_not_empty"];
const DATE_OPS = ["is", "before", "after", "on_or_before", "on_or_after", "is_empty", "is_not_empty"];

/** Operadores que ofrece cada tipo de propiedad (los mismos que entiende el núcleo). */
export function operatorsFor(type: string): string[] {
  switch (type) {
    case "number": case "rollup": return NUMBER_OPS;
    case "checkbox": return ["is"];
    case "select": case "status": return ["is", "is_not", "is_empty", "is_not_empty"];
    case "multi_select": return ["contains", "not_contains", "is_empty", "is_not_empty"];
    case "date": case "created_time": case "last_edited_time": return DATE_OPS;
    case "files": case "relation": return ["is_empty", "is_not_empty"];
    default: return TEXT_OPS;
  }
}
const needsValue = (op: string) => op !== "is_empty" && op !== "is_not_empty";

type Draft = { property: string; op: string; value: string };
const typeOf = (props: Property[], id: string) => (id === "title" ? "title" : (props.find((p) => p.id === id)?.type ?? "text"));

function toCondition(d: Draft, props: Property[]): Condition | null {
  if (needsValue(d.op) && d.value === "") return null;
  const type = typeOf(props, d.property);
  let value: unknown = d.value;
  if (type === "number" || type === "rollup") { const n = Number(d.value); if (needsValue(d.op) && !Number.isFinite(n)) return null; value = n; }
  if (type === "checkbox") value = d.value === "true";
  return { type: "condition", property: d.property, op: d.op, ...(needsValue(d.op) || type === "checkbox" ? { value } : {}) };
}
function fromFilter(f: Filter | undefined): { drafts: Draft[]; combine: "and" | "or"; advanced: boolean } {
  if (!f) return { drafts: [], combine: "and", advanced: false };
  const conds = f.type === "condition" ? [f] : f.filters;
  const simple = conds.every((c): c is Condition => c.type === "condition");
  if (!simple) return { drafts: [], combine: "and", advanced: true };
  return { drafts: (conds as Condition[]).map((c) => ({ property: c.property, op: c.op, value: c.value === undefined ? "" : String(c.value) })), combine: f.type === "group" ? f.op : "and", advanced: false };
}

/** Panel de filtros, orden y agrupación de la vista activa (RF-22). */
export function FilterPanel({ controller }: { controller: DatabaseController }) {
  const { t } = useTranslation();
  const snap = useDatabase(controller);
  const view = snap.views.find((v) => v.id === snap.activeViewId);
  const props = snap.properties;
  const init = useRef(fromFilter(view?.config.filter));
  const [drafts, setDrafts] = useState<Draft[]>(init.current.drafts);
  const [combine, setCombine] = useState<"and" | "or">(init.current.combine);
  const advanced = init.current.advanced;
  const sorts = view?.config.sorts ?? [];
  const viewId = view?.id;

  // Al cambiar de vista se relee su configuración
  useEffect(() => { const f = fromFilter(view?.config.filter); setDrafts(f.drafts); setCombine(f.combine); init.current = f; }, [viewId]); // eslint-disable-line react-hooks/exhaustive-deps

  const apply = (next: Draft[], comb: "and" | "or") => {
    if (advanced && next.length === 0) return;
    const conds = next.map((d) => toCondition(d, props)).filter((c): c is Condition => c !== null);
    const filter: Filter | undefined = conds.length === 0 ? undefined : conds.length === 1 && comb === "and" ? conds[0]! : { type: "group", op: comb, filters: conds };
    void controller.updateViewConfig({ filter });
  };
  const setDraft = (i: number, patch: Partial<Draft>) => {
    const next = drafts.map((d, j) => (j === i ? { ...d, ...patch } : d));
    // Al cambiar la propiedad, el operador y el valor se reinician a los del nuevo tipo
    if (patch.property !== undefined) { const ops = operatorsFor(typeOf(props, patch.property)); next[i] = { property: patch.property, op: ops[0]!, value: "" }; }
    if (patch.op !== undefined && !needsValue(patch.op)) next[i] = { ...next[i]!, value: "" };
    setDrafts(next); apply(next, combine);
  };
  const setSorts = (next: Sort[]) => void controller.updateViewConfig({ sorts: next.length ? next : undefined });
  const propOptions = (withTitle: boolean) => (
    <>
      {withTitle && <option value="title">{t("databases.title")}</option>}
      {props.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
    </>
  );

  return (
    <section role="region" aria-label={t("databases.filters")} className="flex flex-col gap-3 rounded border p-3 text-sm">
      {advanced && <p className="text-xs opacity-70">{t("databases.advancedFilter")}</p>}
      <div className="flex flex-col gap-2">
        {drafts.length > 1 && (
          <label className="flex items-center gap-2">{t("databases.combine")}
            <Dropdown aria-label={t("databases.combine")} value={combine} onChange={(e) => { const c = e.target.value as "and" | "or"; setCombine(c); apply(drafts, c); }}>
              <option value="and">{t("databases.and")}</option><option value="or">{t("databases.or")}</option>
            </Dropdown>
          </label>
        )}
        {drafts.map((d, i) => {
          const type = typeOf(props, d.property);
          const prop = props.find((p) => p.id === d.property);
          return (
            <div key={i} className="flex flex-wrap items-center gap-2">
              <Dropdown aria-label={t("databases.filterProperty", { n: i + 1 })} value={d.property} onChange={(e) => setDraft(i, { property: e.target.value })}>{propOptions(true)}</Dropdown>
              <Dropdown aria-label={t("databases.filterOp", { n: i + 1 })} value={d.op} onChange={(e) => setDraft(i, { op: e.target.value })}>
                {operatorsFor(type).map((o) => <option key={o} value={o}>{t(`databases.op.${o}`)}</option>)}
              </Dropdown>
              {(needsValue(d.op) || type === "checkbox") && (
                type === "select" || type === "status" || type === "multi_select" ? (
                  <Dropdown aria-label={t("databases.filterValue", { n: i + 1 })} value={d.value} onChange={(e) => setDraft(i, { value: e.target.value })}>
                    <option value="" />{(prop?.config.options ?? []).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </Dropdown>
                ) : type === "checkbox" ? (
                  <Dropdown aria-label={t("databases.filterValue", { n: i + 1 })} value={d.value || "true"} onChange={(e) => setDraft(i, { value: e.target.value })}>
                    <option value="true">{t("databases.checked")}</option><option value="false">{t("databases.unchecked")}</option>
                  </Dropdown>
                ) : (
                  (type === "date" || type === "created_time" || type === "last_edited_time"
                    ? <DateInput type="date" aria-label={t("databases.filterValue", { n: i + 1 })} value={d.value} onChange={(e) => setDraft(i, { value: e.target.value })} className="min-w-0 flex-1 basis-40" />
                    : <input aria-label={t("databases.filterValue", { n: i + 1 })} type="text" value={d.value} onChange={(e) => setDraft(i, { value: e.target.value })} className={INPUT_INLINE} />)
                )
              )}
              <button type="button" aria-label={t("databases.removeFilter", { n: i + 1 })} onClick={() => { const next = drafts.filter((_, j) => j !== i); setDrafts(next); apply(next, combine); }}>✕</button>
            </div>
          );
        })}
        <Button size="sm" className="self-start" onClick={() => { const first = props[0]; const p = first ? first.id : "title"; const next = [...drafts, { property: p, op: operatorsFor(typeOf(props, p))[0]!, value: "" }]; setDrafts(next); }}>{t("databases.addFilter")}</Button>
      </div>

      <div className="flex flex-col gap-2">
        {sorts.map((s, i) => (
          <div key={i} className="flex items-center gap-2">
            <Dropdown aria-label={t("databases.sortProperty", { n: i + 1 })} value={s.property} onChange={(e) => setSorts(sorts.map((x, j) => (j === i ? { ...x, property: e.target.value } : x)))}>{propOptions(true)}</Dropdown>
            <Dropdown aria-label={t("databases.sortDirection", { n: i + 1 })} value={s.direction} onChange={(e) => setSorts(sorts.map((x, j) => (j === i ? { ...x, direction: e.target.value as Sort["direction"] } : x)))}>
              <option value="asc">{t("databases.asc")}</option><option value="desc">{t("databases.desc")}</option>
            </Dropdown>
            <button type="button" aria-label={t("databases.removeSort", { n: i + 1 })} onClick={() => setSorts(sorts.filter((_, j) => j !== i))}>✕</button>
          </div>
        ))}
        <Button size="sm" className="self-start" onClick={() => setSorts([...sorts, { property: props[0]?.id ?? "title", direction: "asc" }])}>{t("databases.addSort")}</Button>
      </div>

      <label className="flex items-center gap-2">{t("databases.groupBy")}
        <Dropdown aria-label={t("databases.groupBy")} value={view?.config.groupBy ?? ""} onChange={(e) => void controller.updateViewConfig({ groupBy: e.target.value === "" ? undefined : e.target.value })}>
          <option value="">{t("databases.noGroup")}</option>{propOptions(false)}
        </Dropdown>
      </label>
    </section>
  );
}
