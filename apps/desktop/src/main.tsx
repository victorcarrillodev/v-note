import { createRoot } from "react-dom/client";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { getVersion } from "@tauri-apps/api/app";
import { emit, listen } from "@tauri-apps/api/event";
import { I18nextProvider } from "react-i18next";
import { BackupService, BackupWorkerClient, GitHubTokenStore, checkForUpdate, RestoreSource, WorkspaceManager, appError, brand, err, ok, systemClock, type FetchLike, type UnsplashFetch, type GlobalShortcutService, type SqlStore } from "@vnote/core";
import { TauriNotifier } from "./tauriNotifier";
import { tauriExportRuntime } from "./tauriExportRuntime";
import { TauriAppConfigStore, TauriAssetStore, TauriKeychain, TauriWorkspaceStorage } from "@vnote/adapters-tauri";
import { App, LocalStoragePreferences, PageEditor, QuickCaptureView, ReminderCenter, ReminderPopup, SyncedAppearance, createI18n, hideSplash } from "@vnote/ui";
import "./styles.css";

const fetchLike: FetchLike = (url, init) => fetch(url, init as RequestInit);
const unsplashFetch: UnsplashFetch = (url, init) => fetch(url, init as RequestInit);

/** Un solo worker de respaldo por aplicación; si el entorno no soporta workers, el servicio trabaja en el hilo principal. */
let backupWorker: BackupWorkerClient | undefined;
function backupWorkerClient(): BackupWorkerClient | undefined {
  if (backupWorker || typeof Worker === "undefined") return backupWorker;
  try { backupWorker = new BackupWorkerClient(new Worker(new URL("./backup.worker.ts", import.meta.url), { type: "module" }) as never); } catch { /* sin worker */ }
  return backupWorker;
}

async function start() {
  document.title = brand.name;
  void getCurrentWindow().setTitle(brand.name).catch(() => {});
  const storage = await TauriWorkspaceStorage.create(invoke);
  const workspaces = new WorkspaceManager(new TauriAppConfigStore(invoke), storage, systemClock);
  const keychain = new TauriKeychain(invoke, brand.appId);
  const assetsFor = (location: string) => new TauriAssetStore(invoke, storage.assetsDir(location));
  const onTick = (cb: () => void) => {
    const handler = () => { document.documentElement.dataset.ticks = String(Number(document.documentElement.dataset.ticks ?? "0") + 1); cb(); };
    const offs = Promise.all([listen("vnote://tick", handler), listen("vnote://resume", handler)]);
    return () => void offs.then((fns) => fns.forEach((off) => off()));
  };
  const backup = {
    platform: "desktop" as const,
    assetsFor,
    createService: (ws: { id: string; name: string; location: string }, store: SqlStore) =>
      new BackupService({ store, assets: assetsFor(ws.location), clock: systemClock, workspace: { id: ws.id, name: ws.name }, tokens: new GitHubTokenStore(keychain, ws.id), fetch: fetchLike, ...(backupWorkerClient() ? { worker: backupWorkerClient()! } : {}) }),
    createRestoreSource: () => new RestoreSource({ fetch: fetchLike }),
    onTick,
  };
  const preferences = new LocalStoragePreferences();
  // Título de la ventana nativa: el nombre del producto (configuración de marca).
  void getCurrentWindow().setTitle(brand.name).catch(() => {});
  const i18n = await createI18n(preferences.get("language") === "en" ? "en" : undefined);

  // Ventana mínima de captura rápida (RF-13): la abre el atajo global, la bandeja o `--capture`.
  if (new URLSearchParams(window.location.search).has("capture")) {
    hideSplash();
    document.title = i18n.t("capture.title");
    const close = () => void getCurrentWindow().close().catch(() => {});
    createRoot(document.getElementById("root")!).render(
      <I18nextProvider i18n={i18n}>
        <SyncedAppearance preferences={preferences}><QuickCaptureView manager={workspaces} clock={systemClock} onClose={close} onSaved={(id) => { void emit("vnote://captured", id).finally(close); }} /></SyncedAppearance>
      </I18nextProvider>,
    );
    return;
  }

  // Ventana pequeña de recordatorio (RF-11): Abrir, Hecho y Posponer sobre la tarea indicada en la dirección.
  const query = new URLSearchParams(window.location.search);
  if (query.has("reminder")) {
    const ws = query.get("ws") ?? "", page = query.get("page") ?? "", task = query.get("task") ?? "";
    const center = new ReminderCenter({ workspaces, clock: systemClock, notifier: new TauriNotifier(), nowLocal: () => new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 16) });
    hideSplash();
    document.title = i18n.t("reminders.title");
    const close = () => void getCurrentWindow().close().catch(() => {});
    createRoot(document.getElementById("root")!).render(
      <I18nextProvider i18n={i18n}>
        <SyncedAppearance preferences={preferences}><ReminderPopup title={query.get("title") ?? ""} when={query.get("when") ?? ""} onClose={close}
          onOpen={() => invoke("open_task", { workspaceId: ws, pageId: page })}
          onDone={() => center.complete(ws, task)}
          onSnooze={(o) => center.snooze(ws, task, o)} /></SyncedAppearance>
      </I18nextProvider>,
    );
    return;
  }

  const globalShortcut = {
    service: {
      async set(combo) {
        try { await invoke("capture_shortcut_set", { combo }); return ok(undefined); }
        catch (e) { return err(appError("STORAGE", String(e))); }
      },
    } satisfies GlobalShortcutService,
    command: `"${await invoke<string>("exe_path").catch(() => brand.name)}" --capture`,
  };
  const onCaptured = (cb: (workspaceId: string) => void) => {
    const off = listen<string>("vnote://captured", (e) => cb(e.payload));
    return () => void off.then((fn) => fn());
  };
  createRoot(document.getElementById("root")!).render(
    <I18nextProvider i18n={i18n}>
      <App services={{ workspaces, clock: systemClock, backup, unsplash: { platform: "desktop", keychain, fetch: unsplashFetch }, exporter: { assetsFor, runtime: tauriExportRuntime(invoke) }, reminders: { notifier: new TauriNotifier(), onTick }, updates: { check: async () => { const r = await checkForUpdate({ fetch: fetchLike as never, repo: brand.updateRepo, current: await getVersion() }); return r.ok ? r.value : { available: false as const }; }, openDownload: (url) => void invoke("open_release_url", { url }).catch(() => {}) }, pickFolder: async () => { const r = await openDialog({ directory: true, multiple: false }); return typeof r === "string" ? r : null; }, openExternal: (url) => void invoke("open_unsplash_url", { url }).catch(() => {}), revealLocation: (location) => void invoke("reveal_path", { path: location }).catch(() => {}), globalShortcut, onCaptured, onOpenTask: (cb) => { const off = listen<{ workspaceId: string; pageId: string }>("vnote://open-task", (e) => cb(e.payload)); return () => void off.then((f) => f()); } }} preferences={preferences} renderPageBody={(id, controller, ws) => <PageEditor controller={controller} pageId={id} assets={assetsFor(ws.location)} />} />
    </I18nextProvider>,
  );
}
void start();
