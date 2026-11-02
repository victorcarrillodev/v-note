import { UpdateNotice } from "./UpdateNotice";
import { ImportView } from "../import/ImportView";
import { GlobalShortcutProvider, useGlobalShortcut } from "../capture/globalShortcut";
import { QuickCaptureView } from "../capture/QuickCaptureView";
import { GraphView } from "../graph/GraphView";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { PageNode } from "@vnote/core";
import type { BackupService, InstanceLockHandle, RestoreSource, Workspace } from "@vnote/core";
import { AppServicesProvider, useServices, type AppServices } from "./services";
import { AppShell } from "../layout/AppShell";
import { ThemeProvider, useTheme, type PreferenceStore } from "../theme/theme";
import { CommandPalette, type PaletteAction } from "../palette/CommandPalette";
import { DatabasePage } from "../databases/DatabasePage";
import { ReminderCenter } from "../reminders/reminderCenter";
import { RemindersView } from "../reminders/RemindersView";
import { SettingsView } from "../settings/SettingsView";
import { loadBindings } from "../settings/bindingsStore";
import { comboFromEvent } from "@vnote/core";
import { Sidebar } from "../sidebar/Sidebar";
import { PageHeader } from "../page/PageHeader";
import { ExportDialog } from "../page/ExportDialog";
import { TrashView } from "../trash/TrashView";
import { WorkspaceManagerView } from "../workspaces/WorkspaceManagerView";
import { WorkspaceController } from "../workspace/controller";
import { BackupPanel } from "../backup/BackupPanel";
import { RestoreWizard } from "../restore/RestoreWizard";
import { useWorkspace } from "../workspace/useController";

type View = "loading" | "page" | "trash" | "workspaces" | "backup" | "restore" | "settings" | "locked" | "reminders" | "graph" | "import";
type Opened = { workspace: Workspace; controller: WorkspaceController };

export type AppProps = {
  services: AppServices;
  preferences: PreferenceStore;
  /** El cascarón inyecta aquí el cuerpo de la página (el editor de bloques). */
  renderPageBody?: (pageId: string, controller: WorkspaceController, workspace: Workspace) => ReactNode;
};

export function App({ services, preferences, renderPageBody }: AppProps) {
  return (
    <ThemeProvider preferences={preferences}>
      <AppServicesProvider services={services}>
        <Main renderPageBody={renderPageBody} preferences={preferences} />
      </AppServicesProvider>
    </ThemeProvider>
  );
}

