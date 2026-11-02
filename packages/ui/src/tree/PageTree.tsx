import { useRef, useState, type KeyboardEvent } from "react";
import { DndContext, PointerSensor, pointerWithin, useDraggable, useDroppable, useSensor, useSensors, type DragMoveEvent } from "@dnd-kit/core";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useTranslation } from "react-i18next";
import { isUntitled, type PageNode } from "@vnote/core";
import { flattenTree, type TreeRow } from "./flatten";
import { dropTarget, zoneAt, type DropTarget, type Zone } from "./dropTarget";

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
};

export function PageTree({ nodes, expanded, selectedId, onSelect, onToggle, onMove, height = 600, rowHeight = 32 }: PageTreeProps) {
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
            />
          );
        })}
      </div>
    </div>
    </DndContext>
  );
}

function Row({ row: r, label, selected, rowHeight, top, draggable, hintZone, onSelect, onToggle, toggleLabel }: {
  row: TreeRow; label: string; selected: boolean; rowHeight: number; top: number; draggable: boolean; hintZone: Zone | null;
  onSelect: () => void; onToggle: () => void; toggleLabel: string;
}) {
  const id = r.node.page.id;
  const drag = useDraggable({ id, disabled: !draggable });
  const drop = useDroppable({ id });
  const setRef = (el: HTMLElement | null) => { drag.setNodeRef(el); drop.setNodeRef(el); };
  const marker = hintZone === "before" ? "inset 0 2px 0 0 var(--accent, #2563eb)" : hintZone === "after" ? "inset 0 -2px 0 0 var(--accent, #2563eb)" : hintZone === "inside" ? "inset 0 0 0 2px var(--accent, #2563eb)" : undefined;
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
      className={`flex cursor-pointer items-center gap-1 rounded pr-2 hover:bg-[var(--hover)] ${selected ? "bg-[var(--selected)]" : ""} ${drag.isDragging ? "opacity-50" : ""}`}
      // `top` y no `transform`: dnd-kit mide los destinos ignorando transformaciones CSS.
      style={{ position: "absolute", top, left: 0, width: "100%", height: rowHeight, paddingLeft: 8 + r.depth * 16, boxShadow: marker, touchAction: "none" }}
    >
      {r.hasChildren ? (
        <button type="button" tabIndex={-1} aria-label={toggleLabel} onClick={(e) => { e.stopPropagation(); onToggle(); }} className="w-5 shrink-0">
          <span aria-hidden="true">{r.expanded ? "▾" : "▸"}</span>
        </button>
      ) : (
        <span className="w-5 shrink-0" aria-hidden="true" />
      )}
      {r.node.page.icon ? <span aria-hidden="true">{r.node.page.icon}</span> : null}
      <span className="truncate" aria-hidden="true">{label}</span>
    </div>
  );
}
