import { useTranslation } from "react-i18next";
import { PageTree } from "../tree/PageTree";
import type { WorkspaceController } from "../workspace/controller";
import { useWorkspace } from "../workspace/useController";

export function Sidebar({ controller, onOpenTrash, onPageOpened, height = 480 }: {
  controller: WorkspaceController;
  onOpenTrash: () => void;
  onPageOpened?: (id: string) => void;
  height?: number;
}) {
  const { t } = useTranslation();
  const snap = useWorkspace(controller);

  const open = (id: string) => { void controller.select(id).then(() => onPageOpened?.(id)); };
  const create = async (parentId: string | null) => {
    const r = await controller.createPage(parentId);
    if (r.ok) onPageOpened?.(r.value.id);
  };

  return (
    <nav aria-label={t("sidebar.pages")} className="flex h-full flex-col gap-2 p-2">
      <div className="flex gap-2">
        <button type="button" onClick={() => void create(null)} className="rounded border px-2 py-1">{t("sidebar.newPage")}</button>
        <button type="button" onClick={() => void controller.createDatabase(null).then((r) => { if (r.ok) onPageOpened?.(r.value.id); })} className="rounded border px-2 py-1">{t("sidebar.newDatabase")}</button>
        <button type="button" onClick={() => void controller.createDatabase(null, "board").then((r) => { if (r.ok) onPageOpened?.(r.value.id); })} className="rounded border px-2 py-1">{t("sidebar.newBoard")}</button>
        <button type="button" disabled={!snap.selectedId} onClick={() => void create(snap.selectedId)} className="rounded border px-2 py-1 disabled:opacity-50">
          {t("sidebar.newSubpage")}
        </button>
      </div>

      {snap.notice === "MOVE_TO_DESCENDANT" && (
        <div role="alert" className="flex items-start justify-between rounded border border-amber-500 bg-amber-50 p-2 text-sm text-amber-900">
          <span>{t("page.moveToDescendant")}</span>
          <button type="button" onClick={controller.dismissNotice} aria-label={t("sidebar.closeNotice")}>×</button>
        </div>
      )}

      {snap.favorites.length > 0 && (
        <section role="region" aria-label={t("app.favorites")}>
          <h2 className="px-1 text-xs uppercase opacity-70">{t("app.favorites")}</h2>
          <ul>
            {snap.favorites.map((p) => (
              <li key={p.id}>
                <button type="button" onClick={() => open(p.id)} className="w-full truncate rounded px-2 py-1 text-left hover:bg-[var(--hover)]">
                  {p.title.trim() === "" ? t("app.untitled") : p.title}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="min-h-0 flex-1">
        {snap.tree.length === 0 ? (
          <p className="p-2 text-sm opacity-70">{t("sidebar.empty")}</p>
        ) : (
          <PageTree nodes={snap.tree} expanded={snap.expanded} selectedId={snap.selectedId} onSelect={open} onToggle={controller.toggleExpanded} onMove={(id, t) => void controller.movePage(id, t.parentId, t.afterId === undefined ? {} : { afterId: t.afterId })} height={height} />
        )}
      </div>

      <button type="button" onClick={onOpenTrash} className="rounded px-2 py-1 text-left hover:bg-[var(--hover)]">{t("app.trash")}</button>
    </nav>
  );
}
