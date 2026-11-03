import { appError, err, ok, type Result } from "../result";
import type { Clock } from "../clock";
import type { Block } from "../blocks/types";
import type { DatabaseService } from "../databases/databaseService";
import type { DateValue } from "../databases/values";
import type { SqlStore } from "../ports/sqlStore";
import { advanceSchedule, isValidLocal, nextAfter, type Recurrence } from "./recurrence";
import { indexPageTasksIn, removeMissingTasks, timeOf, upsertTask } from "./taskIndex";
import { toMinutes } from "../planning/schedule";

/** Duración de una fila con hora de inicio y fin posterior; nula si no hay hora o el rango no es válido. */
function durationFromRange(start: string, end: string | undefined): number | null {
  if (!end || !start.includes("T") || !end.includes("T")) return null;
  const d = toMinutes(end) - toMinutes(start);
  return Number.isInteger(d) && d > 0 ? d : null;
}

export type TaskSource = "checkbox" | "card" | "row";
export type Task = {
  id: string; source: TaskSource; pageId: string; blockId: string | null; databaseId: string | null;
  title: string; due: string | null; remindAt: string | null; recurrence: Recurrence | null; done: boolean;
  startTime: string | null; durationMin: number | null;
};
export type SnoozeOption = "10m" | "1h" | "tomorrow";
export type DueReminder = { task: Task; occurrence: string; missed: number };
export type Notification = { kind: "single"; item: DueReminder } | { kind: "group"; count: number; items: DueReminder[] };
export type ReminderState = { state: "fired" | "snoozed" | "dismissed"; occurrence: string; snoozedUntil: string | null };

/** Quien escribe de vuelta en el origen (documento o propiedad) cuando una tarea cambia desde recordatorios o agenda. */
export interface TaskSourceWriter {
  setSchedule(task: Task, s: { due: string | null; remindAt: string | null; recurrence: Recurrence | null }): Promise<void>;
  setDone(task: Task, done: boolean): Promise<void>;
}

const pad = (n: number, w = 2) => String(n).padStart(w, "0");
/** Hora local flotante (AAAA-MM-DDTHH:mm) de un instante UTC en una zona con ese desfase en minutos (CL-13). */
export function localNow(utcMs: number, offsetMinutes: number): string {
  const t = new Date(utcMs + offsetMinutes * 60_000);
  return `${pad(t.getUTCFullYear(), 4)}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}T${pad(t.getUTCHours())}:${pad(t.getUTCMinutes())}`;
}
const addMinutesLocal = (local: string, minutes: number): string => {
  const [d, t = "00:00"] = local.split("T");
  const [y, mo, da] = d!.split("-").map(Number) as [number, number, number];
  const [h, mi] = t.split(":").map(Number) as [number, number];
  const ms = Date.UTC(y, mo - 1, da, h, mi) + minutes * 60_000;
  return localNow(ms, 0);
};
const MORNING = "09:00";
const GROUP_THRESHOLD = 3;

type Row = { id: string; source: TaskSource; page_id: string; block_id: string | null; database_id: string | null; title: string; due: string | null; remind_at: string | null; recurrence: string | null; done: number; start_time: string | null; duration_min: number | null };
const toTask = (r: Row): Task => ({
  id: r.id, source: r.source, pageId: r.page_id, blockId: r.block_id, databaseId: r.database_id, title: r.title,
  due: r.due, remindAt: r.remind_at, recurrence: r.recurrence ? (JSON.parse(r.recurrence) as Recurrence) : null, done: r.done === 1, startTime: r.start_time, durationMin: r.duration_min,
});
/** Tareas derivadas (casillas, tarjetas, filas con fecha) y sus recordatorios. */
export class TaskService {
  constructor(private db: SqlStore, private clock: Clock, private writer: TaskSourceWriter, private nowLocal: () => string) {}

  // ---- Índice ----

  /** Reconstruye las tareas de las casillas de una página. Una casilla sin fecha ni aviso (o con fechas inválidas) no es tarea. */
  async indexPage(pageId: string, blocks: Block[]): Promise<void> {
    await this.db.transaction((tx) => indexPageTasksIn(tx, this.clock.now(), pageId, blocks));
  }

  /** Reconstruye las tareas (tarjetas o filas) de una base: las filas con valor en una propiedad de fecha marcada como tarea. */
  async indexDatabase(databases: DatabaseService, dbId: string): Promise<void> {
    const props = await databases.listProperties(dbId);
    const dateProp = props.find((p) => p.type === "date" && p.config.asTask === true);
    const statusProp = props.find((p) => p.type === "status");
    const isBoard = (await this.db.query("SELECT 1 FROM views WHERE database_id = ? AND type = 'board'", [dbId])).length > 0;
    const found: Task[] = [];
    if (dateProp) {
      for (const r of await databases.getRows(dbId)) {
        const v = r.values[dateProp.id] as DateValue | null | undefined;
        if (!v || typeof v !== "object" || !("start" in v)) continue;
        const status = statusProp ? r.values[statusProp.id] : undefined;
        found.push({
          id: `row:${dbId}:${r.pageId}`, source: isBoard ? "card" : "row", pageId: r.pageId, blockId: null, databaseId: dbId, title: r.title,
          due: v.start, remindAt: v.remind ?? null, recurrence: v.repeat ?? null, done: status === "done",
          startTime: timeOf(v.start), durationMin: durationFromRange(v.start, v.end),
        });
      }
    }
    await this.db.transaction(async (tx) => {
      for (const t of found) await upsertTask(tx, this.clock.now(), t);
      await removeMissingTasks(tx, "database_id = ?", [dbId], found.map((t) => t.id));
    });
  }

