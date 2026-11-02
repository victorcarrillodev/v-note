import { createRoot } from "react-dom/client";
import { I18nextProvider } from "react-i18next";
import { BackupService, BackupWorkerClient, GitHubTokenStore, MemoryKeychain, RestoreSource, WorkspaceManager, brand, systemClock, type FetchLike, type SqlStore } from "@vnote/core";
import { LazyAssetStore, LocalStorageConfigStore, OpfsAssetStore, WebInstanceLock, WebWorkspaceStorage } from "@vnote/adapters-web";
import { App, LocalStoragePreferences, PageEditor, WebNotifier, createI18n, webExportRuntime } from "@vnote/ui";
import "./styles.css";

const fetchLike: FetchLike = (url, init) => fetch(url, init as RequestInit);

/** Un solo worker de respaldo por aplicación; si el entorno no soporta workers, el servicio trabaja en el hilo principal. */
let backupWorker: BackupWorkerClient | undefined;
function backupWorkerClient(): BackupWorkerClient | undefined {
  if (backupWorker || typeof Worker === "undefined") return backupWorker;
  try { backupWorker = new BackupWorkerClient(new Worker(new URL("./backup.worker.ts", import.meta.url), { type: "module" }) as never); } catch { /* sin worker */ }
  return backupWorker;
}

/** Adjuntos del espacio en su propia carpeta de OPFS. */
const assetsFor = (location: string) =>
  new LazyAssetStore(async () => {
    const root = await navigator.storage.getDirectory();
    const dir = await root.getDirectoryHandle(`assets-${location.replace(/[^a-zA-Z0-9]+/g, "_")}`, { create: true });
    return new OpfsAssetStore(dir as unknown as ConstructorParameters<typeof OpfsAssetStore>[0]);
  });

// El tic es de un minuto; `?vnote-tick=<ms>` solo lo acelera para las pruebas automáticas.
const tickMs = (() => { const v = Number(new URLSearchParams(location.search).get("vnote-tick")); return Number.isFinite(v) && v >= 100 ? v : 60_000; })();

async function start() {
  document.title = brand.name;
  const storage = new WebWorkspaceStorage(() => new Worker(new URL("../../../packages/adapters-web/src/opfsWorker.ts", import.meta.url), { type: "module" }));
  const workspaces = new WorkspaceManager(new LocalStorageConfigStore(), storage, systemClock);
  // En la web el token vive solo en memoria (no hay llavero): hay que reconectar al reabrir la app.
  const keychain = new MemoryKeychain();
  const backup = {
    platform: "web" as const,
    assetsFor,
    createService: (ws: { id: string; name: string; location: string }, store: SqlStore) =>
      new BackupService({ store, assets: assetsFor(ws.location), clock: systemClock, workspace: { id: ws.id, name: ws.name }, tokens: new GitHubTokenStore(keychain, ws.id), fetch: fetchLike, ...(backupWorkerClient() ? { worker: backupWorkerClient()! } : {}) }),
    createRestoreSource: () => new RestoreSource({ fetch: fetchLike }),
    onTick: (cb: () => void) => { const t = setInterval(cb, 60_000); return () => clearInterval(t); },
  };
  const preferences = new LocalStoragePreferences();
  const i18n = await createI18n(preferences.get("language") === "en" ? "en" : undefined);
  createRoot(document.getElementById("root")!).render(
    <I18nextProvider i18n={i18n}>
      <App services={{ workspaces, clock: systemClock, backup, exporter: { assetsFor, runtime: webExportRuntime }, instanceLock: new WebInstanceLock(), reminders: { notifier: new WebNotifier(), onTick: (cb) => { const t = setInterval(cb, tickMs); return () => clearInterval(t); } } }} preferences={preferences} renderPageBody={(id, controller, ws) => <PageEditor controller={controller} pageId={id} assets={assetsFor(ws.location)} />} />
    </I18nextProvider>,
  );
}
void start();
