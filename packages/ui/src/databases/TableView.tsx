import { useRef, useState } from "react";
import { EmptyState } from "../empty/EmptyState";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useTranslation } from "react-i18next";
import type { Property } from "@vnote/core";
import { Icon } from "../design/Icon";
import { CellEditor } from "./cells";
import type { DatabaseController } from "./databaseController";
import { useDatabase } from "./useDatabase";
import { Checkbox } from "../components/controls";

const ROW_H = 40;

/** Tabla virtualizada: solo se pintan las filas visibles (RNF-11). */
export function TableView({ controller, height = 480, onOpenRow, onNewProperty }: { controller: DatabaseController; height?: number; onOpenRow?: (pageId: string) => void; onNewProperty?: () => void }) {
  const { t } = useTranslation();
  const snap = useDatabase(controller);
  const ref = useRef<HTMLDivElement>(null);
  const result = snap.result;
  const rows = result?.rows ?? [];
  const props = (result?.visibleProperties ?? snap.properties.map((p) => p.id)).map((id) => snap.properties.find((p) => p.id === id)).filter((p): p is Property => !!p);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [newName, setNewName] = useState("");

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => ref.current,
    estimateSize: () => ROW_H,
    overscan: 6,
    initialRect: { width: 800, height },
    observeElementRect: (instance, cb) => {
      const el = instance.scrollElement;
      const measure = () => cb({ width: el?.clientWidth || 800, height: el?.clientHeight || height });
      measure();
      if (typeof ResizeObserver === "undefined" || !el) return () => {};
      const ro = new ResizeObserver(measure);
      ro.observe(el);
      return () => ro.disconnect();
    },
  });
  const template = `260px ${props.map(() => "200px").join(" ")} 48px`;
  const width = 260 + props.length * 200 + 48;

  return (
    <div className="text-[length:var(--text-ui-size)]">
      <div ref={ref} data-table-scroll role="presentation" className="max-w-full" style={{ height, overflow: "auto", position: "relative" }}>
        <div role="table" aria-label={t("databases.table", { name: snap.database?.name ?? "" })} aria-rowcount={rows.length + 1} style={{ width: `${width}px`, minWidth: "100%" }}>
          <div role="row" className="sticky top-0 z-10 grid border-b border-[var(--c-border)] bg-[var(--c-canvas)] font-semibold" style={{ gridTemplateColumns: template }}>
            <div role="columnheader" className="sticky left-0 z-10 bg-[var(--c-canvas)] px-2 py-2">{t("databases.name")}</div>
            {props.map((p) => (
              <div key={p.id} role="columnheader" className="relative flex items-center gap-1 px-2 py-2">
                <span className="truncate">{p.name}</span>
                <button type="button" aria-label={t("databases.propertyOptions", { name: p.name })} onClick={() => { setMenuFor(menuFor === p.id ? null : p.id); setNewName(p.name); }} className="ml-auto opacity-60">⋯</button>
                {menuFor === p.id && (
                  <div className="absolute right-0 top-full z-20 flex w-56 flex-col gap-2 rounded border bg-[var(--bg)] p-2 shadow">
                    <label className="flex flex-col gap-1 text-xs">{t("databases.newPropertyName")}
                      <input aria-label={t("databases.newPropertyName")} value={newName} onChange={(e) => setNewName(e.target.value)} className="rounded border px-1 py-0.5 text-sm font-normal" />
                    </label>
                    {p.type === "date" && (
                      <Checkbox className="text-xs font-normal" label={t("databases.useAsTask")} checked={p.config.asTask === true} onChange={(v) => void controller.updatePropertyConfig(p.id, { asTask: v })} />
                    )}
                    <button type="button" onClick={() => void controller.renameProperty(p.id, newName).then(() => setMenuFor(null))}>{t("databases.rename")}</button>
                    <button type="button" onClick={() => void controller.deleteProperty(p.id).then(() => setMenuFor(null))}>{t("databases.deleteProperty")}</button>
                  </div>
                )}
              </div>
            ))}
            <div role="columnheader" className="flex items-center justify-center">
              <button type="button" aria-label={t("databases.newColumn")} onClick={() => onNewProperty?.()} className="rounded p-1 text-[var(--c-text-muted)] hover:bg-[var(--c-raised)]"><Icon name="create" size={16} /></button>
            </div>
          </div>
          <div role="rowgroup" style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
            {virtualizer.getVirtualItems().map((v) => {
              const r = rows[v.index]!;
              const title = r.title.trim() === "" ? t("databases.untitled") : r.title;
              return (
                <div key={r.pageId} role="row" aria-label={title} aria-rowindex={v.index + 2} className="group grid items-center border-b border-[var(--c-border)] hover:bg-[var(--c-raised)]" style={{ position: "absolute", top: v.start, left: 0, width: "100%", height: ROW_H, gridTemplateColumns: template }}>
                  <div role="cell" data-col="title" className="sticky left-0 z-[1] flex items-center gap-1 bg-[var(--c-canvas)] px-2 group-hover:bg-[var(--c-raised)]">
                    <input
                      aria-label={t("databases.rowTitle", { title: r.title })}
                      defaultValue={r.title}
                      key={`${r.pageId}:${r.title}`}
                      placeholder={t("databases.untitled")}
                      readOnly={r.locked === true}
                      onBlur={(e) => { if (r.locked !== true && e.target.value !== r.title) void controller.setTitle(r.pageId, e.target.value); }}
                      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                      className="min-w-0 flex-1 bg-transparent"
                    />
                    {onOpenRow && <button type="button" aria-label={t("databases.openRow", { title })} onClick={() => onOpenRow(r.pageId)} className="opacity-60">↗</button>}
                  </div>
                  {props.map((p) => (
                    <div key={p.id} role="cell" data-col={p.id} className="px-2">
                      <CellEditor prop={p} value={r.values[p.id]} onCommit={(raw) => controller.setCell(r.pageId, p.id, raw)} />
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      {rows.length === 0 && <EmptyState illustration="table" title={t("databases.empty")} />}
      <p role="status" aria-label={t("databases.rowCountLabel")} className="px-2 py-1 text-[length:var(--text-ui-small-size)] text-[var(--c-text-muted)]">{t("databases.rowCount", { count: rows.length })}</p>
    </div>
  );
}
