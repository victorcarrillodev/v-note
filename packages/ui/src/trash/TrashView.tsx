import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { useTranslation } from "react-i18next";
import type { WorkspaceController } from "../workspace/controller";
import { useWorkspace } from "../workspace/useController";

function Confirm({ trigger, onConfirm }: { trigger: React.ReactNode; onConfirm: () => void }) {
  const { t } = useTranslation();
  return (
    <AlertDialog.Root>
      <AlertDialog.Trigger asChild>{trigger}</AlertDialog.Trigger>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 bg-black/40" />
        <AlertDialog.Content className="fixed left-1/2 top-1/2 w-96 -translate-x-1/2 -translate-y-1/2 rounded bg-[var(--bg)] p-4 shadow">
          <AlertDialog.Title className="font-semibold">{t("trash.confirmTitle")}</AlertDialog.Title>
          <AlertDialog.Description className="my-2 text-sm">{t("trash.confirmBody")}</AlertDialog.Description>
          <div className="flex justify-end gap-2">
            <AlertDialog.Cancel asChild><button type="button">{t("trash.cancel")}</button></AlertDialog.Cancel>
            <AlertDialog.Action asChild><button type="button" onClick={onConfirm}>{t("trash.confirm")}</button></AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}

export function TrashView({ controller }: { controller: WorkspaceController }) {
  const { t } = useTranslation();
  const snap = useWorkspace(controller);
  const label = (title: string) => (title.trim() === "" ? t("app.untitled") : title);
  return (
    <section aria-label={t("trash.title")} className="p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{t("trash.title")}</h1>
        {snap.trash.length > 0 && <Confirm trigger={<button type="button">{t("trash.emptyTrash")}</button>} onConfirm={() => void controller.emptyTrash(true)} />}
      </div>
      {snap.trash.length === 0 ? (
        <p className="mt-4 opacity-70">{t("trash.empty")}</p>
      ) : (
        <ul className="mt-4 flex flex-col gap-1">
          {snap.trash.map((e) => (
            <li key={e.page.id} className="flex items-center gap-3">
              <span className="flex-1 truncate">{label(e.page.title)}</span>
              <span className="text-sm opacity-70">{t("trash.daysLeft", { count: e.daysLeft })}</span>
              <button type="button" aria-label={t("trash.restoreItem", { title: label(e.page.title) })} onClick={() => void controller.restore(e.page.id)}>{t("trash.restore")}</button>
              <Confirm
                trigger={<button type="button" aria-label={t("trash.deleteForeverItem", { title: label(e.page.title) })}>{t("trash.deleteForever")}</button>}
                onConfirm={() => void controller.deleteForever(e.page.id, true)}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
