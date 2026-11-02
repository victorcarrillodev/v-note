import { DatabaseService, PageService, type Clock, type SqlStore, type Task, type TaskSourceWriter } from "@vnote/core";

/** Escribe los cambios de una tarea (hecha, nueva fecha) en su origen: el bloque de la página o la fila de la base de datos. */
export function createTaskWriter(store: SqlStore, clock: Clock): TaskSourceWriter {
  const pages = new PageService(store, clock);
  const dbs = new DatabaseService(store, clock);

  async function dateProperty(task: Task) {
    if (!task.databaseId) return null;
    return (await dbs.listProperties(task.databaseId)).find((p) => p.type === "date" && p.config.asTask === true) ?? null;
  }

  return {
    async setSchedule(task, s) {
      if (task.source === "checkbox" && task.blockId) {
        await pages.updateBlockProps(task.pageId, task.blockId, { due: s.due ?? "", remindAt: s.remindAt ?? "", recurrence: s.recurrence ? JSON.stringify(s.recurrence) : "" });
        return;
      }
      const prop = await dateProperty(task);
      if (prop && task.databaseId) {
        await dbs.setCell(task.databaseId, task.pageId, prop.id, s.due ? { start: s.due, ...(s.remindAt ? { remind: s.remindAt } : {}), ...(s.recurrence ? { repeat: s.recurrence } : {}) } : null);
      }
    },
    async setDone(task, done) {
      if (task.source === "checkbox" && task.blockId) {
        await pages.updateBlockProps(task.pageId, task.blockId, { checked: done });
        return;
      }
      if (!task.databaseId) return;
      const status = (await dbs.listProperties(task.databaseId)).find((p) => p.type === "status");
      if (status) await dbs.setCell(task.databaseId, task.pageId, status.id, done ? "done" : (status.config.options?.[0]?.id ?? null));
    },
  };
}
