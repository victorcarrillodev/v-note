import { inlineToText, type Block } from "../blocks/types";
import type { SqlExecutor } from "../ports/sqlStore";
import { isValidLocal, validateRecurrence, type Recurrence } from "./recurrence";

export type IndexedTask = {
  id: string; source: "checkbox" | "card" | "row"; pageId: string; blockId: string | null; databaseId: string | null;
  title: string; due: string | null; remindAt: string | null; recurrence: Recurrence | null; done: boolean;
  /** HH:mm de `due` cuando tiene hora; nula = todo el día. */
  startTime: string | null; durationMin: number | null;
};

/** Hora (HH:mm) de una fecha local flotante, o null si solo es fecha. */
export const timeOf = (due: string | null): string | null => (due && due.includes("T") ? due.slice(11, 16) : null);

/** Duración válida en minutos (entero positivo) solo si hay hora de inicio; si no, se ignora. */
export function validDuration(raw: unknown, startTime: string | null): number | null {
  if (!startTime) return null;
  const n = typeof raw === "number" ? raw : typeof raw === "string" && /^\d+$/.test(raw) ? Number(raw) : NaN;
  return Number.isInteger(n) && n > 0 ? n : null;
}

const plain = (b: Block): string => (Array.isArray(b.content) ? inlineToText(b.content) : "");

/** Inserta o actualiza una tarea del índice. Si cambió su hora de aviso (o se quitó), el estado del aviso anterior ya no aplica. */
export async function upsertTask(tx: SqlExecutor, now: number, t: IndexedTask): Promise<void> {
  const prev = (await tx.query<{ remind_at: string | null }>("SELECT remind_at FROM tasks WHERE id = ?", [t.id]))[0];
  await tx.exec(
    "INSERT OR REPLACE INTO tasks(id, source, page_id, block_id, database_id, title, due, remind_at, recurrence, done, updated_at, start_time, duration_min) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
    [t.id, t.source, t.pageId, t.blockId, t.databaseId, t.title, t.due, t.remindAt, t.recurrence ? JSON.stringify(t.recurrence) : null, t.done ? 1 : 0, now, t.startTime, t.durationMin],
  );
  if ((prev && prev.remind_at !== t.remindAt) || t.done) await tx.exec("DELETE FROM reminder_state WHERE task_id = ?", [t.id]);
}

/** Elimina del índice las tareas que cumplen `where` y ya no están en `keep` (y su estado de aviso). */
export async function removeMissingTasks(tx: SqlExecutor, where: string, params: (string | number)[], keep: string[]): Promise<void> {
  const rows = await tx.query<{ id: string }>(`SELECT id FROM tasks WHERE ${where}`, params);
  for (const r of rows) if (!keep.includes(r.id)) {
    await tx.exec("DELETE FROM tasks WHERE id = ?", [r.id]);
    await tx.exec("DELETE FROM reminder_state WHERE task_id = ?", [r.id]);
  }
}

/** Tareas de las casillas «tarea» de una página: las que tienen fecha o aviso válidos. */
export function tasksFromBlocks(pageId: string, blocks: Block[]): IndexedTask[] {
  const found: IndexedTask[] = [];
  const walk = (list: Block[]) => {
    for (const b of list) {
      if (b.type === "task") {
        const due = typeof b.props.due === "string" && isValidLocal(b.props.due) ? b.props.due : null;
        const remindAt = typeof b.props.remindAt === "string" && isValidLocal(b.props.remindAt) ? b.props.remindAt : null;
        let recurrence: Recurrence | null = null;
        if (typeof b.props.recurrence === "string" && b.props.recurrence !== "") {
          try { const r = validateRecurrence(JSON.parse(b.props.recurrence)); if (r.ok) recurrence = r.value; } catch { /* repetición ilegible: se ignora */ }
        }
        if (due || remindAt) found.push({ id: `check:${pageId}:${b.id}`, source: "checkbox", pageId, blockId: b.id, databaseId: null, title: plain(b), due, remindAt, recurrence, done: b.props.checked === true, startTime: timeOf(due), durationMin: validDuration(b.props.durationMin, timeOf(due)) });
      }
      walk(b.children);
    }
  };
  walk(blocks);
  return found;
}

/** Reconstruye las tareas de las casillas de una página dentro de una transacción. */
export async function indexPageTasksIn(tx: SqlExecutor, now: number, pageId: string, blocks: Block[]): Promise<void> {
  const found = tasksFromBlocks(pageId, blocks);
  for (const t of found) await upsertTask(tx, now, t);
  await removeMissingTasks(tx, "page_id = ? AND source = 'checkbox'", [pageId], found.map((t) => t.id));
}
