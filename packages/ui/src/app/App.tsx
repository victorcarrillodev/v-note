import { UpdateNotice } from "./UpdateNotice";
import { InlineAlert } from "../components/InlineAlert";
import { ImportView } from "../import/ImportView";
import { GlobalShortcutProvider, useGlobalShortcut } from "../capture/globalShortcut";
import { indexPendingPdfs } from "../attachments/indexPdfs";
import { QuickCaptureView } from "../capture/QuickCaptureView";
import { GraphView } from "../graph/GraphView";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { PageNode } from "@vnote/core";
import { AppBackupService, UnifiedBackupController, createDestination, restoreAllFromBackup, type BackupService, type InstanceLockHandle, type RestoreSource, type Workspace } from "@vnote/core";
import { AppServicesProvider, useServices, type AppServices } from "./services";
import { UnsplashProvider } from "../unsplash/UnsplashContext";
import { ReviewView } from "../study/ReviewView";
import { PageBody } from "../page/PageBody";
import { PageZoom } from "../page/zoom/PageZoom";
import { PageStyleScope } from "../page/PageStyleScope";
import { AppErrorBoundary } from "../feedback/ErrorScreen";
import { ToastProvider } from "../feedback/ToastContext";
import { AppShell } from "../layout/AppShell";
import { AppHeader } from "../layout/AppHeader";
import { loadAppearance, applyAppearance, useStorageSync } from "../design/appearance";
import { WelcomeScreen } from "../identity/WelcomeScreen";
import { WorkspaceSwitcher } from "../sidebar/WorkspaceSwitcher";
import { SidebarLinks } from "../sidebar/SidebarLinks";
import { useDensity, rowHeightFor } from "../design/useDensity";
import { installInputModality } from "../design/inputModality";
import { detectPlatform } from "../design/platform";
import { formatCombo, toAriaShortcut } from "../layout/formatCombo";
import { ThemeProvider, useTheme, type PreferenceStore } from "../theme/theme";
import { CommandPalette, type PaletteAction } from "../palette/CommandPalette";
import { DatabasePage } from "../databases/DatabasePage";
import { ReminderCenter } from "../reminders/reminderCenter";
import { RemindersView } from "../reminders/RemindersView";
import { SettingsPanel } from "../settings/SettingsView";
import { loadBindings } from "../settings/bindingsStore";
import { comboFromEvent, gcAssets } from "@vnote/core";
import { Sidebar } from "../sidebar/Sidebar";
import { WorkspaceAssetsContext } from "../shared/workspaceAssets";
import { PageHeader } from "../page/PageHeader";
import { ExportDialog } from "../page/ExportDialog";
import { TrashView } from "../trash/TrashView";
import { TagsView } from "../tags/TagsView";
import { EmptyState } from "../empty/EmptyState";
import { WorkspaceManagerView } from "../workspaces/WorkspaceManagerView";
import { WorkspaceController } from "../workspace/controller";
import { BackupPanel } from "../backup/BackupPanel";
import { RestoreWizard } from "../restore/RestoreWizard";
import { UnifiedBackupPanel } from "../backup/UnifiedBackupPanel";
import { RestoreAllPanel } from "../backup/RestoreAllPanel";
import { loadUnifiedConfig } from "../backup/unifiedConfig";
import { GENERATE_CARDS_EVENT } from "../study/generateCards";
import { RunnerProvider } from "../runner/RunnerContext";
import { createBrowserRunner } from "../runner/defaultRunner";
import { useWorkspace } from "../workspace/useController";
import { hideSplash } from "./splash";

type View = "loading" | "page" | "trash" | "workspaces" | "backup" | "restore" | "restoreAll" | "locked" | "reminders" | "graph" | "import" | "tags" | "review";
type Opened = { workspace: Workspace; controller: WorkspaceController };

export type AppProps = {
  services: AppServices;
  preferences: PreferenceStore;
  /** El cascarón inyecta aquí el cuerpo de la página (el editor de bloques). */
  renderPageBody?: (pageId: string, controller: WorkspaceController, workspace: Workspace) => ReactNode;
};

