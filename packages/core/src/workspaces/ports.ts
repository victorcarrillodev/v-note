import type { SqlStore } from "../ports/sqlStore";

/** Configuración de la aplicación fuera de las bases de los espacios (sin secretos). */
export interface AppConfigStore {
  read(): Promise<string | null>;
  /** Debe escribir de forma atómica (archivo temporal + renombrado). */
  write(text: string): Promise<void>;
}

/** Dónde viven físicamente los espacios de trabajo (carpeta nativa u OPFS del navegador). */
export interface WorkspaceStorage {
  defaultLocation(workspaceId: string): string;
  exists(location: string): Promise<boolean>;
  open(location: string): Promise<SqlStore>;
  remove(location: string): Promise<void>;
}
