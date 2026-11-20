import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { TagWithUses } from "@vnote/core";
import { Button } from "../components/Button";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { IconButton } from "../components/IconButton";
import { ViewLayout, ViewSection } from "../components/ViewLayout";
import { INPUT } from "../components/formStyles";
import { EmptyState } from "../empty/EmptyState";
import type { WorkspaceController } from "../workspace/controller";
import { Popover } from "../components/Popover";
import { AccentPicker } from "../page/options/AccentPicker";
import { TagChip, tagSwatch } from "./TagChip";

type PageRef = { id: string; title: string };

/** Etiquetas del espacio: ver todas, renombrar, cambiar el color, eliminar y listar las páginas que las usan. */
export function TagsView({ controller, onOpenPage }: { controller: WorkspaceController; onOpenPage: (id: string) => void }) {
  const { t } = useTranslation();
  const [tags, setTags] = useState<TagWithUses[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [pages, setPages] = useState<PageRef[]>([]);
  const [pending, setPending] = useState<TagWithUses | null>(null);
  const reload = useCallback(async () => setTags(await controller.tags.list()), [controller]);
  useEffect(() => { void reload(); }, [reload]);

  const showPages = async (id: string) => {
    if (open === id) { setOpen(null); return; }
    const ids = await controller.tags.pagesWith(id);
    const refs: PageRef[] = [];
    for (const pid of ids) { const p = await controller.getPage(pid); if (p) refs.push({ id: pid, title: p.title }); }
    setPages(refs); setOpen(id);
  };
  const save = async (x: TagWithUses) => {
    const r = await controller.tags.rename(x.id, draft);
    if (!r.ok) { setError(t(r.error.details?.reason === "DUPLICATE" ? "tags.duplicate" : "tags.nameRequired")); return; }
    setEditing(null); setError(null); await reload();
  };
  const recolor = async (id: string, c: string) => { await controller.tags.recolor(id, c); await reload(); };
  const remove = async () => { if (!pending) return; await controller.tags.remove(pending.id); setPending(null); if (open === pending.id) setOpen(null); await reload(); };

  return (
    <ViewLayout title={t("tags.title")} description={t("tags.hint")}>
      {tags.length === 0 ? <EmptyState illustration="search" title={t("tags.empty")} /> : (
        <ViewSection flush>
          <ul aria-label={t("tags.options")} className="divide-y divide-[var(--c-border)]">
            {tags.map((x) => (
              <li key={x.id} className="flex flex-col gap-2 px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  {editing === x.id ? (
                    <>
                      <input autoFocus aria-label={t("tags.rename")} value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void save(x); if (e.key === "Escape") { setEditing(null); setError(null); } }} aria-invalid={error !== null} className={`${INPUT} max-w-60`} />
                      <Button size="sm" variant="primary" onClick={() => void save(x)}>{t("tags.save")}</Button>
                      <Button size="sm" onClick={() => { setEditing(null); setError(null); }}>{t("tags.cancel")}</Button>
                    </>
                  ) : (
                    <>
                      <TagChip name={x.name} color={x.color} />
                      <span className="text-[length:var(--text-ui-small-size)] text-[var(--c-text-muted)]">{t("tags.uses", { count: x.uses })}</span>
                      <span className="ml-auto flex items-center gap-1">
                        <Button size="sm" aria-expanded={open === x.id} onClick={() => void showPages(x.id)}>{t("tags.showPages")}</Button>
                        <IconButton icon="edit" label={t("tags.renameTag", { name: x.name })} onClick={() => { setEditing(x.id); setDraft(x.name); setError(null); }} />
                        <IconButton icon="delete" label={t("tags.deleteTag", { name: x.name })} onClick={() => setPending(x)} />
                      </span>
                    </>
                  )}
                </div>
                {editing === x.id && error && <p role="alert" className="text-[length:var(--text-note-size)] text-[var(--c-danger)]">{error}</p>}
                <Popover trigger={<button type="button" aria-label={t("tags.colorOf", { name: x.name })} className="inline-flex h-7 items-center gap-2 self-start rounded-[var(--radius-md)] px-2 text-[length:var(--text-ui-small-size)] text-[var(--c-text-muted)] hover:bg-[var(--c-raised)]"><span aria-hidden="true" style={{ background: tagSwatch(x.color) }} className="size-4 rounded-full" />{t("tags.color")}</button>}>
                  <div className="w-80 max-w-full"><AccentPicker label={t("tags.colorOf", { name: x.name })} allowDefault={false} value={x.color as never} onChange={(v) => { if (v) void recolor(x.id, v); }} /></div>
                </Popover>
                {open === x.id && (
                  <ul aria-label={t("tags.pagesOf", { name: x.name })} className="flex flex-col gap-0.5">
                    {pages.length === 0 && <li className="text-[length:var(--text-ui-small-size)] text-[var(--c-text-muted)]">{t("tags.noPages")}</li>}
                    {pages.map((p) => (
                      <li key={p.id}><button type="button" onClick={() => onOpenPage(p.id)} className="rounded px-2 py-1 text-left text-[length:var(--text-ui-size)] hover:bg-[var(--c-raised)]">{p.title.trim() === "" ? t("app.untitled") : p.title}</button></li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </ViewSection>
      )}
      <ConfirmDialog open={pending !== null} onOpenChange={(o) => { if (!o) setPending(null); }} title={t("tags.deleteTitle", { name: pending?.name ?? "" })} description={t("tags.deleteBody", { count: pending?.uses ?? 0 })} confirmLabel={t("tags.delete")} cancelLabel={t("tags.cancel")} onConfirm={() => void remove()} />
    </ViewLayout>
  );
}
