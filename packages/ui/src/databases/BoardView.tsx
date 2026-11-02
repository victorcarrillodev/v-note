import { useState } from "react";
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { DndContext, PointerSensor, pointerWithin, useDraggable, useDroppable, useSensor, useSensors, type CollisionDetection, type DragMoveEvent } from "@dnd-kit/core";
import { useTranslation } from "react-i18next";
import type { DateValue, Group, Property, QueryRow } from "@vnote/core";
import type { DatabaseController } from "./databaseController";
import { useDatabase } from "./useDatabase";

type Hint = { columnId: string; afterPageId: string | null | undefined; cardId?: string; zone?: "before" | "after" };

/** Prefiere soltar sobre una tarjeta (para ordenar) antes que sobre la columna entera. */
const cardFirst: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  const cards = hits.filter((h) => String(h.id).startsWith("card:"));
  return cards.length ? cards : hits;
};

export function BoardView({ controller, onOpenRow }: { controller: DatabaseController; onOpenRow?: (pageId: string) => void }) {
  const { t } = useTranslation();
  const snap = useDatabase(controller);
  const groups = snap.result?.groups ?? [];
  const dateProp = snap.properties.find((p) => p.type === "date" && p.config.asTask === true);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const [hint, setHint] = useState<Hint | null>(null);
  const [addingIn, setAddingIn] = useState<string | null>(null);
  const [addingColumn, setAddingColumn] = useState(false);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<{ id: string; name: string; count: number } | null>(null);
  const [moveTo, setMoveTo] = useState("");

  const columnOf = (e: DragMoveEvent): Hint | null => {
    const over = e.over;
    const start = e.activatorEvent as PointerEvent | undefined;
    if (!over || !start) return null;
    const id = String(over.id);
    if (id.startsWith("col:")) return { columnId: id.slice(4), afterPageId: undefined };
    const pageId = id.slice(5);
    const g = groups.find((x) => x.rows.some((r) => r.pageId === pageId));
    if (!g) return null;
    const y = start.clientY + e.delta.y;
    const zone = y < over.rect.top + over.rect.height / 2 ? "before" : "after";
    const cards = g.rows.filter((r) => r.pageId !== String(e.active.id).slice(5));
    const idx = cards.findIndex((r) => r.pageId === pageId);
    const after = zone === "after" ? pageId : (idx > 0 ? cards[idx - 1]!.pageId : null);
    return { columnId: String(g.key), afterPageId: after, cardId: pageId, zone };
  };
  const onDragEnd = (e: DragMoveEvent) => {
    const h = columnOf(e);
    setHint(null);
    if (!h) return;
    const pageId = String(e.active.id).slice(5);
    if (h.cardId === pageId) return;
    void controller.moveCard(pageId, h.columnId, h.afterPageId);
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    const r = await controller.deleteColumn(deleting.id, deleting.count > 0 ? { moveTo } : {});
    if (r.ok) setDeleting(null);
  };
  const startDelete = async (g: Group) => {
    const count = g.rows.length;
    if (count === 0) { await controller.deleteColumn(String(g.key)); return; }
    const first = groups.find((x) => x.key !== g.key);
    setMoveTo(first ? String(first.key) : "");
    setDeleting({ id: String(g.key), name: g.label ?? String(g.key), count });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        {addingColumn ? (
          <input
            autoFocus aria-label={t("databases.board.newColumnName")}
            onKeyDown={(e) => {
              if (e.key === "Enter") { const v = e.currentTarget.value; void controller.addColumn(v).then((r) => { if (r.ok) setAddingColumn(false); }); }
              if (e.key === "Escape") setAddingColumn(false);
            }}
            className="rounded border px-2 py-1"
          />
        ) : (
          <button type="button" onClick={() => setAddingColumn(true)}>{t("databases.board.newColumn")}</button>
        )}
      </div>

      <DndContext sensors={sensors} collisionDetection={cardFirst} onDragMove={(e) => setHint(columnOf(e))} onDragEnd={onDragEnd} onDragCancel={() => setHint(null)}>
        <div className="flex items-start gap-3 overflow-x-auto pb-2">
          {groups.map((g) => (
            <Column key={String(g.key)} group={g} hint={hint}>
              <header className="mb-2 flex items-center gap-1 font-semibold">
                {renaming === String(g.key) ? (
                  <input
                    autoFocus defaultValue={g.label} aria-label={t("databases.board.renameColumnInput", { name: g.label })}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") { const v = e.currentTarget.value; void controller.renameColumn(String(g.key), v).then((r) => { if (r.ok) setRenaming(null); }); }
                      if (e.key === "Escape") setRenaming(null);
                    }}
                    className="min-w-0 flex-1 rounded border px-1"
                  />
                ) : (
                  <span className="flex-1 truncate">{g.label}</span>
                )}
                <span className="text-xs opacity-60">{g.rows.length}</span>
                <button type="button" aria-label={t("databases.board.renameColumn", { name: g.label })} onClick={() => setRenaming(String(g.key))}>✎</button>
                <button type="button" aria-label={t("databases.board.deleteColumn", { name: g.label })} onClick={() => void startDelete(g)}>🗑</button>
              </header>
              <div className="flex min-h-8 flex-col gap-2">
                {g.rows.map((r) => (
                  <Card key={r.pageId} row={r} columns={groups} current={String(g.key)} dateProp={dateProp} hint={hint} controller={controller} {...(onOpenRow ? { onOpenRow } : {})} />
                ))}
              </div>
              {addingIn === String(g.key) ? (
                <input
                  autoFocus aria-label={t("databases.board.newCardTitle")}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { const v = e.currentTarget.value; void controller.addCard(v, String(g.key)).then((r) => { if (r.ok) setAddingIn(null); }); }
                    if (e.key === "Escape") setAddingIn(null);
                  }}
                  className="mt-2 w-full rounded border px-2 py-1"
                />
              ) : (
                <button type="button" aria-label={t("databases.board.newCard")} className="mt-2 w-full text-left opacity-70" onClick={() => setAddingIn(String(g.key))}>+ {t("databases.board.newCard")}</button>
              )}
            </Column>
          ))}
        </div>
      </DndContext>

      <AlertDialog.Root open={deleting !== null} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="fixed inset-0 bg-black/40" />
          <AlertDialog.Content className="fixed left-1/2 top-1/2 w-[28rem] -translate-x-1/2 -translate-y-1/2 rounded bg-[var(--bg)] p-4 shadow">
            <AlertDialog.Title className="font-semibold">{t("databases.board.deleteTitle")}</AlertDialog.Title>
            <AlertDialog.Description className="my-2 text-sm">{t("databases.board.deleteWithCards", { count: deleting?.count ?? 0 })}</AlertDialog.Description>
            <label className="mb-3 flex flex-col gap-1 text-sm">{t("databases.board.moveCardsTo")}
              <select aria-label={t("databases.board.moveCardsTo")} value={moveTo} onChange={(e) => setMoveTo(e.target.value)}>
                {groups.filter((x) => String(x.key) !== deleting?.id).map((x) => <option key={String(x.key)} value={String(x.key)}>{x.label}</option>)}
              </select>
            </label>
            <div className="flex justify-end gap-2">
              <AlertDialog.Cancel asChild><button type="button">{t("databases.cancel")}</button></AlertDialog.Cancel>
              <button type="button" onClick={() => void confirmDelete()}>{t("databases.board.delete")}</button>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </div>
  );
}

