import { coreText } from "../i18n/coreText";
import { useEffect, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { PROPERTY_TYPES, VIEW_TYPES, type PropertyType, type ViewType } from "@vnote/core";
import type { DatabaseController } from "./databaseController";
import { BoardView } from "./BoardView";
import { CalendarView } from "./CalendarView";
import { DatabaseHeader, VIEW_ICON } from "./DatabaseHeader";
import { Tabs } from "../components/Tabs";
import { Button } from "../components/Button";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { DatabaseSearch, DatabaseToolbar } from "./DatabaseToolbar";
import { ViewOptions } from "./ViewOptions";
import { Popover } from "../components/Popover";
import { IconButton } from "../components/IconButton";
import { FilterPanel } from "./FilterPanel";
import { GalleryView, ListView } from "./ListGalleryViews";
import { TimelineView } from "./TimelineView";
import { dateProperty } from "./viewHelpers";
import { TableView } from "./TableView";
import { useDatabase } from "./useDatabase";
import { useFormatValue } from "./cells";
import { Dropdown } from "../components/ChoiceMenu";
import { INPUT } from "../components/formStyles";

const CREATABLE: PropertyType[] = PROPERTY_TYPES.filter((t) => t !== "relation" && t !== "rollup");

export function DatabaseView({ controller, onOpenRow, showTitle = true, today }: { controller: DatabaseController; onOpenRow?: (pageId: string) => void; showTitle?: boolean; today?: string }) {
  const { t } = useTranslation();
  const snap = useDatabase(controller);
  const [adding, setAdding] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [deletingView, setDeletingView] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<PropertyType>("text");
  const [expression, setExpression] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [newViewType, setNewViewType] = useState<ViewType>("list");
  const format = useFormatValue();
  const [preview, setPreview] = useState<{ text: string; isError: boolean } | null>(null);

  // Vista previa de la fórmula mientras se escribe; una respuesta lenta no pisa a una más reciente
  useEffect(() => {
    if (type !== "formula" || expression.trim() === "") { setPreview(null); return; }
    let stale = false;
    void controller.previewFormula(expression).then((r) => {
      if (stale) return;
      if (!r.ok) { setPreview({ text: coreText(r.error.message), isError: true }); return; }
      if (!r.value.hasRow) { setPreview({ text: t("databases.previewValid"), isError: false }); return; }
      const v = r.value.value as never;
      const isErr = typeof v === "object" && v !== null && "error" in (v as object);
      setPreview({ text: isErr ? coreText((v as { error: { message: string } }).error.message) : format({ type: "formula", config: {} } as never, v) || t("databases.previewEmpty"), isError: isErr });
    });
    return () => { stale = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, expression, snap.result]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const r = type === "formula" ? await controller.addFormula(name, expression) : await controller.addProperty({ name, type });
    if (!r.ok) { setError(coreText(r.error.message)); return; }
    setError(null); setName(""); setExpression(""); setAdding(false);
  };
  const active = snap.views.find((v) => v.id === snap.activeViewId);
  const activeName = active ? active.name || t(`databases.view.${active.type}`) : "";

  return (
    <section aria-label={snap.database?.name ?? ""} className="flex flex-col gap-3 p-4">
      <DatabaseHeader name={snap.database?.name ?? ""} showTitle={showTitle} onNewRow={() => void controller.addRow("")} onNewProperty={() => setAdding((a) => !a)}
        tools={<>
          <IconButton icon="filter" label={t("databases.filters")} aria-expanded={showFilters} onClick={() => setShowFilters((v) => !v)} />
          <DatabaseSearch controller={controller} />
          <Popover align="end" trigger={<IconButton icon="settings" label={t("databases.layout")} />}><ViewOptions controller={controller} /></Popover>
        </>} />

      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1">
          <Tabs label={t("databases.views")} value={snap.activeViewId ?? ""} onChange={(id) => void controller.setActiveView(id)} tabs={snap.views.map((v) => ({ value: v.id, label: v.name || t(`databases.view.${v.type}`), icon: VIEW_ICON[v.type] }))} />
        </div>
        <Dropdown size="sm" aria-label={t("databases.newViewType")} value={newViewType} onChange={(e) => setNewViewType(e.target.value as ViewType)}>
          {VIEW_TYPES.map((v) => <option key={v} value={v}>{t(`databases.view.${v}`)}</option>)}
        </Dropdown>
        <Button size="sm" onClick={() => void controller.createView(newViewType, t(`databases.view.${newViewType}`)).then(async (r) => { if (r.ok) await controller.setActiveView(r.value.id); })}>{t("databases.newView")}</Button>
        <Button size="sm" variant="danger" disabled={snap.views.length <= 1} title={snap.views.length <= 1 ? t("databases.lastView") : undefined} onClick={() => setDeletingView(true)}>{t("databases.deleteView")}</Button>
      </div>
      <ConfirmDialog open={deletingView} onOpenChange={setDeletingView} title={t("databases.deleteViewTitle", { name: activeName })} description={t("databases.deleteViewBody")}
        confirmLabel={t("databases.deleteView")} cancelLabel={t("databases.cancel")} onConfirm={() => { if (active) void controller.deleteView(active.id); setDeletingView(false); }} />

      <DatabaseToolbar controller={controller} onEditFilters={() => setShowFilters(true)} />

      {showFilters && <FilterPanel controller={controller} />}

      {adding && (
        <form onSubmit={(e) => void submit(e)} className="flex flex-wrap items-end gap-2 rounded border p-2">
          <label className="flex flex-col gap-1 text-sm">{t("databases.propertyName")}
            <input aria-label={t("databases.propertyName")} value={name} onChange={(e) => setName(e.target.value)} className={INPUT} />
          </label>
          <label className="flex flex-col gap-1 text-sm">{t("databases.propertyType")}
            <Dropdown aria-label={t("databases.propertyType")} value={type} onChange={(e) => setType(e.target.value as PropertyType)}>
              {CREATABLE.map((p) => <option key={p} value={p}>{t(`databases.type.${p}`)}</option>)}
            </Dropdown>
          </label>
          {type === "formula" && (
            <label className="flex flex-col gap-1 text-sm">{t("databases.formula")}
              <input aria-label={t("databases.formula")} value={expression} onChange={(e) => setExpression(e.target.value)} className="min-w-64 rounded border px-2 py-1 font-mono" />
            </label>
          )}
          {type === "formula" && preview && (
            <p role="status" aria-label={t("databases.previewLabel")} className={`w-full text-sm ${preview.isError ? "text-[var(--c-danger)]" : "opacity-80"}`}>
              {preview.isError ? "⚠ " : `${t("databases.preview")}: `}{preview.text}
            </p>
          )}
          <button type="submit">{t("databases.addProperty")}</button>
          <button type="button" onClick={() => { setAdding(false); setError(null); }}>{t("databases.cancel")}</button>
          {error && <p role="alert" className="w-full text-sm text-[var(--c-danger)]">{error}</p>}
        </form>
      )}

      {active && (active.type === "calendar" || active.type === "timeline") && snap.properties.some((p) => p.type === "date") && (
        <label className="flex items-center gap-2 text-sm">{t("databases.dateProperty")}
          <Dropdown aria-label={t("databases.dateProperty")} value={dateProperty(snap)?.id ?? ""} onChange={(e) => void controller.updateViewConfig({ dateProperty: e.target.value })}>
            {snap.properties.filter((p) => p.type === "date").map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Dropdown>
        </label>
      )}
      {active && <ViewBody controller={controller} type={active.type} today={today ?? localToday()} onNewProperty={() => setAdding(true)} {...(onOpenRow ? { onOpenRow } : {})} />}
    </section>
  );
}

const localToday = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

function ViewBody({ controller, type, today, onOpenRow, onNewProperty }: { controller: DatabaseController; type: ViewType; today: string; onOpenRow?: (id: string) => void; onNewProperty?: () => void }) {
  const open = onOpenRow ? { onOpenRow } : {};
  if (type === "board") return <BoardView controller={controller} today={today} {...open} />;
  if (type === "list") return <ListView controller={controller} {...open} />;
  if (type === "gallery") return <GalleryView controller={controller} {...open} />;
  if (type === "calendar") return <CalendarView controller={controller} today={today} {...open} />;
  if (type === "timeline") return <TimelineView controller={controller} today={today} {...open} />;
  return <TableView controller={controller} {...open} {...(onNewProperty ? { onNewProperty } : {})} />;
}
