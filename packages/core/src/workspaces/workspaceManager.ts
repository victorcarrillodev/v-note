import { appError, err, ok, type Result } from "../result";
import type { Clock } from "../clock";
import { newId } from "../ids";
import { migrate } from "../db/migrate";
import { migrations } from "../db/migrations";
import type { SqlStore } from "../ports/sqlStore";
import type { AppConfigStore, WorkspaceStorage } from "./ports";

export type Workspace = { id: string; name: string; location: string; isCaptureDefault: boolean };
type Registry = { version: 1; workspaces: Workspace[] };
const REGISTRY_VERSION = 1;

export class WorkspaceManager {
  private open_ = new Map<string, SqlStore>();
  constructor(private config: AppConfigStore, private storage: WorkspaceStorage, private clock: Clock) {}

  private async load(): Promise<Result<Registry>> {
    const text = await this.config.read();
    if (text === null) return ok({ version: REGISTRY_VERSION, workspaces: [] });
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return err(appError("STORAGE", "El registro de espacios de trabajo está dañado; no se modificó"));
    }
    const reg = parsed as Partial<Registry>;
    if (typeof reg.version === "number" && reg.version > REGISTRY_VERSION) {
      return err(appError("UNSUPPORTED_VERSION", "El registro de espacios es de una versión más nueva", { found: reg.version, supported: REGISTRY_VERSION }));
    }
    if (!Array.isArray(reg.workspaces)) return err(appError("STORAGE", "El registro de espacios de trabajo es inválido; no se modificó"));
    return ok({ version: REGISTRY_VERSION, workspaces: reg.workspaces });
  }

  private save(reg: Registry): Promise<void> {
    return this.config.write(JSON.stringify(reg, null, 2));
  }

  async list(): Promise<Result<Workspace[]>> {
    const r = await this.load();
    return r.ok ? ok(r.value.workspaces) : r;
  }

  async create(input: { name: string; location?: string }): Promise<Result<Workspace>> {
    const name = input.name.trim();
    if (name === "") return err(appError("INVALID", "El nombre del espacio de trabajo no puede estar vacío"));
    const reg = await this.load();
    if (!reg.ok) return reg;
    const id = newId();
    const location = input.location ?? this.storage.defaultLocation(id);
    const norm = (l: string) => l.replace(/[\\/]+$/, "");
    if (reg.value.workspaces.some((w) => norm(w.location) === norm(location))) return err(appError("CONFLICT", "Esa carpeta ya la usa otro espacio de trabajo", { location }));
    const store = await this.storage.open(location);
    const migrated = await migrate(store, migrations);
    if (!migrated.ok) { await store.close(); return migrated; }
    const ws: Workspace = { id, name, location, isCaptureDefault: reg.value.workspaces.length === 0 };
    reg.value.workspaces.push(ws);
    await this.save(reg.value);
    this.open_.set(id, store);
    return ok(ws);
  }

  async rename(id: string, name: string): Promise<Result<Workspace>> {
    if (name.trim() === "") return err(appError("INVALID", "El nombre del espacio de trabajo no puede estar vacío"));
    const reg = await this.load();
    if (!reg.ok) return reg;
    const ws = reg.value.workspaces.find((w) => w.id === id);
    if (!ws) return err(appError("NOT_FOUND", "El espacio de trabajo no existe", { id }));
    ws.name = name.trim();
    await this.save(reg.value);
    return ok(ws);
  }

  /** Abre (o reutiliza) la base de un espacio. Si su ubicación no está disponible, avisa y NO crea una base vacía. */
  async open(id: string): Promise<Result<{ workspace: Workspace; store: SqlStore }>> {
    const reg = await this.load();
    if (!reg.ok) return reg;
    const ws = reg.value.workspaces.find((w) => w.id === id);
    if (!ws) return err(appError("NOT_FOUND", "El espacio de trabajo no existe", { id }));
    const cached = this.open_.get(id);
    if (cached) return ok({ workspace: ws, store: cached });
    if (!(await this.storage.exists(ws.location))) {
      return err(appError("STORAGE", "La ubicación de datos de este espacio no está disponible", { location: ws.location, reason: "UNAVAILABLE" }));
    }
    const store = await this.storage.open(ws.location);
    const migrated = await migrate(store, migrations);
    if (!migrated.ok) { await store.close(); return migrated; }
    this.open_.set(id, store);
    return ok({ workspace: ws, store });
  }

  /** Cierra la base abierta de un espacio (la siguiente apertura la reabre desde su ubicación). */
  async closeWorkspace(id: string): Promise<void> {
    const store = this.open_.get(id);
    if (store) { await store.close(); this.open_.delete(id); }
  }

  /** Cambia la ubicación registrada de un espacio. Lanza si no puede guardar el registro (el llamador revierte). */
  async relocate(id: string, location: string): Promise<void> {
    const reg = await this.load();
    if (!reg.ok) throw new Error(reg.error.message);
    const ws = reg.value.workspaces.find((w) => w.id === id);
    if (!ws) throw new Error("El espacio de trabajo no existe");
    await this.closeWorkspace(id);
    ws.location = location;
    await this.save(reg.value);
  }

  async setCaptureDefault(id: string): Promise<Result<Workspace>> {
    const reg = await this.load();
    if (!reg.ok) return reg;
    const target = reg.value.workspaces.find((w) => w.id === id);
    if (!target) return err(appError("NOT_FOUND", "El espacio de trabajo no existe", { id }));
    for (const w of reg.value.workspaces) w.isCaptureDefault = w.id === id;
    await this.save(reg.value);
    return ok(target);
  }

  async captureDefault(): Promise<Result<Workspace | null>> {
    const l = await this.list();
    return l.ok ? ok(l.value.find((w) => w.isCaptureDefault) ?? null) : l;
  }

  /** Datos que la interfaz muestra antes de confirmar una eliminación (CL-29). */
  async prepareDelete(id: string): Promise<Result<{ name: string; lastBackupAt: number | null; hasNoBackup: boolean }>> {
    const opened = await this.open(id);
    if (!opened.ok) return opened;
    const rows = await opened.value.store.query<{ value: string }>("SELECT value FROM meta WHERE key = 'last_backup_at'");
    const lastBackupAt = rows[0] ? Number(rows[0].value) : null;
    return ok({ name: opened.value.workspace.name, lastBackupAt, hasNoBackup: lastBackupAt === null });
  }

  /** Elimina un espacio y sus datos. Exige escribir el nombre exacto (constitución, art. 5). */
  async delete(id: string, opts: { typedName: string }): Promise<Result<void>> {
    const reg = await this.load();
    if (!reg.ok) return reg;
    const ws = reg.value.workspaces.find((w) => w.id === id);
    if (!ws) return err(appError("NOT_FOUND", "El espacio de trabajo no existe", { id }));
    if (opts.typedName !== ws.name) return err(appError("NEEDS_CONFIRMATION", "Debes escribir el nombre exacto del espacio para eliminarlo", { id }));
    const store = this.open_.get(id);
    if (store) { await store.close(); this.open_.delete(id); }
    await this.storage.remove(ws.location);
    reg.value.workspaces = reg.value.workspaces.filter((w) => w.id !== id);
    await this.save(reg.value);
    return ok(undefined);
  }
}
