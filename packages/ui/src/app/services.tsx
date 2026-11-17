import { createContext, useContext, type ReactNode } from "react";
import { create } from "zustand";
import type { Notifier } from "../reminders/notifier";
import type { ExportRuntime } from "../page/ExportDialog";
import type { UnsplashRuntime } from "../unsplash/UnsplashContext";
import type { UpdateInfo, AssetStore, GlobalShortcutService, InstanceLock, BackupService, Clock, RestoreSource, SqlStore, Workspace, WorkspaceManager } from "@vnote/core";

/** Servicios del núcleo y de la plataforma que la interfaz necesita; se inyectan desde cada cascarón (web o escritorio). */
/** Lo que cada cascarón aporta para el respaldo y la restauración (llavero, red, adjuntos y el tic periódico). */
export type BackupRuntime = {
  platform: "desktop" | "web";
  assetsFor(location: string): AssetStore;
  createService(ws: Workspace, store: SqlStore): BackupService;
  createRestoreSource(): RestoreSource;
  /** Suscripción al tic periódico (cada minuto): dispara los respaldos programados. */
  onTick(cb: () => void): () => void;
};

/** Recordatorios (RF-11): el notificador de la plataforma y el tic periódico que dispara la revisión. */
export type RemindersRuntime = {
  notifier: Notifier;
  onTick(cb: () => void): () => void;
  /** Hora local flotante actual (AAAA-MM-DDTHH:mm); por defecto, la del reloj del equipo. */
  nowLocal?: () => string;
};

export type AppServices = {
  workspaces: WorkspaceManager;
  clock: Clock;
  backup?: BackupRuntime;
  /** Fotos de portada de Unsplash (RF-2.4, RF-9): el llavero y el `fetch` de cada cascarón. Sin él, la función no existe. */
  unsplash?: UnsplashRuntime;
  reminders?: RemindersRuntime;
  /** Solo en escritorio: abre una carpeta en el explorador de archivos del sistema. */
  /** Solo en la web: garantiza un único editor por espacio entre pestañas (CL-22). */
  instanceLock?: InstanceLock;
  revealLocation?: (location: string) => void;
  /** Solo en escritorio: abre una dirección permitida en el navegador (en la ventana de Tauri, `target="_blank"` no hace nada). */
  openExternal?: (url: string) => void;
  /** Solo en escritorio: diálogo nativo para elegir una carpeta (RF-25); null si se cancela. */
  pickFolder?: () => Promise<string | null>;
  /** Exportar páginas a HTML/PDF (RF-24): de dónde salen los adjuntos de un espacio y cómo entrega cada plataforma el resultado. */
  exporter?: { assetsFor(location: string): AssetStore; runtime: ExportRuntime };
  /** Solo en escritorio: busca una versión nueva y abre su página de descarga (RF-19). */
  updates?: { check: () => Promise<UpdateInfo>; openDownload: (url: string) => void };
  /** Solo en escritorio: atajo global de captura rápida y la orden que un atajo del sistema puede ejecutar. */
  globalShortcut?: { service: GlobalShortcutService; command: string };
  /** Solo en escritorio: avisa cuando otra ventana (la de captura) guardó una nota en un espacio. */
  /** Solo en escritorio: la ventana de recordatorio pidió abrir una tarea (espacio y página). */
  onOpenTask?: (cb: (e: { workspaceId: string; pageId: string }) => void) => () => void;
  onCaptured?: (cb: (workspaceId: string) => void) => () => void;
};

const Ctx = createContext<AppServices | null>(null);

export function AppServicesProvider({ services, children }: { services: AppServices; children: ReactNode }) {
  return <Ctx.Provider value={services}>{children}</Ctx.Provider>;
}

export function useServices(): AppServices {
  const s = useContext(Ctx);
  if (!s) throw new Error("useServices debe usarse dentro de un AppServicesProvider");
  return s;
}

/** `openExternal` si hay uno; fuera de un proveedor (o en la web) devuelve `undefined` y el enlace normal funciona. */
export function useOpenExternal(): ((url: string) => void) | undefined {
  return useContext(Ctx)?.openExternal;
}

/** Estado SOLO de interfaz (qué está abierto). Los datos viven en el núcleo, no aquí. */
type UiState = {
  workspaceId: string | null;
  openPageId: string | null;
  openWorkspace: (id: string | null) => void;
  openPage: (id: string | null) => void;
  reset: () => void;
};

export const useUiStore = create<UiState>((set) => ({
  workspaceId: null,
  openPageId: null,
  openWorkspace: (id) => set({ workspaceId: id, openPageId: null }),
  openPage: (id) => set({ openPageId: id }),
  reset: () => set({ workspaceId: null, openPageId: null }),
}));