function Main({ renderPageBody, preferences }: { renderPageBody: AppProps["renderPageBody"]; preferences: PreferenceStore }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { workspaces, clock, backup, updates, exporter, pickFolder, onOpenTask, revealLocation, instanceLock, reminders, globalShortcut, onCaptured } = useServices();
  const [view, setView] = useState<View>("loading");
  const [opened, setOpened] = useState<Opened | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [captureOpen, setCaptureOpen] = useState(false);
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

  const paletteActions: PaletteAction[] = [
    { id: "page.new", label: t("shortcuts.pageNew"), run: () => actions.current["page.new"]?.() },
    { id: "theme.toggle", label: t("shortcuts.themeToggle"), run: () => actions.current["theme.toggle"]?.() },
    { id: "capture.open", label: t("shortcuts.captureOpen"), run: () => setCaptureOpen(true) },
    { id: "settings.open", label: t("settings.title"), run: () => setView("settings") },
  ];

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
    return controller;
  }, [workspaces, clock, ensureLock]);

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
      if (!list.ok || list.value.length === 0) return setView("workspaces");
      await openWorkspace((list.value.find((w) => w.isCaptureDefault) ?? list.value[0]!).id);
      // Antes de cualquier otra acción: resumen único de vencidos y tareas de hoy de todos los espacios (RF-12)
      if (center) { const s = await center.summary(); if (s.overdue.length + s.today.length > 0) setView("reminders"); }
    })();
  }, [workspaces, openWorkspace, center]);

  const sidebar = useMemo(
    () =>
      opened ? (
        <div className="flex h-full flex-col">
          <div className="border-b p-2">
            <p role="status" className="truncate text-sm font-semibold">{opened.workspace.name}</p>
            <button type="button" onClick={() => setView("workspaces")} className="text-sm underline">{t("workspace.title")}</button>
          </div>
          <div className="min-h-0 flex-1">
            <Sidebar controller={opened.controller} onOpenTrash={() => setView("trash")} onPageOpened={() => setView("page")} />
          </div>
          <div className="flex flex-col border-t p-2 text-sm">
            <button type="button" className="text-left" onClick={() => setCaptureOpen(true)}>{t("capture.open")}</button>
            <button type="button" className="text-left" onClick={() => setView("graph")}>{t("graph.title")}</button>
            {backup && <button type="button" className="text-left" onClick={() => setView("import")}>{t("import.title")}</button>}
            {center && <button type="button" className="text-left" onClick={() => setView("reminders")}>{t("reminders.title")}</button>}
            <button type="button" className="text-left" onClick={() => setView("settings")}>{t("app.settings")}</button>
          </div>
          {backup && (
            <div className="flex flex-col border-t p-2 text-sm">
              <button type="button" className="text-left" onClick={() => setView("backup")}>{t("app.backup")}</button>
              <button type="button" className="text-left" onClick={() => { setRestoreSource(backup.createRestoreSource()); setView("restore"); }}>{t("app.restore")}</button>
            </div>
          )}
        </div>
      ) : view === "loading" ? (
        <div />
      ) : (
        <div className="p-2"><button type="button" onClick={() => setView("workspaces")}>{t("workspace.title")}</button></div>
      ),
    [opened, t, view],
  );

  return (
    <GlobalShortcutProvider value={shortcutState}>
    <AppShell sidebar={sidebar}>
      {updates && <UpdateNotice check={updates.check} onDownload={updates.openDownload} />}
      {error && <p role="alert" className="m-4 rounded border border-red-500 bg-red-50 p-2 text-red-900">{error}</p>}
      {view === "loading" && <p role="status" className="p-4 opacity-70">{t("app.loading")}</p>}
      {view === "workspaces" && (
        <WorkspaceManagerView manager={workspaces} activeId={opened?.workspace.id ?? null} onOpen={(id) => void openWorkspace(id)} onCreated={(w) => void openWorkspace(w.id)} {...(revealLocation ? { onRevealLocation: revealLocation } : {})} {...(pickFolder ? { pickFolder } : {})} />
      )}
      {view === "workspaces" && !opened && backup && (
        <div className="px-4">
          <button type="button" onClick={() => { setRestoreSource(backup.createRestoreSource()); setView("restore"); }}>{t("app.restore")}</button>
        </div>
      )}
      {view === "locked" && lockedId && (
        <div role="alert" className="m-4 flex flex-col gap-2 rounded border border-amber-500 bg-amber-50 p-3 text-amber-900">
          <p>{t("workspace.lockedElsewhere")}</p>
          <button type="button" className="self-start" onClick={() => void openWorkspace(lockedId)}>{t("workspace.retry")}</button>
        </div>
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
      {view === "import" && opened && backup && (
        <ImportView store={opened.controller.store} assets={backup.assetsFor(opened.workspace.location)} clock={clock}
          onOpen={(id) => void (async () => { await opened.controller.refresh(); await opened.controller.select(id); setView("page"); })()} />
      )}
      {view === "graph" && opened && (
        <GraphView controller={opened.controller} currentPageId={opened.controller.getSnapshot().selectedId}
          onOpen={(id) => void (async () => { await opened.controller.select(id); setView("page"); })()} />
      )}
      {view === "settings" && <SettingsView preferences={preferences} />}
      {view === "trash" && opened && <TrashView controller={opened.controller} />}
      {view === "backup" && opened && backup && (
        <BackupPanelFor ws={opened.workspace} workspaces={workspaces} serviceFor={serviceFor} platform={backup.platform} />
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
      {view === "page" && opened && <PageArea controller={opened.controller} workspace={opened.workspace} renderPageBody={renderPageBody} {...(exporter ? { exporter } : {})} />}
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

function findKind(nodes: readonly { page: { id: string; kind: string }; children: readonly never[] }[] | readonly PageNode[], id: string): string | null {
  for (const n of nodes as readonly PageNode[]) {
    if (n.page.id === id) return n.page.kind;
    const k = findKind(n.children, id);
    if (k) return k;
  }
  return null;
}

function PageArea({ controller, workspace, renderPageBody, exporter }: { controller: WorkspaceController; workspace: Workspace; renderPageBody: AppProps["renderPageBody"]; exporter?: NonNullable<ReturnType<typeof useServices>["exporter"]> }) {
  const snap = useWorkspace(controller);
  const [exporting, setExporting] = useState<string | null>(null);
  if (!snap.selectedId) return <div className="p-8" />;
  const kind = findKind(snap.tree, snap.selectedId);
  const dialog = exporting && exporter ? (
    <ExportDialog key={exporting} controller={controller} pageId={exporting} assets={exporter.assetsFor(workspace.location)} runtime={exporter.runtime} onClose={() => setExporting(null)} />
  ) : null;
  const onExport = exporter ? (id: string) => setExporting(id) : undefined;
  if (kind === "database" || kind === "board") {
    return (
      <article className="mx-auto max-w-6xl p-6">
        <PageHeader controller={controller} pageId={snap.selectedId} {...(onExport ? { onExport } : {})} />
        <DatabasePage key={snap.selectedId} controller={controller} pageId={snap.selectedId} />
        {dialog}
      </article>
    );
  }
  return (
    <article className="mx-auto max-w-3xl p-6">
      <PageHeader controller={controller} pageId={snap.selectedId} {...(onExport ? { onExport } : {})} />
      {renderPageBody?.(snap.selectedId, controller, workspace)}
      {dialog}
    </article>
  );
}
