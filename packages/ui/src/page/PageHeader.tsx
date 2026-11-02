import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { useTranslation } from "react-i18next";
import type { Page, PageNode } from "@vnote/core";
import type { WorkspaceController } from "../workspace/controller";
import { useWorkspace } from "../workspace/useController";

const COVER_COLORS = ["#cfe8ff", "#ffd9d9", "#dff5d8", "#fff1c9", "#e6dcff"];

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

export function PageHeader({ controller, pageId, onNavigate, onExport }: { controller: WorkspaceController; pageId: string; onNavigate?: (id: string) => void; onExport?: (id: string) => void }) {
  const { t } = useTranslation();
  const snap = useWorkspace(controller);
  const found = locate(snap.tree, pageId);
  const title = found?.page.title ?? "";
  const [draft, setDraft] = useState(title);
  const [editingIcon, setEditingIcon] = useState(false);
  const [dupOpen, setDupOpen] = useState(false);
  const [warn, setWarn] = useState<{ id: string; name: string }[] | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const untitledOnOpen = found !== null && found.page.title === "";
  useEffect(() => setDraft(title), [title, pageId]);
  // Una página nueva (sin título) recibe el foco para escribir de inmediato.
  useEffect(() => { if (untitledOnOpen) titleRef.current?.focus(); }, [pageId]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!found) return null;
  const { page, ancestors } = found;

  const commitTitle = () => { if (draft !== page.title) void controller.renamePage(page.id, draft); };
  const onTitleKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") { e.preventDefault(); commitTitle(); }
    if (e.key === "Escape") { setDraft(page.title); }
  };
  const navigate = (id: string) => { void controller.select(id); onNavigate?.(id); };

  return (
    <header className="flex flex-col gap-2">
      {page.cover && (
        <div data-testid="cover" className="h-32 w-full" style={{ background: page.cover.startsWith("color:") ? page.cover.slice(6) : undefined }} />
      )}
      <nav aria-label={t("page.breadcrumbs")}>
        <ol className="flex flex-wrap items-center gap-1 text-sm">
          {ancestors.map((a) => (
            <li key={a.id} className="flex items-center gap-1">
              <button type="button" onClick={() => navigate(a.id)} className="hover:underline">{a.title.trim() === "" ? t("app.untitled") : a.title}</button>
              <span aria-hidden="true">/</span>
            </li>
          ))}
          <li aria-current="page">{page.title.trim() === "" ? t("app.untitled") : page.title}</li>
        </ol>
      </nav>

      <div className="flex items-center gap-2">
        {page.icon && <span aria-hidden="true" className="text-3xl">{page.icon}</span>}
        <input
          ref={titleRef}
          aria-label={t("page.titleLabel")}
          placeholder={t("page.titlePlaceholder")}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitTitle}
          onKeyDown={onTitleKey}
          className="min-w-0 flex-1 bg-transparent text-3xl font-bold outline-none"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        {page.icon ? (
          <button type="button" onClick={() => void controller.setIcon(page.id, null)}>{t("page.removeIcon")}</button>
        ) : editingIcon ? (
          <input
            aria-label={t("page.iconLabel")}
            autoFocus
            maxLength={8}
            className="w-16 rounded border px-1"
            onKeyDown={(e) => {
              if (e.key === "Enter" && e.currentTarget.value.trim()) { void controller.setIcon(page.id, e.currentTarget.value.trim()); setEditingIcon(false); }
              if (e.key === "Escape") setEditingIcon(false);
            }}
          />
        ) : (
          <button type="button" onClick={() => setEditingIcon(true)}>{t("page.addIcon")}</button>
        )}

        {page.cover ? (
          <button type="button" onClick={() => void controller.setCover(page.id, null)}>{t("page.removeCover")}</button>
        ) : (
          <button type="button" onClick={() => void controller.setCover(page.id, `color:${COVER_COLORS[Math.floor(Math.random() * COVER_COLORS.length)]}`)}>{t("page.addCover")}</button>
        )}

        <button type="button" aria-pressed={page.favorite} onClick={() => void controller.toggleFavorite(page.id)}>
          {page.favorite ? t("page.unfavorite") : t("page.favorite")}
        </button>

        <div className="relative">
          <button type="button" aria-haspopup="menu" aria-expanded={dupOpen} onClick={() => setDupOpen((o) => !o)}>{t("page.duplicate")}</button>
          {dupOpen && (
            <div role="menu" className="absolute z-10 flex flex-col rounded border bg-[var(--bg)] p-1 shadow">
              <button type="button" role="menuitem" onClick={() => { void controller.duplicate(page.id, { withChildren: false }); setDupOpen(false); }}>{t("page.duplicateOnlyThis")}</button>
              <button type="button" role="menuitem" onClick={() => { void controller.duplicate(page.id, { withChildren: true }); setDupOpen(false); }}>{t("page.duplicateWithChildren")}</button>
            </div>
          )}
        </div>

        {onExport && <button type="button" onClick={() => onExport(page.id)}>{t("export.action")}</button>}

        <button type="button" onClick={() => void controller.describeRemoval(page.id).then((d) => { if (d.needsWarning) setWarn(d.databases); else void controller.trashPage(page.id); })}>{t("page.delete")}</button>
        <AlertDialog.Root open={warn !== null} onOpenChange={(o) => !o && setWarn(null)}>
          <AlertDialog.Portal>
            <AlertDialog.Overlay className="fixed inset-0 bg-black/40" />
            <AlertDialog.Content className="fixed left-1/2 top-1/2 w-[28rem] -translate-x-1/2 -translate-y-1/2 rounded bg-[var(--bg)] p-4 shadow">
              <AlertDialog.Title className="font-semibold">{t("page.deleteInDatabasesTitle")}</AlertDialog.Title>
              <AlertDialog.Description className="my-2 text-sm">{t("page.deleteInDatabases", { count: warn?.length ?? 0 })}</AlertDialog.Description>
              <ul className="mb-3 list-disc pl-5 text-sm">{(warn ?? []).map((d) => <li key={d.id}>{d.name.trim() === "" ? t("app.untitled") : d.name}</li>)}</ul>
              <div className="flex justify-end gap-2">
                <AlertDialog.Cancel asChild><button type="button">{t("page.cancel")}</button></AlertDialog.Cancel>
                <button type="button" onClick={() => { setWarn(null); void controller.trashPage(page.id); }}>{t("page.deleteEverywhere")}</button>
              </div>
            </AlertDialog.Content>
          </AlertDialog.Portal>
        </AlertDialog.Root>
      </div>
    </header>
  );
}