export function App({ services, preferences, renderPageBody }: AppProps) {
  // Ejecutor de código: el que indique el cascarón, o el de siempre (un Worker creado a demanda). `null` = sin ejecución.
  const runner = useMemo(() => (services.codeRunner !== undefined ? services.codeRunner : createBrowserRunner()), [services.codeRunner]);
  useEffect(() => () => { if (services.codeRunner === undefined) (runner as { dispose?: () => void } | null)?.dispose?.(); }, [runner, services.codeRunner]);
  const body = (
    <ToastProvider><AppErrorBoundary><Main renderPageBody={renderPageBody} preferences={preferences} /></AppErrorBoundary></ToastProvider>
  );
  return (
    <ThemeProvider preferences={preferences}>
      <AppServicesProvider services={services}>
        <UnsplashProvider runtime={services.unsplash} preferences={preferences}>
          {runner ? <RunnerProvider value={runner}>{body}</RunnerProvider> : body}
        </UnsplashProvider>
      </AppServicesProvider>
    </ThemeProvider>
  );
}

function Main({ renderPageBody, preferences }: { renderPageBody: AppProps["renderPageBody"]; preferences: PreferenceStore }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { workspaces, clock, backup, unifiedBackup, updates, exporter, pickFolder, onOpenTask, revealLocation, instanceLock, reminders, globalShortcut, onCaptured } = useServices();
  const [view, setView] = useState<View>("loading");
  // La pantalla de carga se quita solo cuando la app ya puede usarse (sale de "loading").
  useEffect(() => { if (view !== "loading") hideSplash(); }, [view]);
  const [opened, setOpened] = useState<Opened | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [captureOpen, setCaptureOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const shortcutState = useGlobalShortcut(globalShortcut?.service, preferences, globalShortcut?.command ?? "");

  // Un solo editor por espacio (CL-22): el bloqueo se toma al abrir y se conserva mientras esta ventana viva.
  const locks = useRef(new Map<string, InstanceLockHandle>());
  const [lockedId, setLockedId] = useState<string | null>(null);
  const ensureLock = useCallback(async (id: string): Promise<boolean> => {
    if (!instanceLock || locks.current.has(id)) return true;
    const h = await instanceLock.acquire(`workspace:${id}`).catch(() => null);
    if (!h) return false;
    locks.current.set(id, h);
    return true;
  }, [instanceLock]);

  // Centro de recordatorios: revisa todos los espacios en cada tic y arma el resumen global (RF-11, RF-12)
  const center = useMemo(() => {
    if (!reminders) return null;
    const nowLocal = reminders.nowLocal ?? (() => { const d = new Date(clock.now()); const p = (n: number) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; });
    return new ReminderCenter({ workspaces, clock, notifier: reminders.notifier, nowLocal });
  }, [reminders, workspaces, clock]);
  useEffect(() => (center && reminders ? reminders.onTick(() => void center.tick()) : undefined), [center, reminders]);

  // Respaldo unificado: un controlador por aplicación; cada escritura en cualquier espacio avisa para el modo continuo.
  /** Destino según la configuración vigente (se lee de las preferencias en cada uso, para respetar cambios al instante). */
  const configuredDestination = useCallback(() => {
    if (!unifiedBackup) return Promise.resolve({ ok: false as const, error: { kind: "INVALID" as const, message: "", retryable: false } });
    return createDestination(loadUnifiedConfig(preferences).destination, {
      fetch: unifiedBackup.fetch, keychain: unifiedBackup.keychain,
      folderPort: () => { const path = loadUnifiedConfig(preferences).folderPath; return path && unifiedBackup.folderPort ? unifiedBackup.folderPort(path) : null; },
    });
  }, [unifiedBackup, preferences]);
  const unified = useMemo(() => {
    if (!unifiedBackup || !backup) return null;
    const service = new AppBackupService({ workspaces, assetsFor: backup.assetsFor, clock });
    return new UnifiedBackupController({ service, clock, destination: configuredDestination });
  }, [unifiedBackup, backup, workspaces, clock, configuredDestination]);
  useEffect(() => {
    if (!unified) return;
    const saved = loadUnifiedConfig(preferences);
    if (saved.folderPath) void unifiedBackup?.restoreFolder?.(saved.folderPath).then((ok) => { if (ok) unified.destinationChanged(); });
    unified.setContinuous(saved.continuous);
    const off = workspaces.onWrite((id) => unified.notifyChange(id));
    return () => { off(); unified.dispose(); };
  }, [unified, unifiedBackup, workspaces, preferences]);
  const restoreAll = useCallback(async () => {
    if (!backup) return { error: t("backupAll.unavailable") };
    const dest = await configuredDestination();
    if (!dest.ok) return { error: dest.error.message };
    const files = await dest.value.downloadAll();
    if (!files.ok) return { error: files.error.message };
    const r = await restoreAllFromBackup(workspaces, backup.assetsFor, files.value);
    if (!r.ok) return { error: r.error.message };
    return { restored: r.value.restored.length, failed: r.value.failed };
  }, [backup, configuredDestination, workspaces, t]);

  const backupServices = useRef(new Map<string, BackupService>());
  const [restoreSource, setRestoreSource] = useState<RestoreSource | null>(null);
  const serviceFor = useCallback((ws: Workspace, store: Parameters<NonNullable<typeof backup>["createService"]>[1]) => {
    if (!backup) return null;
    let s = backupServices.current.get(ws.id);
    if (!s) { s = backup.createService(ws, store); backupServices.current.set(ws.id, s); }
    return s;
  }, [backup]);

  // Tic periódico: revisa si algún espacio tiene un respaldo vencido (RF-15). Cada espacio se respalda de forma independiente.
  useEffect(() => {
    if (!backup) return;
    return backup.onTick(() => {
      void (async () => {
        const list = await workspaces.list();
        if (!list.ok) return;
        for (const ws of list.value) {
          if (!(await ensureLock(ws.id))) continue; // otra ventana lo edita: ella se encarga de su respaldo
          const o = await workspaces.open(ws.id);
          if (o.ok) await serviceFor(o.value.workspace, o.value.store)?.tick();
        }
      })();
    });
  }, [backup, workspaces, serviceFor, ensureLock]);

  // Una nota guardada desde la ventana de captura aparece en el espacio abierto sin tener que recargar.
  useEffect(() => {
    if (!onCaptured || !opened) return;
    return onCaptured((id) => { if (opened.workspace.id === id) void opened.controller.refresh(); });
  }, [onCaptured, opened]);

  // Atajos globales: se leen de las preferencias en cada pulsación para respetar reasignaciones al instante.
  const actions = useRef<Record<string, () => void>>({});
  actions.current = {
    "page.new": () => { if (opened) { void opened.controller.createPage(null).then(() => setView("page")); } },
    "palette.open": () => { if (opened) setPaletteOpen(true); },
    "capture.open": () => setCaptureOpen(true),
    "cards.generate": () => { if (opened && view === "page") window.dispatchEvent(new Event(GENERATE_CARDS_EVENT)); },
    "theme.toggle": () => theme.setMode(theme.resolved === "dark" ? "light" : "dark"),
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      const combo = comboFromEvent(e);
      if (!combo) return;
      const id = Object.entries(loadBindings(preferences)).find(([, c]) => c === combo)?.[0];
      const run = id ? actions.current[id] : undefined;
      if (run) { e.preventDefault(); run(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [preferences]);

  const bindings = loadBindings(preferences);
  const shortcutOf = (id: string) => formatCombo(bindings[id] ?? null, detectPlatform());
  const ariaOf = (id: string) => toAriaShortcut(bindings[id] ?? null, detectPlatform());
  const paletteActions: PaletteAction[] = [
    { id: "page.new", label: t("shortcuts.pageNew"), run: () => actions.current["page.new"]?.(), shortcut: shortcutOf("page.new"), ariaShortcut: ariaOf("page.new") },
    { id: "theme.toggle", label: t("shortcuts.themeToggle"), run: () => actions.current["theme.toggle"]?.(), shortcut: shortcutOf("theme.toggle"), ariaShortcut: ariaOf("theme.toggle") },
    { id: "capture.open", label: t("shortcuts.captureOpen"), run: () => setCaptureOpen(true), shortcut: shortcutOf("capture.open"), ariaShortcut: ariaOf("capture.open") },
    { id: "settings.open", label: t("settings.title"), run: () => setSettingsOpen(true) },
  ].map((a) => (a.shortcut ? a : { id: a.id, label: a.label, run: a.run }));

  // `t` cambia al cambiar de idioma; si openWorkspace dependiera de él, el arranque se repetiría y sacaría de la pantalla actual.
  const tRef = useRef(t);
  tRef.current = t;
  const openWorkspace = useCallback(async (id: string): Promise<WorkspaceController | null> => {
    setError(null);
    if (!(await ensureLock(id))) { setLockedId(id); setOpened(null); setView("locked"); return null; }
    setLockedId(null);
    const r = await workspaces.open(id);
    if (!r.ok) {
      const d = r.error.details as { reason?: string; location?: string } | undefined;
      setError(d?.reason === "UNAVAILABLE" ? tRef.current("workspace.unavailable", { location: d.location ?? "" }) : tRef.current("workspace.openFailed"));
      setView("workspaces");
      return null;
    }
    const controller = new WorkspaceController(r.value.store, clock);
    await controller.refresh();
    setOpened({ workspace: r.value.workspace, controller });
    setView("page");
    // Archivos sin uso (RF-2.8): en segundo plano, solo al abrir; un fallo nunca estorba (no borra nada si algo falla, DP-9).
    // En escritorio y en la web el almacén llega por `backup.assetsFor`; sin él no hay almacén que limpiar.
    if (backup) {
      const assets = backup.assetsFor(r.value.workspace.location);
      // Primero se limpia y después se leen los PDF que falten para la búsqueda (p. ej. tras restaurar).
      void gcAssets({ store: r.value.store, assets }).then(() => indexPendingPdfs(r.value.store, assets, clock)).catch(() => {});
    }
    return controller;
  }, [workspaces, clock, ensureLock, backup]);

  // Tras eliminar un espacio: si era el abierto, se pasa al predeterminado (o al primero); sin espacios, vuelve la bienvenida.
  const afterWorkspaceDeleted = useCallback(async (deletedId: string) => {
    const list = await workspaces.list();
    const rest = list.ok ? list.value : [];
    if (rest.length === 0) { setOpened(null); setNoWorkspaces(true); setView("workspaces"); return; }
    if (openedRef.current?.workspace.id !== deletedId) return;
    setOpened(null);
    await openWorkspace((rest.find((w) => w.isCaptureDefault) ?? rest[0]!).id);
    setView("workspaces");
  }, [workspaces, openWorkspace]);

  // La ventana de recordatorio pide abrir una tarea: se abre su espacio y su página (RF-11).
  const openedRef = useRef(opened);
  openedRef.current = opened;
  useEffect(() => {
    if (!onOpenTask) return;
    return onOpenTask(({ workspaceId, pageId }) => void (async () => {
      const cur = openedRef.current;
      const c = cur?.workspace.id === workspaceId ? cur.controller : await openWorkspace(workspaceId);
      if (!c) return;
      await c.refresh();
      await c.select(pageId);
      setView("page");
    })());
  }, [onOpenTask, openWorkspace]);

  useEffect(() => {
    void (async () => {
      const list = await workspaces.list();
      if (!list.ok || list.value.length === 0) { setNoWorkspaces(list.ok); return setView("workspaces"); }
      await openWorkspace((list.value.find((w) => w.isCaptureDefault) ?? list.value[0]!).id);
      // Antes de cualquier otra acción: resumen único de vencidos y tareas de hoy de todos los espacios (RF-12)
      if (center) { const s = await center.summary(); if (s.overdue.length + s.today.length > 0) setView("reminders"); }
    })();
  }, [workspaces, openWorkspace, center]);

  useStorageSync(preferences);
  useEffect(() => { applyAppearance(document.documentElement, loadAppearance(preferences)); }, [preferences]);
  useEffect(() => installInputModality(), []); // puntero frente a teclado: decide si se ve el anillo de foco (spec 004, RF-5)
  const [noWorkspaces, setNoWorkspaces] = useState(false);
  const density = useDensity();
  const [workspacesVersion, setWorkspacesVersion] = useState(0);
  const searchCombo = formatCombo(loadBindings(preferences)["palette.open"] ?? null, detectPlatform());
  const sidebar = useMemo(
    () =>
      opened ? (
        <div className="flex h-full flex-col">
          <div className="border-b border-[var(--c-border)] p-2">
            <WorkspaceSwitcher manager={workspaces} active={{ id: opened.workspace.id, name: opened.workspace.name }} onOpen={(id) => void openWorkspace(id)} onManage={() => setView("workspaces")} refreshKey={workspacesVersion} />
          </div>
          <div className="min-h-64 flex-1 overflow-hidden">
            <WorkspaceAssetsContext.Provider value={backup?.assetsFor(opened.workspace.location)}>
            <Sidebar controller={opened.controller} onOpenTrash={() => setView("trash")} onPageOpened={() => setView("page")} onSearch={() => setPaletteOpen(true)} searchCombo={searchCombo} rowHeight={rowHeightFor(density)} />
            </WorkspaceAssetsContext.Provider>
          </div>
          <SidebarLinks
            groups={[
              [
                { id: "capture", label: t("capture.open"), icon: "inbox", onClick: () => setCaptureOpen(true) },
                { id: "graph", label: t("graph.title"), icon: "graph", onClick: () => setView("graph") },
                { id: "review", label: t("study.review.title"), icon: "flashcard", onClick: () => setView("review") },
                { id: "tags", label: t("tags.title"), icon: "tag", onClick: () => setView("tags") },
                ...(backup ? [{ id: "import", label: t("import.title"), icon: "import" as const, onClick: () => setView("import") }] : []),
                ...(center ? [{ id: "reminders", label: t("reminders.title"), icon: "reminder" as const, onClick: () => setView("reminders") }] : []),
                { id: "settings", label: t("app.settings"), icon: "settings", onClick: () => setSettingsOpen(true) },
              ],
              ...(backup ? [[
                { id: "backup", label: t("app.backup"), icon: "backup" as const, onClick: () => setView("backup") },
                { id: "restore", label: t("app.restore"), icon: "restore" as const, onClick: () => { setRestoreSource(backup.createRestoreSource()); setView("restore"); } },
              ]] : []),
            ]}
          />
        </div>
      ) : view === "loading" ? (
        <div />
      ) : (
        <div className="p-2"><button type="button" onClick={() => setView("workspaces")}>{t("workspace.title")}</button></div>
      ),
    [opened, t, view, workspaces, openWorkspace, backup, center, density, searchCombo, workspacesVersion],
  );

  return (
    <GlobalShortcutProvider value={shortcutState}>
    <AppShell sidebar={sidebar} preferences={preferences} header={opened && view === "page" ? <AppHeader controller={opened.controller} now={() => clock.now()} onNavigate={(id) => { void opened.controller.select(id); setView("page"); }} /> : undefined}>
      {updates && <UpdateNotice check={updates.check} onDownload={updates.openDownload} />}
      {error && <InlineAlert tone="error">{error}</InlineAlert>}
      {view === "loading" && <p role="status" className="p-4 opacity-70">{t("app.loading")}</p>}
      {view === "workspaces" && noWorkspaces && !opened && (
        <WelcomeScreen
          onCreate={(name) => void workspaces.create({ name }).then((r) => { if (r.ok) { setNoWorkspaces(false); void openWorkspace(r.value.id); } else setError(r.error.message); })}
          {...(backup ? { onRestore: () => { setRestoreSource(backup.createRestoreSource()); setView("restore"); } } : {})}
        />
      )}
      {view === "workspaces" && !(noWorkspaces && !opened) && (
        <WorkspaceManagerView manager={workspaces} activeId={opened?.workspace.id ?? null} onOpen={(id) => void openWorkspace(id)} onCreated={(w) => void openWorkspace(w.id)} onDeleted={(id) => void afterWorkspaceDeleted(id)} onUpdated={() => setWorkspacesVersion((v) => v + 1)} {...(revealLocation ? { onRevealLocation: revealLocation } : {})} {...(pickFolder ? { pickFolder } : {})} />
      )}
      {view === "workspaces" && !opened && !noWorkspaces && backup && (
        <div className="px-4">
          <button type="button" onClick={() => { setRestoreSource(backup.createRestoreSource()); setView("restore"); }}>{t("app.restore")}</button>
        </div>
      )}
      {view === "locked" && lockedId && (
        <div className="m-4"><InlineAlert tone="warning" action={{ label: t("workspace.retry"), onClick: () => void openWorkspace(lockedId) }}>{t("workspace.lockedElsewhere")}</InlineAlert></div>
      )}
      {view === "reminders" && center && (
        <RemindersView center={center} activeWorkspaceId={opened?.workspace.id ?? null} onOpen={(wsId, pageId) => void (async () => {
          const c = opened?.workspace.id === wsId ? opened.controller : await openWorkspace(wsId);
          if (!c) return;
          await c.refresh();
          await c.select(pageId);
          setView("page");
        })()} />
      )}
      {view === "review" && opened && (
        <ReviewView controller={opened.controller} now={clock.now.bind(clock)} onOpenPage={(id) => void opened.controller.select(id).then(() => setView("page"))} />
      )}
      {view === "import" && opened && backup && (
        <ImportView store={opened.controller.store} assets={backup.assetsFor(opened.workspace.location)} clock={clock}
          onOpen={(id) => void (async () => { await opened.controller.refresh(); await opened.controller.select(id); setView("page"); })()} />
      )}
      {view === "graph" && opened && (
        <GraphView controller={opened.controller} currentPageId={opened.controller.getSnapshot().selectedId}
          onOpen={(id) => void (async () => { await opened.controller.select(id); setView("page"); })()} />
      )}
      <SettingsPanel open={settingsOpen} onOpenChange={setSettingsOpen} preferences={preferences} />
      {view === "trash" && opened && <TrashView controller={opened.controller} />}
      {view === "tags" && opened && <TagsView controller={opened.controller} onOpenPage={(id) => { void opened.controller.select(id); setView("page"); }} />}
      {view === "backup" && opened && backup && (
        <>
          {unified && unifiedBackup && (
            <UnifiedBackupPanel controller={unified} preferences={preferences} keychain={unifiedBackup.keychain} fetch={unifiedBackup.fetch}
              pickFolder={unifiedBackup.pickFolder} oauth={unifiedBackup.oauth} onRestoreAll={() => setView("restoreAll")} />
          )}
          <BackupPanelFor ws={opened.workspace} workspaces={workspaces} serviceFor={serviceFor} platform={backup.platform} />
        </>
      )}
      {view === "restoreAll" && unified && (
        <RestoreAllPanel restore={restoreAll} onDone={() => setView("workspaces")} onCancel={() => setView("backup")} />
      )}
      {view === "restore" && backup && restoreSource && (
        <RestoreWizard
          source={restoreSource}
          workspaces={workspaces}
          assetsFor={backup.assetsFor}
          onDone={(w) => void openWorkspace(w.id)}
          onCancel={() => setView(opened ? "page" : "workspaces")}
        />
      )}
      {opened && (
        <CommandPalette
          controller={opened.controller}
          open={paletteOpen}
          onClose={() => setPaletteOpen(false)}
          onOpenPage={(id) => { void opened.controller.select(id); setView("page"); }}
          actions={paletteActions}
          onCreatePage={(title) => { void opened.controller.createPage(null, title).then(() => setView("page")); }}
        />
      )}
      {captureOpen && (
        <div role="dialog" aria-modal="true" aria-label={t("capture.title")} className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-24">
          <div className="w-[32rem] max-w-full rounded bg-[var(--bg)] shadow">
            <QuickCaptureView manager={workspaces} clock={clock} onClose={() => setCaptureOpen(false)}
              onSaved={(id) => { setCaptureOpen(false); if (opened?.workspace.id === id) void opened.controller.refresh(); }} />
          </div>
        </div>
      )}
      {view === "page" && opened && <PageZoom preferences={preferences}><PageArea controller={opened.controller} workspace={opened.workspace} renderPageBody={renderPageBody} {...(exporter ? { exporter } : {})} /></PageZoom>}
    </AppShell>
    </GlobalShortcutProvider>
  );
}

function BackupPanelFor({ ws, workspaces, serviceFor, platform }: {
  ws: Workspace; workspaces: ReturnType<typeof useServices>["workspaces"];
  serviceFor: (ws: Workspace, store: Parameters<NonNullable<ReturnType<typeof useServices>["backup"]>["createService"]>[1]) => BackupService | null;
  platform: "desktop" | "web";
}) {
  const [service, setService] = useState<BackupService | null>(null);
  useEffect(() => {
    void workspaces.open(ws.id).then((o) => { if (o.ok) setService(serviceFor(o.value.workspace, o.value.store)); });
  }, [ws.id, workspaces, serviceFor]);
  return service ? <BackupPanel service={service} platform={platform} /> : null;
}

function findPage(nodes: readonly PageNode[], id: string): PageNode["page"] | null {
  for (const n of nodes) {
    if (n.page.id === id) return n.page;
    const f = findPage(n.children, id);
    if (f) return f;
  }
  return null;
}

function findKind(nodes: readonly { page: { id: string; kind: string }; children: readonly never[] }[] | readonly PageNode[], id: string): string | null {
  for (const n of nodes as readonly PageNode[]) {
    if (n.page.id === id) return n.page.kind;
    const k = findKind(n.children, id);
    if (k) return k;
  }
  return null;
}

function PageArea({ controller, workspace, renderPageBody, exporter }: { controller: WorkspaceController; workspace: Workspace; renderPageBody: AppProps["renderPageBody"]; exporter?: NonNullable<ReturnType<typeof useServices>["exporter"]> }) {
  const { t } = useTranslation();
  const snap = useWorkspace(controller);
  const { backup, exporter: exporterSvc } = useServices();
  // Los archivos de la portada viven en el almacén del espacio (escritorio y web los aportan por el respaldo o la exportación).
  // Una sola instancia por espacio: si cambiara en cada render, la imagen de la portada se volvería a cargar (parpadeo).
  const assetsRuntime = backup ?? exporterSvc;
  const assets = useMemo(() => assetsRuntime?.assetsFor(workspace.location), [assetsRuntime, workspace.location]);
  const [exporting, setExporting] = useState<string | null>(null);
  // Sin página abierta (espacio nuevo, o tras eliminar la que se veía) se dice qué hacer en vez de dejar el área en blanco.
  if (!snap.selectedId) return (
    <div className="flex min-h-96 items-center justify-center p-8">
      <EmptyState illustration="pages" title={t("page.noneOpen")} hint={t("page.noneOpenHint")} action={{ label: t("page.createFirst"), onClick: () => void controller.createPage(null) }} />
    </div>
  );
  const kind = findKind(snap.tree, snap.selectedId);
  const pageStyle = findPage(snap.tree, snap.selectedId)?.style ?? {};
  const dialog = exporting && exporter ? (
    <ExportDialog key={exporting} controller={controller} pageId={exporting} assets={exporter.assetsFor(workspace.location)} runtime={exporter.runtime} onClose={() => setExporting(null)} />
  ) : null;
  const onExport = exporter ? (id: string) => setExporting(id) : undefined;
  if (kind === "database" || kind === "board") {
    return (
      <PageStyleScope as="article" style={pageStyle} className="mx-auto max-w-6xl p-6">
        <PageHeader controller={controller} pageId={snap.selectedId} assets={assets} workspaceName={workspace.name} {...(onExport ? { onExport } : {})} />
        <DatabasePage key={snap.selectedId} controller={controller} pageId={snap.selectedId} assets={assets} />
        {dialog}
      </PageStyleScope>
    );
  }
  return (
    <PageBody style={pageStyle}>
      <PageHeader controller={controller} pageId={snap.selectedId} assets={assets} workspaceName={workspace.name} {...(onExport ? { onExport } : {})} />
      {renderPageBody?.(snap.selectedId, controller, workspace)}
      {dialog}
    </PageBody>
  );
}
