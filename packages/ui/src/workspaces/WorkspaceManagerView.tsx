import { useCallback, useEffect, useMemo, useState } from "react";
import { InlineAlert } from "../components/InlineAlert";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { Button } from "../components/Button";
import { Chip } from "../components/Chip";
import { IconButton } from "../components/IconButton";
import { ViewLayout, ViewSection, VIEW_ROW } from "../components/ViewLayout";
import { Popover } from "../components/Popover";
import { INPUT, MUTED } from "../components/formStyles";
import { AccentPicker } from "../page/options/AccentPicker";
import { WorkspaceAvatar } from "../shared/WorkspaceAvatar";
import { assignWorkspaceColors } from "../shared/workspaceColors";
import { useTranslation } from "react-i18next";
import { parseCustomAccent, type Workspace, type WorkspaceManager } from "@vnote/core";

type DeleteInfo = { lastBackupAt: number | null; hasNoBackup: boolean; backupUnknown: boolean } | null;

export function WorkspaceManagerView({ manager, activeId, onOpen, onCreated, onDeleted, onUpdated, onRevealLocation, pickFolder }: { manager: WorkspaceManager; activeId: string | null; onOpen: (id: string) => void; onCreated?: (w: Workspace) => void; /** Se eliminó un espacio: quien muestra el espacio abierto decide a dónde ir. */ onDeleted?: (id: string) => void; onUpdated?: () => void; onRevealLocation?: (location: string) => void; /** Solo escritorio: diálogo nativo para elegir la carpeta de datos del espacio nuevo (RF-25). */ pickFolder?: () => Promise<string | null> }) {
  const [folder, setFolder] = useState<string | null>(null);
  const { t, i18n } = useTranslation();
  const [items, setItems] = useState<Workspace[]>([]);
  const [name, setName] = useState("");
  const [renaming, setRenaming] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Workspace | null>(null);
  const [info, setInfo] = useState<DeleteInfo>(null);
  const [typed, setTyped] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const r = await manager.list();
    if (r.ok) setItems(r.value);
  }, [manager]);
  useEffect(() => { void reload(); }, [reload]);
  const colors = useMemo(() => assignWorkspaceColors(items), [items]);

  const create = async () => {
    if (name.trim() === "") return;
    const r = await manager.create({ name, ...(folder ? { location: folder } : {}) });
    if (r.ok) { setError(null); setName(""); setFolder(null); await reload(); onCreated?.(r.value); }
    else setError(r.error.message);
  };
  const startDelete = async (ws: Workspace) => {
    setDeleting(ws); setTyped(""); setInfo(null); setDeleteError(null);
    const r = await manager.prepareDelete(ws.id);
    setInfo(r.ok ? { lastBackupAt: r.value.lastBackupAt, hasNoBackup: r.value.hasNoBackup, backupUnknown: r.value.backupUnknown === true } : { lastBackupAt: null, hasNoBackup: false, backupUnknown: true });
  };
  const confirmDelete = async () => {
    if (!deleting || busy) return;
    setBusy(true); setDeleteError(null);
    const r = await manager.delete(deleting.id, { typedName: typed }).catch(() => null);
    setBusy(false);
    if (r?.ok) { const id = deleting.id; setDeleting(null); await reload(); onDeleted?.(id); }
    else setDeleteError(r && !r.ok ? r.error.message : t("workspace.deleteFailed"));
  };

  return (
    <ViewLayout title={t("workspace.title")} description={t("workspace.hint")}>
      {error && <InlineAlert tone="error">{error}</InlineAlert>}
      <ViewSection flush>
        <ul className="flex flex-col">
          {items.map((w) => (
            <li key={w.id} className={VIEW_ROW}>
              <Popover
                wide
                trigger={(
                  <button
                    type="button"
                    aria-label={t("workspace.colorItem", { name: w.name })}
                    title={t("workspace.colorItem", { name: w.name })}
                    className="inline-flex shrink-0 cursor-pointer rounded-[var(--radius-md)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--c-accent)]"
                  >
                    <WorkspaceAvatar name={w.name} color={colors.get(w.id)} size={28} />
                  </button>
                )}
              >
                <AccentPicker
                  value={w.color}
                  label={t("workspace.colorItem", { name: w.name })}
                  onChange={(c) => {
                    void manager.setColor(w.id, parseCustomAccent(c)).then(async (r) => {
                      if (r.ok) { await reload(); onUpdated?.(); }
                    });
                  }}
                />
              </Popover>
              <div className="flex min-w-0 flex-1 flex-col">
                {renaming === w.id ? (
                  <input
                    autoFocus
                    aria-label={t("workspace.newName", { name: w.name })}
                    defaultValue={w.name}
                    className={INPUT}
                    onKeyDown={async (e) => {
                      if (e.key === "Enter") { await manager.rename(w.id, e.currentTarget.value); setRenaming(null); await reload(); onUpdated?.(); }
                      if (e.key === "Escape") setRenaming(null);
                    }}
                  />
                ) : (
                  <button type="button" aria-label={t("workspace.open", { name: w.name })} aria-current={w.id === activeId ? "true" : undefined} onClick={() => onOpen(w.id)} className="truncate rounded text-left font-medium hover:underline">
                    {w.name}
                  </button>
                )}
                {onRevealLocation && <code className={`truncate ${MUTED}`} title={w.location}>{w.location}</code>}
              </div>
              {w.id === activeId && <Chip tone="info">{t("workspace.current")}</Chip>}
              {w.isCaptureDefault && <Chip>{t("capture.isDefault")}</Chip>}
              <div className="flex shrink-0 items-center">
                {onRevealLocation && <IconButton icon="folder" label={t("workspace.revealItem", { name: w.name })} onClick={() => onRevealLocation(w.location)} />}
                <IconButton icon="inbox" label={t("capture.useWorkspace", { name: w.name })} aria-pressed={w.isCaptureDefault} disabled={w.isCaptureDefault} onClick={() => void manager.setCaptureDefault(w.id).then(reload)} />
                <IconButton icon="edit" label={t("workspace.renameItem", { name: w.name })} onClick={() => setRenaming(w.id)} />
                <IconButton icon="delete" label={t("workspace.deleteItem", { name: w.name })} className="hover:text-[var(--c-danger)]" onClick={() => void startDelete(w)} />
              </div>
            </li>
          ))}
        </ul>
      </ViewSection>

      <ViewSection title={t("workspace.newSection")}>
        <div className="flex flex-wrap items-center gap-2">
          <input aria-label={t("workspace.namePlaceholder")} placeholder={t("workspace.namePlaceholder")} value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void create()} className={`${INPUT} max-w-xs`} />
          {pickFolder && <Button onClick={() => void pickFolder().then((f) => { if (f) setFolder(f); }).catch(() => {})}>{t("workspace.pickFolder")}</Button>}
          <Button variant="primary" onClick={() => void create()}>{t("workspace.create")}</Button>
          {folder && <span className={`w-full truncate ${MUTED}`}>{folder}</span>}
        </div>
      </ViewSection>

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(o) => { if (!o) setDeleting(null); }}
        title={t("workspace.delete")}
        description={info ? (info.backupUnknown ? t("workspace.backupUnknown") : info.hasNoBackup ? t("workspace.noBackup") : t("workspace.lastBackup", { date: new Date(info.lastBackupAt!).toLocaleString(i18n.language) })) : ""}
        confirmLabel={t("workspace.confirmDelete")}
        cancelLabel={t("workspace.cancel")}
        confirmDisabled={typed !== deleting?.name || busy}
        closeOnConfirm={false}
        onConfirm={() => void confirmDelete()}
      >
        <label className="flex flex-col gap-1">
          <span>{t("workspace.typeNameToDelete", { name: deleting?.name ?? "" })}</span>
          <input value={typed} onChange={(e) => setTyped(e.target.value)} className={INPUT} />
        </label>
        {deleteError && <p role="alert" className="text-[length:var(--text-ui-small-size)] text-[var(--c-danger)]">{deleteError}</p>}
      </ConfirmDialog>
    </ViewLayout>
  );
}
