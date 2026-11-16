import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { useTranslation } from "react-i18next";
import { applyStylePatch, type Page, type PageNode } from "@vnote/core";
import type { WorkspaceController } from "../workspace/controller";
import { useUndoToast } from "../feedback/useUndoToast";
import { PageTags } from "../tags/PageTags";
import { Switch } from "../components/controls";
import { coverBackground, randomCover } from "./cover";
import { useWorkspace } from "../workspace/useController";
import { Icon } from "../design/Icon";
import { cx } from "../design/cx";

/** Acciones de la página: discretas (texto atenuado) hasta pasar el puntero, como en un editor de notas. */
const ACTION = "inline-flex h-7 items-center gap-1.5 rounded-[var(--radius-md)] px-2 text-[length:var(--text-ui-small-size)] text-[var(--c-text-muted)] transition-colors duration-100 hover:bg-[var(--c-raised)] hover:text-[var(--c-text)] [@media(pointer:coarse)]:h-11";
const MENU_ITEM = "rounded-[var(--radius-base)] px-2 py-1 text-left text-[length:var(--text-ui-small-size)] text-[var(--c-text)] hover:bg-[var(--c-raised)] [@media(pointer:coarse)]:py-3";


/** Busca una página en el árbol y devuelve su ruta de ancestros (iterativo). */
function locate(tree: readonly PageNode[], id: string): { page: Page; ancestors: Page[] } | null {
  const stack: { node: PageNode; ancestors: Page[] }[] = tree.map((node) => ({ node, ancestors: [] }));
  while (stack.length) {
    const { node, ancestors } = stack.pop()!;
    if (node.page.id === id) return { page: node.page, ancestors };
    for (const c of node.children) stack.push({ node: c, ancestors: [...ancestors, node.page] });
  }
  return null;
}

