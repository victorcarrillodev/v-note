import { useRef, useState, type KeyboardEvent } from "react";
import { DndContext, PointerSensor, pointerWithin, useDraggable, useDroppable, useSensor, useSensors, type DragMoveEvent } from "@dnd-kit/core";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useTranslation } from "react-i18next";
import { isUntitled, type PageNode } from "@vnote/core";
import { flattenTree, type TreeRow } from "./flatten";
import { dropTarget, zoneAt, type DropTarget, type Zone } from "./dropTarget";
import { Icon } from "../design/Icon";
import { treeIndent } from "../layout/treeIndent";
import type { IconName } from "../design/iconMap";

export type PageTreeProps = {
  nodes: readonly PageNode[];
  expanded: ReadonlySet<string>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onToggle: (id: string) => void;
  /** Si se da, las filas se pueden arrastrar: mueve `id` bajo `parentId`, después de `afterId` (null = al inicio, undefined = al final). */
  onMove?: (id: string, target: DropTarget) => void;
  /** Alto del área desplazable en píxeles (por defecto llena el contenedor). */
  height?: number;
  rowHeight?: number;
  /** Acción de la fila (aparece al pasar el cursor o con foco, sin mover el texto): crear una subpágina. */
  onCreateChild?: (parentId: string) => void;
};

export function PageTree({ nodes, expanded, selectedId, onSelect, onToggle, onMove, onCreateChild, height = 600, rowHeight = 32 }: PageTreeProps) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);
  const rows = flattenTree(nodes, expanded);
  const [hint, setHint] = useState<{ id: string; zone: Zone } | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const hintFrom = (e: DragMoveEvent): { id: string; zone: Zone } | null => {
    const over = e.over;
    const start = e.activatorEvent as PointerEvent | undefined;
    if (!over || !start) return null;
    return { id: String(over.id), zone: zoneAt(over.rect.top, start.clientY + e.delta.y, over.rect.height) };
  };
  const onDragEnd = (e: DragMoveEvent) => {
    const h = hintFrom(e);
    setHint(null);
    if (!h || !onMove) return;
    const target = dropTarget(rows, String(e.active.id), h.id, h.zone);
    if (target) onMove(String(e.active.id), target);
  };

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => ref.current,
    estimateSize: () => rowHeight,
    overscan: 8,
    initialRect: { width: 280, height },
    // En entornos sin layout (pruebas) el elemento mide 0: se usa el alto indicado.
    observeElementRect: (instance, cb) => {
      const el = instance.scrollElement;
      const measure = () => cb({ width: el?.clientWidth || 280, height: el?.clientHeight || height });
      measure();
      if (typeof ResizeObserver === "undefined" || !el) return () => {};
      const ro = new ResizeObserver(measure);
      ro.observe(el);
      return () => ro.disconnect();
    },
  });

  const title = (r: (typeof rows)[number]) => (isUntitled(r.node.page.title) ? t("app.untitled") : r.node.page.title);
  const selectedIndex = rows.findIndex((r) => r.node.page.id === selectedId);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!rows.length) return;
    const i = selectedIndex === -1 ? 0 : selectedIndex;
    const cur = rows[i]!;
    const go = (idx: number) => onSelect(rows[Math.min(rows.length - 1, Math.max(0, idx))]!.node.page.id);
    switch (e.key) {
      case "ArrowDown": e.preventDefault(); go(i + 1); break;
      case "ArrowUp": e.preventDefault(); go(i - 1); break;
      case "Home": e.preventDefault(); go(0); break;
      case "End": e.preventDefault(); go(rows.length - 1); break;
      case "ArrowRight":
        e.preventDefault();
        if (cur.hasChildren && !cur.expanded) onToggle(cur.node.page.id);
        else if (cur.expanded) go(i + 1);
        break;
      case "ArrowLeft":
        e.preventDefault();
        if (cur.expanded) onToggle(cur.node.page.id);
        else if (cur.parentId) onSelect(cur.parentId);
        break;
      case "Enter": e.preventDefault(); onSelect(cur.node.page.id); break;
    }
  };

  return (
    <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragMove={(e) => setHint(hintFrom(e))} onDragEnd={onDragEnd} onDragCancel={() => setHint(null)}>
    <div
      ref={ref}
      role="tree"
      aria-label={t("sidebar.pages")}
      aria-activedescendant={selectedId ? `ti-${selectedId}` : undefined}
      tabIndex={0}
      onKeyDown={onKeyDown}
      style={{ height, overflow: "auto", position: "relative" }}
    >
      <div style={{ height: virtualizer.getTotalSize(), position: "relative", width: "100%" }}>
        {virtualizer.getVirtualItems().map((v) => {
          const r = rows[v.index]!;
          const id = r.node.page.id;
          const selected = id === selectedId;
          return (
            <Row
              key={id}
              row={r}
              label={title(r)}
              selected={selected}
              rowHeight={rowHeight}
              top={v.start}
              draggable={!!onMove}
              hintZone={hint?.id === id ? hint.zone : null}
              onSelect={() => onSelect(id)}
              onToggle={() => onToggle(id)}
              toggleLabel={t("sidebar.toggleSubpages", { title: title(r) })}
              {...(onCreateChild ? { onCreateChild: () => onCreateChild(id), createLabel: t("sidebar.newSubpageIn", { title: title(r) }) } : {})}
            />
          );
        })}
      </div>
    </div>
    </DndContext>
  );
}

