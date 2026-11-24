import { useTranslation } from "react-i18next";
import { EmptyState } from "../empty/EmptyState";
import { PageTree } from "../tree/PageTree";
import type { WorkspaceController } from "../workspace/controller";
import { useWorkspace } from "../workspace/useController";
import { Icon } from "../design/Icon";
import { Button } from "../components/Button";
import { InlineAlert } from "../components/InlineAlert";
import { useShell } from "../layout/AppShell";
import { useUndoToast } from "../feedback/useUndoToast";

export function Sidebar({ controller, onOpenTrash, onPageOpened, onSearch, searchCombo, height = 480, rowHeight }: {
  controller: WorkspaceController;
  onOpenTrash: () => void;
  onPageOpened?: (id: string) => void;
  /** Abre la paleta (el campo «Buscar» de la barra lateral). */
  onSearch?: () => void;
  /** Atajo de la paleta, ya formateado para la plataforma, para mostrarlo junto a «Buscar». */
  searchCombo?: string;
  height?: number;
  rowHeight?: number;
}) {
  const { t } = useTranslation();
  const announce = useUndoToast();
  const snap = useWorkspace(controller);
  const { closeOverlay } = useShell();

  const open = (id: string) => { void controller.select(id).then(() => { onPageOpened?.(id); closeOverlay(); }); };
  const create = async (parentId: string | null) => {
    const r = await controller.createPage(parentId);
    if (r.ok) { onPageOpened?.(r.value.id); closeOverlay(); }
  };

  return (
    <nav aria-label={t("sidebar.pages")} className="flex h-full flex-col gap-2 p-2">
      {onSearch && (
        <button type="button" onClick={onSearch} className="flex h-8 items-center gap-2 rounded bg-[var(--c-raised)] px-2 text-left text-[length:var(--text-ui-small-size)] text-[var(--c-text-muted)] hover:bg-[var(--c-raised)]">
          <Icon name="search" />
          <span className="flex-1">{t("app.search")}</span>
          {searchCombo && <kbd className="rounded-sm bg-[var(--c-raised)] px-1 font-mono text-[length:var(--text-note-size)] text-[var(--c-text-muted)]">{searchCombo}</kbd>}
        </button>
      )}
      <div className="flex flex-wrap gap-1">
        <Button size="sm" variant="ghost" onClick={() => void create(null)}><Icon name="create" />{t("sidebar.newPage")}</Button>
        <Button size="sm" variant="ghost" onClick={() => void controller.createDatabase(null).then((r) => { if (r.ok) { onPageOpened?.(r.value.id); closeOverlay(); } })}><Icon name="database" />{t("sidebar.newDatabase")}</Button>
        <Button size="sm" variant="ghost" onClick={() => void controller.createDatabase(null, "board").then((r) => { if (r.ok) { onPageOpened?.(r.value.id); closeOverlay(); } })}><Icon name="board" />{t("sidebar.newBoard")}</Button>
        <Button size="sm" variant="ghost" disabled={!snap.selectedId} onClick={() => void create(snap.selectedId)}><Icon name="create" />{t("sidebar.newSubpage")}</Button>
      </div>

      {snap.notice === "MOVE_TO_DESCENDANT" && (
        <InlineAlert tone="warning" onDismiss={controller.dismissNotice} dismissLabel={t("sidebar.closeNotice")}>{t("page.moveToDescendant")}</InlineAlert>
      )}

      {snap.favorites.length > 0 && (
        <section role="region" aria-label={t("app.favorites")}>
          <h2 className="flex items-center gap-1 px-1 text-[length:var(--text-label-size)] font-semibold uppercase text-[var(--c-text-muted)]"><Icon name="favorite" size={14} />{t("app.favorites")}</h2>
          <ul>
            {snap.favorites.map((p) => (
              <li key={p.id}>
                <button type="button" onClick={() => open(p.id)} title={p.title} className="flex h-8 w-full items-center truncate rounded px-2 text-left text-[length:var(--text-ui-small-size)] hover:bg-[var(--c-raised)]">
                  {p.title.trim() === "" ? t("app.untitled") : p.title}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="min-h-0 flex-1 overflow-hidden">
        {snap.tree.length === 0 ? (
          <EmptyState illustration="pages" title={t("sidebar.empty")} />
        ) : (
          <PageTree nodes={snap.tree} expanded={snap.expanded} selectedId={snap.selectedId} onSelect={open} onToggle={controller.toggleExpanded} onCreateChild={(id) => void create(id)} onMove={(id, tg) => void controller.movePageUndoable(id, tg.parentId, tg.afterId === undefined ? {} : { afterId: tg.afterId }).then((r) => { if (r.ok) announce("move-page", t("toast.moved"), r.value.undo); })} height={height} {...(rowHeight ? { rowHeight } : {})} />
        )}
      </div>

      <button type="button" onClick={onOpenTrash} className="flex h-8 items-center gap-2 rounded px-2 text-left text-[length:var(--text-ui-small-size)] text-[var(--c-text-muted)] hover:bg-[var(--c-raised)] hover:text-[var(--c-text)]"><Icon name="delete" />{t("app.trash")}</button>
    </nav>
  );
}