export function PageHeader({ controller, pageId, onExport }: { controller: WorkspaceController; pageId: string; onNavigate?: (id: string) => void; onExport?: (id: string) => void }) {
  const { t } = useTranslation();
  const snap = useWorkspace(controller);
  const announce = useUndoToast();
  const trash = (id: string) => void controller.trashPageUndoable(id).then((r) => { if (r.ok) announce("trash", t("toast.trashed"), r.value.undo); });
  const duplicate = (id: string, withChildren: boolean) => void controller.duplicateUndoable(id, { withChildren }).then((r) => { if (r.ok) announce("duplicate", t("toast.duplicated"), r.value.undo); });
  const found = locate(snap.tree, pageId);
  const title = found?.page.title ?? "";
  const [draft, setDraft] = useState(title);
  const [editingIcon, setEditingIcon] = useState(false);
  const [dupOpen, setDupOpen] = useState(false);
  const [warn, setWarn] = useState<{ id: string; name: string }[] | null>(null);
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const untitledOnOpen = found !== null && found.page.title === "";
  useEffect(() => setDraft(title), [title, pageId]);
  // Una página nueva (sin título) recibe el foco para escribir de inmediato.
  useEffect(() => { if (untitledOnOpen) titleRef.current?.focus(); }, [pageId]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!found) return null;
  const { page } = found;

  const commitTitle = () => { if (draft !== page.title) void controller.renamePage(page.id, draft); };
  const onTitleKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter") { e.preventDefault(); commitTitle(); }
    if (e.key === "Escape") { setDraft(page.title); }
  };

  return (
    <div className="flex flex-col gap-2">
      {page.cover && (
        <div data-testid="cover" className="h-32 w-full" style={{ background: coverBackground(page.cover) }} />
      )}

      <div className="flex items-center gap-2">
        {page.icon && <span aria-hidden="true" className="text-3xl">{page.icon}</span>}
        <textarea
          ref={titleRef}
          rows={1}
          aria-label={t("page.titleLabel")}
          placeholder={t("page.titlePlaceholder")}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitTitle}
          onKeyDown={onTitleKey}
          onInput={(e) => { e.currentTarget.style.height = "auto"; e.currentTarget.style.height = `${e.currentTarget.scrollHeight}px`; }}
          className="min-w-0 flex-1 resize-none overflow-hidden break-words bg-transparent text-[length:var(--text-page-title-size)] font-bold leading-tight outline-none placeholder:text-[var(--c-text-muted)]"
        />
      </div>

      <PageTags controller={controller} pageId={page.id} />

      <div className="-ml-2 flex flex-wrap items-center gap-0.5 text-sm">
        {page.icon ? (
          <button type="button" className={ACTION} onClick={() => void controller.setIcon(page.id, null)}><Icon name="emoji" size={14} />{t("page.removeIcon")}</button>
        ) : editingIcon ? (
          <input
            aria-label={t("page.iconLabel")}
            autoFocus
            maxLength={8}
            className="ml-2 h-7 w-16 rounded-[var(--radius-md)] border border-[var(--c-border-control)] bg-[var(--c-card)] px-1.5 text-[length:var(--text-ui-small-size)]"
            onKeyDown={(e) => {
              if (e.key === "Enter" && e.currentTarget.value.trim()) { void controller.setIcon(page.id, e.currentTarget.value.trim()); setEditingIcon(false); }
              if (e.key === "Escape") setEditingIcon(false);
            }}
          />
        ) : (
          <button type="button" className={ACTION} onClick={() => setEditingIcon(true)}><Icon name="emoji" size={14} />{t("page.addIcon")}</button>
        )}

        {page.cover ? (
          <button type="button" className={ACTION} onClick={() => void controller.setCover(page.id, null)}><Icon name="image" size={14} />{t("page.removeCover")}</button>
        ) : (
          <button type="button" className={ACTION} onClick={() => void controller.setCover(page.id, randomCover())}><Icon name="image" size={14} />{t("page.addCover")}</button>
        )}

        <button type="button" className={cx(ACTION, page.favorite && "text-[var(--c-text)]")} aria-pressed={page.favorite} onClick={() => void controller.toggleFavorite(page.id)}>
          <Icon name="favorite" size={14} />{page.favorite ? t("page.unfavorite") : t("page.favorite")}
        </button>

        <div className="relative">
          <button type="button" className={ACTION} aria-haspopup="menu" aria-expanded={dupOpen} onClick={() => setDupOpen((o) => !o)}><Icon name="duplicate" size={14} />{t("page.duplicate")}</button>
          {dupOpen && (
            <div role="menu" className="absolute z-10 mt-1 flex min-w-max flex-col rounded-[var(--radius-lg)] border border-[var(--c-border)] bg-[var(--c-card)] p-1 shadow-[var(--elevation-3)]">
              <button type="button" role="menuitem" className={MENU_ITEM} onClick={() => { duplicate(page.id, false); setDupOpen(false); }}>{t("page.duplicateOnlyThis")}</button>
              <button type="button" role="menuitem" className={MENU_ITEM} onClick={() => { duplicate(page.id, true); setDupOpen(false); }}>{t("page.duplicateWithChildren")}</button>
            </div>
          )}
        </div>

        <span className="mx-2 inline-flex text-[var(--c-text-muted)]"><Switch label={t("page.fullWidth")} checked={page.style.spacing?.width === "full"} onChange={(v) => void controller.setPageStyle(page.id, applyStylePatch(page.style, { spacing: { width: v ? "full" : undefined } }))} /></span>

        {onExport && <button type="button" className={ACTION} onClick={() => onExport(page.id)}><Icon name="export" size={14} />{t("export.action")}</button>}

        <button type="button" className={cx(ACTION, "hover:text-[var(--c-danger)]")} onClick={() => void controller.describeRemoval(page.id).then((d) => { if (d.needsWarning) setWarn(d.databases); else trash(page.id); })}><Icon name="delete" size={14} />{t("page.delete")}</button>
        <AlertDialog.Root open={warn !== null} onOpenChange={(o) => !o && setWarn(null)}>
          <AlertDialog.Portal>
            <AlertDialog.Overlay className="fixed inset-0 bg-black/40" />
            <AlertDialog.Content className="fixed left-1/2 top-1/2 w-[28rem] -translate-x-1/2 -translate-y-1/2 rounded bg-[var(--bg)] p-4 shadow">
              <AlertDialog.Title className="font-semibold">{t("page.deleteInDatabasesTitle")}</AlertDialog.Title>
              <AlertDialog.Description className="my-2 text-sm">{t("page.deleteInDatabases", { count: warn?.length ?? 0 })}</AlertDialog.Description>
              <ul className="mb-3 list-disc pl-5 text-sm">{(warn ?? []).map((d) => <li key={d.id}>{d.name.trim() === "" ? t("app.untitled") : d.name}</li>)}</ul>
              <div className="flex justify-end gap-2">
                <AlertDialog.Cancel asChild><button type="button">{t("page.cancel")}</button></AlertDialog.Cancel>
                <button type="button" onClick={() => { setWarn(null); trash(page.id); }}>{t("page.deleteEverywhere")}</button>
              </div>
            </AlertDialog.Content>
          </AlertDialog.Portal>
        </AlertDialog.Root>
      </div>
    </div>
  );
}