function Column({ group, hint, children }: { group: Group; hint: Hint | null; children: React.ReactNode }) {
  const drop = useDroppable({ id: `col:${String(group.key)}` });
  const active = hint?.columnId === String(group.key);
  return (
    <section ref={drop.setNodeRef} role="group" aria-label={group.label ?? String(group.key)} className={`w-72 shrink-0 rounded border p-2 ${active ? "ring-2 ring-[var(--accent,#2563eb)]" : ""}`}>
      {children}
    </section>
  );
}

function Card({ row, columns, current, dateProp, hint, controller, onOpenRow }: {
  row: QueryRow; columns: Group[]; current: string; dateProp: Property | undefined; hint: Hint | null; controller: DatabaseController; onOpenRow?: (id: string) => void;
}) {
  const { t } = useTranslation();
  const drag = useDraggable({ id: `card:${row.pageId}` });
  const drop = useDroppable({ id: `card:${row.pageId}` });
  const title = row.title.trim() === "" ? t("databases.untitled") : row.title;
  const date = dateProp ? (row.values[dateProp.id] as DateValue | null | undefined) : null;
  const mark = hint?.cardId === row.pageId ? (hint.zone === "before" ? "inset 0 2px 0 0 var(--accent,#2563eb)" : "inset 0 -2px 0 0 var(--accent,#2563eb)") : undefined;
  return (
    <article
      ref={(el) => { drag.setNodeRef(el); drop.setNodeRef(el); }}
      aria-label={title}
      {...drag.listeners}
      className={`rounded border bg-[var(--bg)] p-2 shadow-sm ${drag.isDragging ? "opacity-50" : ""}`}
      style={{ boxShadow: mark, touchAction: "none" }}
    >
      <div className="flex items-start gap-1">
        <span className="flex-1 break-words">{title}</span>
        {onOpenRow && <button type="button" aria-label={t("databases.openRow", { title })} onClick={() => onOpenRow(row.pageId)} onPointerDown={(e) => e.stopPropagation()}>↗</button>}
      </div>
      {date && typeof date === "object" && "start" in date && (
        <p className="mt-1 flex items-center gap-1 text-xs opacity-80">
          <span>{date.start}</span>
          {date.remind && <span role="img" aria-label={t("databases.board.withReminder")}>🔔</span>}
        </p>
      )}
      <select aria-label={t("databases.board.moveTo", { title })} value={current} onPointerDown={(e) => e.stopPropagation()} onChange={(e) => void controller.moveCard(row.pageId, e.target.value)} className="mt-1 w-full bg-transparent text-xs">
        {columns.map((c) => <option key={String(c.key)} value={String(c.key)}>{c.label}</option>)}
      </select>
    </article>
  );
}