const KIND_ICON: Record<string, IconName> = { note: "note", database: "database", board: "board" };

function Row({ row: r, label, selected, rowHeight, top, draggable, hintZone, onSelect, onToggle, toggleLabel, onCreateChild, createLabel }: {
  row: TreeRow; label: string; selected: boolean; rowHeight: number; top: number; draggable: boolean; hintZone: Zone | null;
  onSelect: () => void; onToggle: () => void; toggleLabel: string; onCreateChild?: () => void; createLabel?: string;
}) {
  const id = r.node.page.id;
  const drag = useDraggable({ id, disabled: !draggable });
  const drop = useDroppable({ id });
  const setRef = (el: HTMLElement | null) => { drag.setNodeRef(el); drop.setNodeRef(el); };
  const marker = hintZone === "before" ? "inset 0 2px 0 0 var(--c-accent)" : hintZone === "after" ? "inset 0 -2px 0 0 var(--c-accent)" : hintZone === "inside" ? "inset 0 0 0 2px var(--c-accent)" : undefined;
  return (
    <div
      ref={setRef}
      id={`ti-${id}`}
      role="treeitem"
      aria-label={label}
      aria-level={r.depth + 1}
      aria-selected={selected}
      {...(r.hasChildren ? { "aria-expanded": r.expanded } : {})}
      {...(draggable ? drag.listeners : {})}
      onClick={onSelect}
      className={`group flex cursor-pointer items-center gap-1 rounded border-l-2 pr-8 text-[length:var(--text-ui-small-size)] hover:bg-[var(--c-raised)] ${selected ? "border-[var(--c-accent)] bg-[var(--c-raised)] font-medium" : "border-transparent"} ${drag.isDragging ? "opacity-50" : ""}`}
      // `top` y no `transform`: dnd-kit mide los destinos ignorando transformaciones CSS.
      style={{ position: "absolute", top, left: 0, width: "100%", height: rowHeight, paddingLeft: 6 + treeIndent(r.depth), boxShadow: marker, touchAction: "none" }}
    >
      {r.hasChildren ? (
        <button type="button" tabIndex={-1} aria-label={toggleLabel} onClick={(e) => { e.stopPropagation(); onToggle(); }} className="flex w-5 shrink-0 items-center justify-center text-[var(--c-text-muted)]">
          <Icon name={r.expanded ? "collapse" : "expand"} size={14} />
        </button>
      ) : (
        <span className="w-5 shrink-0" aria-hidden="true" />
      )}
      {r.node.page.icon ? <span aria-hidden="true">{r.node.page.icon}</span> : <span className="text-[var(--c-text-muted)]"><Icon name={KIND_ICON[r.node.page.kind] ?? "note"} /></span>}
      <span data-row-title className="truncate" title={label} aria-hidden="true">{label}</span>
      {onCreateChild && (
        <span className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 transition-opacity duration-100 focus-within:opacity-100 group-hover:opacity-100">
          <button type="button" aria-label={createLabel} onClick={(e) => { e.stopPropagation(); onCreateChild(); }} className="inline-flex h-6 w-6 items-center justify-center rounded text-[var(--c-text-muted)] hover:bg-[var(--c-card)] hover:text-[var(--c-text)]">
            <Icon name="create" />
          </button>
        </span>
      )}
    </div>
  );
}
