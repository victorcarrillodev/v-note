import { TaskService, type Clock, type DueReminder, type SnoozeOption, type Task, type Workspace, type WorkspaceManager } from "@vnote/core";
import type { Notifier } from "./notifier";
import { createTaskWriter } from "./taskWriter";

export type SummaryItem = { workspace: Pick<Workspace, "id" | "name">; task: Task; occurrence: string; missed: number };
export type Summary = { overdue: SummaryItem[]; today: SummaryItem[] };
export type ReminderSnapshot = { permissionWarning: boolean; version: number };

/**
 * Recorre TODOS los espacios de trabajo (estén o no abiertos): avisa de los recordatorios que llegaron, arma el resumen
 * de vencidos y tareas de hoy, y aplica las acciones (hecho, posponer, descartar) reflejándolas al instante (RF-11, RF-12).
 */
export class ReminderCenter {
  private listeners = new Set<() => void>();
  private snapshot: ReminderSnapshot = { permissionWarning: false, version: 0 };
  private warnedThisSession = false;

  constructor(private d: { workspaces: WorkspaceManager; clock: Clock; notifier: Notifier; nowLocal: () => string }) {}

  subscribe = (fn: () => void): (() => void) => { this.listeners.add(fn); return () => this.listeners.delete(fn); };
  getSnapshot = (): ReminderSnapshot => this.snapshot;
  private emit(patch: Partial<ReminderSnapshot> = {}) { this.snapshot = { ...this.snapshot, ...patch, version: this.snapshot.version + 1 }; this.listeners.forEach((l) => l()); }

  private async each<T>(fn: (ws: Workspace, tasks: TaskService) => Promise<T[]>): Promise<T[]> {
    const list = await this.d.workspaces.list();
    if (!list.ok) return [];
    const out: T[] = [];
    for (const ws of list.value) {
      const o = await this.d.workspaces.open(ws.id).catch(() => null);
      if (!o || !o.ok) continue; // espacio no disponible (p. ej. abierto en otra ventana): se omite
      const tasks = new TaskService(o.value.store, this.d.clock, createTaskWriter(o.value.store, this.d.clock), this.d.nowLocal);
      out.push(...(await fn(ws, tasks)));
    }
    return out;
  }
  private async one<T>(workspaceId: string, fn: (tasks: TaskService) => Promise<T>): Promise<T | null> {
    const o = await this.d.workspaces.open(workspaceId);
    if (!o.ok) return null;
    return fn(new TaskService(o.value.store, this.d.clock, createTaskWriter(o.value.store, this.d.clock), this.d.nowLocal));
  }

  /** Cada minuto: avisa de lo nuevo (agrupado si son muchos). Sin permiso, avisa una sola vez de cómo activarlo. */
  async tick(): Promise<{ notified: number }> {
    const fresh = await this.each(async (ws, tasks) => (await tasks.dueReminders({ onlyNew: true })).map((r) => ({ ws, tasks, r })));
    if (fresh.length === 0) return { notified: 0 };
    let permission = await this.d.notifier.permission();
    if (permission === "prompt") permission = await this.d.notifier.request();
    if (permission !== "granted") {
      const first = fresh[0]!;
      if (!this.warnedThisSession && (await first.tasks.shouldWarnAboutPermission(permission))) { this.warnedThisSession = true; this.emit({ permissionWarning: true }); }
      return { notified: 0 };
    }
    const items = fresh.map((f) => f.r);
    const wsOf = new Map(fresh.map((f) => [f.r.task.id, f.ws.id]));
    const notes = new TaskService(null as never, this.d.clock, null as never, this.d.nowLocal).toNotifications(items);
    for (const n of notes) {
      if (n.kind === "single") await this.d.notifier.notify({ title: n.item.task.title || "·", body: n.item.occurrence.replace("T", " "), tag: n.item.task.id, workspaceId: wsOf.get(n.item.task.id) ?? "", pageId: n.item.task.pageId });
      else await this.d.notifier.notify({ title: "Recordatorios vencidos", body: `${n.count} recordatorios pendientes`, tag: "group" });
    }
    for (const f of fresh) await f.tasks.markFired(f.r.task.id);
    this.emit();
    return { notified: notes.length };
  }

  dismissPermissionWarning() { this.emit({ permissionWarning: false }); }

  /** Resumen único de todos los espacios: vencidos y tareas de hoy, con el espacio de cada una. */
  async summary(): Promise<Summary> {
    const today = this.d.nowLocal().slice(0, 10);
    const overdue: SummaryItem[] = [];
    const todayItems: SummaryItem[] = [];
    await this.each(async (ws, tasks) => {
      const due = await tasks.dueReminders();
      const ids = new Set(due.map((d) => d.task.id));
      for (const d of due) overdue.push({ workspace: { id: ws.id, name: ws.name }, task: d.task, occurrence: d.occurrence, missed: d.missed });
      for (const t of await tasks.list()) if (!t.done && t.due?.slice(0, 10) === today && !ids.has(t.id)) todayItems.push({ workspace: { id: ws.id, name: ws.name }, task: t, occurrence: t.remindAt ?? t.due!, missed: 0 });
      return [];
    });
    return { overdue, today: todayItems };
  }

  async agenda(workspaceId: string): Promise<Task[]> { return (await this.one(workspaceId, (t) => t.list())) ?? []; }

  async complete(workspaceId: string, taskId: string) { await this.one(workspaceId, (t) => t.complete(taskId)); this.emit(); }
  async snooze(workspaceId: string, taskId: string, option: SnoozeOption) { await this.one(workspaceId, (t) => t.snooze(taskId, option)); this.emit(); }
  async dismiss(workspaceId: string, taskId: string) { await this.one(workspaceId, (t) => t.dismiss(taskId)); this.emit(); }
}
export type { DueReminder };
