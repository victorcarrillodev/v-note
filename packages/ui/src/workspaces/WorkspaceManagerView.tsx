import { useCallback, useEffect, useState } from "react";
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { useTranslation } from "react-i18next";
import type { Workspace, WorkspaceManager } from "@vnote/core";

type DeleteInfo = { lastBackupAt: number | null; hasNoBackup: boolean } | null;

export function WorkspaceManagerView({ manager, activeId, onOpen, onCreated, onRevealLocation, pickFolder }: { manager: WorkspaceManager; activeId: string | null; onOpen: (id: string) => void; onCreated?: (w: Workspace) => void; onRevealLocation?: (location: string) => void; /** Solo escritorio: diálogo nativo para elegir la carpeta de datos del espacio nuevo (RF-25). */ pickFolder?: () => Promise<string | null> }) {
  const [folder, setFolder] = useState<string | null>(null);
  const { t, i18n } = useTranslation();
  const [items, setItems] = useState<Workspace[]>([]);
  const [name, setName] = useState("");
  const [renaming, setRenaming] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Workspace | null>(null);
  const [info, setInfo] = useState<DeleteInfo>(null);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const r = await manager.list();
    if (r.ok) setItems(r.value);
  }, [manager]);
  useEffect(() => { void reload(); }, [reload]);

  const create = async () => {
    if (name.trim() === "") return;
    const r = await manager.create({ name, ...(folder ? { location: folder } : {}) });
    if (r.ok) { setError(null); setName(""); setFolder(null); await reload(); onCreated?.(r.value); }
    else setError(r.error.message);
  };
  const startDelete = async (ws: Workspace) => {
    setDeleting(ws); setTyped(""); setInfo(null);
    const r = await manager.prepareDelete(ws.id);
    if (r.ok) setInfo({ lastBackupAt: r.value.lastBackupAt, hasNoBackup: r.value.hasNoBackup });
  };
  const confirmDelete = async () => {
    if (!deleting) return;
    const r = await manager.delete(deleting.id, { typedName: typed });
    if (r.ok) { setDeleting(null); await reload(); }
  };

  return (
    <section aria-label={t("workspace.title")} className="flex flex-col gap-3 p-4">
      <h1 className="text-xl font-semibold">{t("workspace.title")}</h1>
      {error && <p role="alert" className="rounded border border-red-500 bg-red-50 p-2 text-sm text-red-900">{error}</p>}
      <ul className="flex flex-col gap-1">
        {items.map((w) => (
          <li key={w.id} className="flex items-center gap-2">
            {renaming === w.id ? (
              <input
                autoFocus
                aria-label={t("workspace.newName", { name: w.name })}
                defaultValue={w.name}
                className="rounded border px-1"
                onKeyDown={async (e) => {
                  if (e.key === "Enter") { await manager.rename(w.id, e.currentTarget.value); setRenaming(null); await reload(); }
                  if (e.key === "Escape") setRenaming(null);
                }}
              />
            ) : (
              <button type="button" aria-label={t("workspace.open", { name: w.name })} aria-current={w.id === activeId ? "true" : undefined} onClick={() => onOpen(w.id)} className="flex-1 text-left">
                {w.name}
              </button>
            )}
            {onRevealLocation && (
              <>
                <code className="max-w-[18rem] truncate text-xs opacity-70" title={w.location}>{w.location}</code>
                <button type="button" aria-label={t("workspace.revealItem", { name: w.name })} onClick={() => onRevealLocation(w.location)}>{t("workspace.reveal")}</button>
              </>
            )}
            {w.isCaptureDefault && <span className="text-xs opacity-80">{t("capture.isDefault")}</span>}
            <button type="button" aria-label={t("capture.useWorkspace", { name: w.name })} aria-pressed={w.isCaptureDefault} disabled={w.isCaptureDefault} onClick={() => void manager.setCaptureDefault(w.id).then(reload)}>{t("capture.makeDefault")}</button>
            <button type="button" aria-label={t("workspace.renameItem", { name: w.name })} onClick={() => setRenaming(w.id)}>{t("workspace.rename")}</button>
            <button type="button" aria-label={t("workspace.deleteItem", { name: w.name })} onClick={() => void startDelete(w)}>{t("workspace.delete")}</button>
          </li>
        ))}
      </ul>

      <div className="flex gap-2">
        <input aria-label={t("workspace.namePlaceholder")} placeholder={t("workspace.namePlaceholder")} value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void create()} className="rounded border px-2 py-1" />
        {pickFolder && <button type="button" onClick={() => void pickFolder().then((f) => { if (f) setFolder(f); }).catch(() => {})}>{t("workspace.pickFolder")}</button>}
        {folder && <span className="text-sm opacity-80">{folder}</span>}
        <button type="button" onClick={() => void create()}>{t("workspace.create")}</button>
      </div>

      <AlertDialog.Root open={deleting !== null} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="fixed inset-0 bg-black/40" />
          <AlertDialog.Content className="fixed left-1/2 top-1/2 w-[28rem] -translate-x-1/2 -translate-y-1/2 rounded bg-[var(--bg)] p-4 shadow">
            <AlertDialog.Title className="font-semibold">{t("workspace.delete")}</AlertDialog.Title>
            <AlertDialog.Description asChild>
              <div className="my-2 flex flex-col gap-2 text-sm">
                {info && (info.hasNoBackup ? (
                  <p role="status" className="font-semibold text-red-700">{t("workspace.noBackup")}</p>
                ) : (
                  <p>{t("workspace.lastBackup", { date: new Date(info.lastBackupAt!).toLocaleString(i18n.language) })}</p>
                ))}
                <label className="flex flex-col gap-1">
                  <span>{t("workspace.typeNameToDelete", { name: deleting?.name ?? "" })}</span>
                  <input value={typed} onChange={(e) => setTyped(e.target.value)} className="rounded border px-2 py-1" />
                </label>
              </div>
            </AlertDialog.Description>
            <div className="flex justify-end gap-2">
              <AlertDialog.Cancel asChild><button type="button">{t("workspace.cancel")}</button></AlertDialog.Cancel>
              <button type="button" disabled={typed !== deleting?.name} onClick={() => void confirmDelete()}>{t("workspace.confirmDelete")}</button>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </section>
  );
}
