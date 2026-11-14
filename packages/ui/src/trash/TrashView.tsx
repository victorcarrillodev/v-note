import { useState } from "react";
import { EmptyState } from "../empty/EmptyState";
import { useTranslation } from "react-i18next";
import { TRASH_RETENTION_DAYS } from "@vnote/core";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { Button } from "../components/Button";
import { ViewLayout, ViewSection, VIEW_ROW } from "../components/ViewLayout";
import { Icon } from "../design/Icon";
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
    <ViewLayout
      title={t("trash.title")}
      description={t("trash.hint", { days: TRASH_RETENTION_DAYS })}
      actions={snap.trash.length > 0 && <Button variant="danger" onClick={() => setPending({ kind: "all" })}><Icon name="delete" />{t("trash.emptyTrash")}</Button>}
    >
      {snap.trash.length === 0 ? (
        <EmptyState illustration="trash" title={t("trash.empty")} />
      ) : (
        <ViewSection flush>
          <ul className="flex flex-col">
            {snap.trash.map((e) => (
              <li key={e.page.id} className={VIEW_ROW}>
                <span className="shrink-0 text-[var(--c-text-muted)]"><Icon name="note" /></span>
                <span className="min-w-0 flex-1 truncate font-medium">{label(e.page.title)}</span>
                <span className="shrink-0 text-[length:var(--text-ui-small-size)] text-[var(--c-text-muted)]">{t("trash.daysLeft", { count: e.daysLeft })}</span>
                <Button size="sm" aria-label={t("trash.restoreItem", { title: label(e.page.title) })} onClick={() => void controller.restore(e.page.id)}><Icon name="restore" />{t("trash.restore")}</Button>
                <Button size="sm" variant="danger" aria-label={t("trash.deleteForeverItem", { title: label(e.page.title) })} onClick={() => setPending({ kind: "one", id: e.page.id, title: label(e.page.title) })}>{t("trash.deleteForever")}</Button>
              </li>
            ))}
          </ul>
        </ViewSection>
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
    </ViewLayout>
  );
}
