import { ok, err, appError, type Result } from "../result";
import type { Page, PagesRepo } from "../pages/pagesRepo";
import type { BoardService } from "../databases/boardService";
import type { Task, TaskService } from "../tasks/taskService";

/** Una acción ya hecha y su inversa. Deshacer es idempotente: repetirlo no falla ni duplica nada. */
export type Undoable<T = unknown> = { undo: () => Promise<Result<void>>; } & T;

/** Qué acciones ofrecen «Deshacer». Lo irreversible (borrado definitivo, vaciar la papelera, reemplazar o eliminar un espacio) pide confirmación previa. Lo desconocido, por seguridad, no. */
const UNDOABLE = new Set(["trash", "move_page", "duplicate", "complete_task", "move_card"]);
export const isUndoable = (action: string): boolean => UNDOABLE.has(action);

/** Mover a la papelera → restaurar a su lugar (o a la raíz si su padre ya no existe). */
export async function trashWithUndo(repo: PagesRepo, id: string): Promise<Result<Undoable>> {
  const r = await repo.trash(id);
  if (!r.ok) return r;
  return ok({
    undo: async () => {
      const cur = await repo.get(id);
      if (cur.ok && cur.value.deletedAt === null) return ok(undefined); // ya estaba restaurada
      const res = await repo.restore(id);
      return res.ok ? ok(undefined) : res;
    },
  });
}

const liveChildren = async (repo: PagesRepo, parentId: string | null) => (await repo.children(parentId)).filter((p) => p.deletedAt === null);

/** Mover una página → devolverla a su padre y a su posición anteriores (si ya no existen, al final del padre o de la raíz). */
export async function moveWithUndo(repo: PagesRepo, id: string, newParentId: string | null, opts: { afterId?: string | null } = {}): Promise<Result<Undoable<{ page: Page }>>> {
  const before = await repo.get(id);
  if (!before.ok) return before;
  const prevParent = before.value.parentId;
  const sibs = await liveChildren(repo, prevParent);
  const i = sibs.findIndex((s) => s.id === id);
  const prevAfter: string | null = i > 0 ? sibs[i - 1]!.id : null;
  const moved = await repo.move(id, newParentId, opts);
  if (!moved.ok) return moved;
  return ok({
    page: moved.value,
    undo: async () => {
      let parent = prevParent;
      if (parent !== null) { const p = await repo.get(parent); if (!p.ok || p.value.deletedAt !== null) parent = null; }
      const siblings = parent === prevParent ? await liveChildren(repo, parent) : [];
      const afterOk = prevAfter === null ? null : siblings.some((s) => s.id === prevAfter) ? prevAfter : undefined;
      const res = await repo.move(id, parent, afterOk === undefined ? {} : { afterId: afterOk });
      return res.ok ? ok(undefined) : res;
    },
  });
}

/** Duplicar → enviar la copia (y las suyas) a la papelera; el original no se toca. */
export async function duplicateWithUndo(repo: PagesRepo, id: string, opts: { withChildren: boolean }): Promise<Result<Undoable<{ page: Page }>>> {
  const copy = await repo.duplicate(id, opts);
  if (!copy.ok) return copy;
  return ok({
    page: copy.value,
    undo: async () => {
      const r = await repo.trash(copy.value.id);
      return r.ok ? ok(undefined) : r;
    },
  });
}

/** Marcar una tarea como hecha → devolverla a su estado exacto anterior (también una recurrente, con su fecha original). */
export async function completeTaskWithUndo(tasks: TaskService, taskId: string): Promise<Result<Undoable<{ task: Task }>>> {
  const snap = await tasks.snapshot(taskId);
  if (!snap) return err(appError("NOT_FOUND", "La tarea no existe", { id: taskId }));
  const done = await tasks.complete(taskId);
  if (!done.ok) return done;
  return ok({
    task: done.value,
    undo: async () => {
      const r = await tasks.restoreSnapshot(snap);
      return r.ok ? ok(undefined) : r;
    },
  });
}

/** Cambiar una tarjeta de columna → devolverla a su columna y a su lugar. */
export async function moveCardWithUndo(boards: BoardService, dbId: string, pageId: string, columnId: string, afterPageId?: string | null): Promise<Result<Undoable>> {
  const read = await boards.read(dbId);
  if (!read.ok) return read;
  const col = read.value.columns.find((c) => c.cards.some((x) => x.pageId === pageId));
  if (!col) return err(appError("NOT_FOUND", "La tarjeta no existe en este tablero", { id: pageId }));
  const i = col.cards.findIndex((c) => c.pageId === pageId);
  const prevColumn = col.id;
  const prevAfter: string | null = i > 0 ? col.cards[i - 1]!.pageId : null;
  const moved = await boards.moveCard(dbId, pageId, columnId, afterPageId);
  if (!moved.ok) return moved;
  return ok({
    undo: async () => {
      const now = await boards.read(dbId);
      if (!now.ok) return now;
      const colNow = now.value.columns.find((c) => c.id === prevColumn);
      const anchor = prevAfter === null ? null : colNow?.cards.some((c) => c.pageId === prevAfter) ? prevAfter : undefined;
      const r = await boards.moveCard(dbId, pageId, prevColumn, anchor);
      return r.ok ? ok(undefined) : r;
    },
  });
}
