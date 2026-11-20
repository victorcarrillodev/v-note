import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { TAG_COLORS, type Tag } from "@vnote/core";
import type { WorkspaceController } from "../workspace/controller";
import { Popover } from "../components/Popover";
import { Icon } from "../design/Icon";
import { splitTags } from "./splitTags";
import { TagChip, tagChipStyle } from "./TagChip";

/** Etiquetas de la página en la fila de datos: chips con «+N» y un popover para elegir o crear (RF-5.9). */
export function PageTags({ controller, pageId }: { controller: WorkspaceController; pageId: string }) {
  const { t } = useTranslation();
  const [mine, setMine] = useState<Tag[]>([]);
  const [all, setAll] = useState<Tag[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(async () => { setMine(await controller.tags.forPage(pageId)); setAll(await controller.tags.list()); }, [controller, pageId]);
  useEffect(() => { void reload(); }, [reload]);

  const have = new Set(mine.map((x) => x.id));
  const q = query.trim().toLowerCase();
  const options = all.filter((x) => !have.has(x.id) && x.name.toLowerCase().includes(q));
  const { shown, more } = splitTags(mine);

  const assign = async (id: string) => { await controller.tags.assign(pageId, id); setQuery(""); setError(null); await reload(); };
  const create = async () => {
    const existing = all.find((x) => x.name.toLowerCase() === q);
    if (existing) { await assign(existing.id); return; }
    const color = TAG_COLORS[all.length % TAG_COLORS.length]!;
    const r = await controller.tags.create({ name: query, color });
    if (!r.ok) { setError(t("tags.createFailed")); return; }
    await assign(r.value.id);
  };

  return (
    <div className="flex flex-wrap items-center gap-1">
      {mine.length > 0 && (
        <ul aria-label={t("tags.listLabel")} className="flex flex-wrap items-center gap-1">
          {shown.map((x) => (
            <li key={x.id}>
              <TagChip name={x.name} color={x.color} removeLabel={t("tags.remove", { name: x.name })} onRemove={() => void controller.tags.unassign(pageId, x.id).then(reload)} />
            </li>
          ))}
          {more > 0 && <li aria-label={t("tags.more", { count: more })} className="inline-flex h-6 items-center rounded-full bg-[var(--c-raised)] px-2 text-[length:var(--text-ui-small-size)] leading-none">+{more}</li>}
        </ul>
      )}
      <Popover onOpenChange={(o) => { if (o) void reload(); }} trigger={<button type="button" aria-label={t("tags.add")} className="inline-flex h-6 items-center gap-1 rounded-full border border-dashed border-[var(--c-border-control)] px-2.5 text-[length:var(--text-ui-small-size)] leading-none text-[var(--c-text-muted)] hover:bg-[var(--c-raised)]"><Icon name="tag" size={14} />{t("tags.add")}</button>}>
        <div className="flex flex-col gap-2">
          <input aria-label={t("tags.search")} value={query} autoFocus onChange={(e) => { setQuery(e.target.value); setError(null); }} onKeyDown={(e) => { if (e.key === "Enter" && query.trim() !== "") { e.preventDefault(); void create(); } }} className="h-8 rounded-md bg-[var(--c-raised)] px-2" />
          {error && <p role="alert" className="text-[length:var(--text-note-size)] text-[var(--c-danger)]">{error}</p>}
          <ul role="listbox" aria-label={t("tags.options")} className="flex max-h-48 flex-col overflow-y-auto">
            {options.map((x) => <li key={x.id} role="option" aria-selected={false} tabIndex={0} onClick={() => void assign(x.id)} onKeyDown={(e) => { if (e.key === "Enter") void assign(x.id); }} className="cursor-pointer rounded px-2 py-1 hover:bg-[var(--c-raised)]"><span className="rounded-full px-2" style={tagChipStyle(x.color)}>{x.name}</span></li>)}
          </ul>
          {query.trim() !== "" && !all.some((x) => x.name.toLowerCase() === q) && <button type="button" onClick={() => void create()} className="text-left text-[var(--c-accent)]">{t("tags.create", { name: query.trim() })}</button>}
        </div>
      </Popover>
    </div>
  );
}