  /** Tareas de páginas que no están en la papelera, ordenadas por fecha. */
  async list(): Promise<Task[]> {
    const rows = await this.db.query<Row>(
      `SELECT t.* FROM tasks t JOIN pages p ON p.id = t.page_id WHERE p.deleted_at IS NULL ORDER BY COALESCE(t.due, substr(t.remind_at, 1, 10)), t.remind_at, t.title`);
    return rows.map(toTask);
  }
  async get(id: string): Promise<Task | null> {
    const r = (await this.db.query<Row>("SELECT * FROM tasks WHERE id = ?", [id]))[0];
    return r ? toTask(r) : null;
  }

  // ---- Recordatorios ----

  /** Ocurrencia que toca avisar ahora: la propia hora de aviso, o la repetición más reciente ya vencida (solo una, T-302). */
  private currentOccurrence(t: Task, now: string): { occurrence: string; missed: number } | null {
    if (!t.remindAt) return null;
    if (!t.recurrence) return t.remindAt <= now ? { occurrence: t.remindAt, missed: 0 } : null;
    const anchor = t.recurrence.anchor ?? t.remindAt;
    if (t.remindAt > now) return null;
    let latest = t.remindAt, missed = 0;
    for (;;) {
      const next = nextAfter(anchor, t.recurrence, latest);
      if (next > now) break;
      latest = next; missed++;
    }
    return { occurrence: latest, missed };
  }

  async getState(taskId: string): Promise<ReminderState | null> {
    const r = (await this.db.query<{ state: ReminderState["state"]; occurrence: string; snoozed_until: string | null }>("SELECT state, occurrence, snoozed_until FROM reminder_state WHERE task_id = ?", [taskId]))[0];
    return r ? { state: r.state, occurrence: r.occurrence, snoozedUntil: r.snoozed_until } : null;
  }
  private async setState(taskId: string, occurrence: string, state: ReminderState["state"], snoozedUntil: string | null = null) {
    await this.db.exec("INSERT OR REPLACE INTO reminder_state(task_id, occurrence, state, snoozed_until, updated_at) VALUES (?, ?, ?, ?, ?)", [taskId, occurrence, state, snoozedUntil, this.clock.now()]);
  }

  /** Recordatorios cuya hora llegó. `onlyNew` deja fuera los ya disparados (para notificar solo lo nuevo en cada tic). */
  async dueReminders(opts: { onlyNew?: boolean } = {}): Promise<DueReminder[]> {
    const now = this.nowLocal();
    const out: DueReminder[] = [];
    for (const t of await this.list()) {
      if (t.done) continue;
      const cur = this.currentOccurrence(t, now);
      if (!cur) continue;
      const st = await this.getState(t.id);
      if (st && st.occurrence === cur.occurrence) {
        if (st.state === "dismissed") continue;
        if (st.state === "snoozed") { if ((st.snoozedUntil ?? "") > now) continue; }
        else if (opts.onlyNew) continue; // fired
      }
      out.push({ task: t, occurrence: cur.occurrence, missed: cur.missed });
    }
    return out.sort((a, b) => a.occurrence.localeCompare(b.occurrence) || a.task.title.localeCompare(b.task.title));
  }

  async markFired(taskId: string): Promise<void> {
    const t = await this.get(taskId);
    const cur = t ? this.currentOccurrence(t, this.nowLocal()) : null;
    if (t && cur) await this.setState(taskId, cur.occurrence, "fired");
  }
  async dismiss(taskId: string): Promise<void> {
    const t = await this.get(taskId);
    const cur = t ? this.currentOccurrence(t, this.nowLocal()) : null;
    if (t && cur) await this.setState(taskId, cur.occurrence, "dismissed");
  }

  async snooze(taskId: string, option: SnoozeOption): Promise<Result<void>> {
    const t = await this.get(taskId);
    if (!t) return err(appError("NOT_FOUND", "La tarea no existe", { id: taskId }));
    const now = this.nowLocal();
    let until: string;
    if (option === "10m") until = addMinutesLocal(now, 10);
    else if (option === "1h") until = addMinutesLocal(now, 60);
    else if (option === "tomorrow") until = `${addMinutesLocal(now, 24 * 60).slice(0, 10)}T${MORNING}`;
    else return err(appError("INVALID", "Opción de posponer desconocida", { reason: "SNOOZE" }));
    const cur = this.currentOccurrence(t, now);
    await this.setState(taskId, cur?.occurrence ?? t.remindAt ?? now, "snoozed", until);
    return ok(undefined);
  }

