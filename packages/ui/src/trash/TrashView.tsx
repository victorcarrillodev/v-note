import { useState } from "react";
import { EmptyState } from "../empty/EmptyState";
import { useTranslation } from "react-i18next";
import { ConfirmDialog } from "../components/ConfirmDialog";
import type { WorkspaceController } from "../workspace/controller";
import { useWorkspace } from "../workspace/useController";

type Pending = { kind: "one"; id: string; title: string } | { kind: "all" };

export function TrashView({ controller }: { controller: WorkspaceController }) {
  const { t } = useTranslation();
  const snap = useWorkspace(controller);
  const [pending, setPending] = useState<Pending | null>(null);
  const label = (title: string) => (title.trim() === "" ? t("app.untitled") : title);
  const confirm = () => {
    if (!pending) return;
    if (pending.kind === "all") void controller.emptyTrash(true);
    else void controller.deleteForever(pending.id, true);
  };
  return (
    <section aria-label={t("trash.title")} className="p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{t("trash.title")}</h1>
        {snap.trash.length > 0 && <button type="button" onClick={() => setPending({ kind: "all" })}>{t("trash.emptyTrash")}</button>}
      </div>
      {snap.trash.length === 0 ? (
        <EmptyState illustration="trash" title={t("trash.empty")} />
      ) : (
        <ul className="mt-4 flex flex-col gap-1">
          {snap.trash.map((e) => (
            <li key={e.page.id} className="flex items-center gap-3">
              <span className="flex-1 truncate">{label(e.page.title)}</span>
              <span className="text-sm opacity-70">{t("trash.daysLeft", { count: e.daysLeft })}</span>
              <button type="button" aria-label={t("trash.restoreItem", { title: label(e.page.title) })} onClick={() => void controller.restore(e.page.id)}>{t("trash.restore")}</button>
              <button type="button" aria-label={t("trash.deleteForeverItem", { title: label(e.page.title) })} onClick={() => setPending({ kind: "one", id: e.page.id, title: label(e.page.title) })}>{t("trash.deleteForever")}</button>
            </li>
          ))}
        </ul>
      )}
      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(o) => { if (!o) setPending(null); }}
        title={t("trash.confirmTitle")}
        description={pending?.kind === "one" ? t("trash.confirmBodyOne", { title: pending.title }) : t("trash.confirmBodyAll", { count: snap.trash.length })}
        confirmLabel={t("trash.confirm")}
        cancelLabel={t("trash.cancel")}
        onConfirm={confirm}
      />
    </section>
  );
}
