import type { AppConfigStore, SqlStore, WorkspaceStorage } from "@vnote/core";
import { WasmSqlStore, type WorkerLike } from "./wasmSqlStore";

/** Registro de espacios en localStorage (solo la lista, sin secretos). Falla ruidosamente si no puede guardar. */
export class LocalStorageConfigStore implements AppConfigStore {
  private key = "vnote:config";
  async read(): Promise<string | null> {
    return localStorage.getItem(this.key);
  }
  async write(text: string): Promise<void> {
    localStorage.setItem(this.key, text);
  }
}

/** Cada espacio es una base SQLite en OPFS, atendida por su propio Worker (plan D-2, D-4). */
export class WebWorkspaceStorage implements WorkspaceStorage {
  constructor(private workerFactory: () => WorkerLike) {}

  defaultLocation(workspaceId: string): string {
    return `/workspaces/${workspaceId}/space.db`;
  }
  async exists(_location: string): Promise<boolean> {
    return true; // en el navegador el registro de espacios es la fuente de verdad
  }
  open(location: string): Promise<SqlStore> {
    return WasmSqlStore.open(this.workerFactory(), location);
  }
  async remove(location: string): Promise<void> {
    await WasmSqlStore.unlink(this.workerFactory(), location);
  }
}