  /** Avisos a mostrar: pocos, uno a uno; muchos, una sola entrada agrupada (CL-14). */
  toNotifications(items: DueReminder[]): Notification[] {
    return items.length > GROUP_THRESHOLD ? [{ kind: "group", count: items.length, items }] : items.map((item) => ({ kind: "single", item }));
  }

  /** Al crear un recordatorio: ¿la fecha ya pasó? (CL-11) */
  checkReminderInput(remindAt: string): { status: "ok" } | { status: "invalid" } | { status: "past"; options: ["save_overdue", "change_date"] } {
    if (!isValidLocal(remindAt)) return { status: "invalid" };
    return remindAt < this.nowLocal() ? { status: "past", options: ["save_overdue", "change_date"] } : { status: "ok" };
  }

  // ---- Completar ----

  /** Marca la tarea como hecha; si es recurrente, programa la siguiente repetición desde la fecha original (CL-32). */
  async complete(taskId: string): Promise<Result<Task>> {
    const t = await this.get(taskId);
    if (!t) return err(appError("NOT_FOUND", "La tarea no existe", { id: taskId }));
    if (t.recurrence && (t.due || t.remindAt)) {
      const next = advanceSchedule({ due: t.due, remindAt: t.remindAt, recurrence: t.recurrence })!;
      const { due, remindAt, recurrence: rule } = next;
      await this.db.transaction(async (tx) => {
        await tx.exec("UPDATE tasks SET due = ?, remind_at = ?, recurrence = ?, done = 0, updated_at = ? WHERE id = ?", [due, remindAt, JSON.stringify(rule), this.clock.now(), taskId]);
        await tx.exec("DELETE FROM reminder_state WHERE task_id = ?", [taskId]);
      });
      await this.writer.setSchedule({ ...t, due, remindAt, recurrence: rule }, { due, remindAt, recurrence: rule });
    } else {
      await this.db.transaction(async (tx) => {
        await tx.exec("UPDATE tasks SET done = 1, updated_at = ? WHERE id = ?", [this.clock.now(), taskId]);
        await tx.exec("DELETE FROM reminder_state WHERE task_id = ?", [taskId]);
      });
      await this.writer.setDone(t, true);
    }
    return ok((await this.get(taskId))!);
  }

  // ---- Deshacer (spec 002, RF-11.1) ----

  /** Estado completo de una tarea (fechas, repetición, hecha y estado del recordatorio) para poder devolverla a ese punto. */
  async snapshot(taskId: string): Promise<{ task: Task; state: ReminderState | null } | null> {
    const task = await this.get(taskId);
    return task ? { task, state: await this.getState(taskId) } : null;
  }

  /** Devuelve la tarea al estado de una instantánea, también en su origen (documento o propiedad). */
  async restoreSnapshot(snap: { task: Task; state: ReminderState | null }): Promise<Result<Task>> {
    const cur = await this.get(snap.task.id);
    if (!cur) return err(appError("NOT_FOUND", "La tarea no existe", { id: snap.task.id }));
    const t = snap.task;
    await this.db.transaction(async (tx) => {
      await tx.exec("UPDATE tasks SET due = ?, remind_at = ?, recurrence = ?, done = ?, updated_at = ? WHERE id = ?", [t.due, t.remindAt, t.recurrence ? JSON.stringify(t.recurrence) : null, t.done ? 1 : 0, this.clock.now(), t.id]);
      await tx.exec("DELETE FROM reminder_state WHERE task_id = ?", [t.id]);
      if (snap.state) await tx.exec("INSERT INTO reminder_state(task_id, occurrence, state, snoozed_until, updated_at) VALUES (?, ?, ?, ?, ?)", [t.id, snap.state.occurrence, snap.state.state, snap.state.snoozedUntil, this.clock.now()]);
    });
    await this.writer.setSchedule(cur, { due: t.due, remindAt: t.remindAt, recurrence: t.recurrence });
    await this.writer.setDone(cur, t.done);
    return ok((await this.get(t.id))!);
  }

  // ---- Permiso de notificaciones ----

  /** Si el sistema bloquea las notificaciones, avisa UNA vez; si luego se conceden, se rearma por si vuelve a bloquearse (RF-11). */
  async shouldWarnAboutPermission(permission: "granted" | "denied" | "prompt"): Promise<boolean> {
    const key = "notifications_denied_warned";
    if (permission === "granted") { await this.db.exec("DELETE FROM meta WHERE key = ?", [key]); return false; }
    if (permission !== "denied") return false;
    if ((await this.db.query("SELECT 1 FROM meta WHERE key = ?", [key])).length > 0) return false;
    await this.db.exec("INSERT INTO meta(key, value) VALUES (?, '1')", [key]);
    return true;
  }
}
