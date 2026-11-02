import type { AppConfigStore, SqlStore, WorkspaceStorage } from "@vnote/core";
import { TauriSqlStore, type Invoke } from "./tauriSqlStore";

/** Configuración de la aplicación (registro de espacios) en un archivo JSON de la carpeta de configuración. */
export class TauriAppConfigStore implements AppConfigStore {
  constructor(private invoke: Invoke) {}
  async read(): Promise<string | null> {
    return ((await this.invoke("config_read")) as string | null) ?? null;
  }
  async write(text: string): Promise<void> {
    await this.invoke("config_write", { text });
  }
}

const join = (a: string, b: string) => `${a.replace(/[\\/]+$/, "")}/${b}`;

/** Espacios de trabajo como carpetas con `space.db` y `assets/` (RF-25). */
export class TauriWorkspaceStorage implements WorkspaceStorage {
  private constructor(private invoke: Invoke, private dataDir: string) {}

  static async create(invoke: Invoke): Promise<TauriWorkspaceStorage> {
    const dirs = (await invoke("app_dirs")) as { dataDir: string };
    return new TauriWorkspaceStorage(invoke, dirs.dataDir);
  }

  defaultLocation(workspaceId: string): string {
    return join(join(this.dataDir, "workspaces"), workspaceId);
  }
  assetsDir(location: string): string {
    return join(location, "assets");
  }
  async exists(location: string): Promise<boolean> {
    return (await this.invoke("path_exists", { path: location })) as boolean;
  }
  open(location: string): Promise<SqlStore> {
    return TauriSqlStore.open(this.invoke, join(location, "space.db"));
  }
  async remove(location: string): Promise<void> {
    await this.invoke("workspace_remove", { dir: location });
  }
}
