import { useEffect, useRef, useState } from "react";
import { EmptyState } from "../empty/EmptyState";
import { Command } from "cmdk";
import { useTranslation } from "react-i18next";
import type { PageKind, RecentPage, SearchHit } from "@vnote/core";
import type { WorkspaceController } from "../workspace/controller";
import { Icon } from "../design/Icon";
import { IconButton } from "../components/IconButton";
import { TagFilter } from "../tags/TagFilter";

export type PaletteAction = { id: string; label: string; run: () => void; /** Atajo ya formateado para la plataforma. */ shortcut?: string; /** Valor para `aria-keyshortcuts`. */ ariaShortcut?: string };
type Props = {
  controller: WorkspaceController;
  open: boolean;
  onClose: () => void;
  onOpenPage: (pageId: string) => void;
  actions: PaletteAction[];
  /** Si se da, cuando no hay resultados se ofrece crear una página con el texto buscado. */
  onCreatePage?: (title: string) => void;
};
type Within = "any" | "today" | "week" | "month";
const DAYS: Record<Within, number | undefined> = { any: undefined, today: 1, week: 7, month: 30 };

/** Parte el texto marcando el comienzo de cada palabra que coincide (por prefijo) con alguna de las buscadas. */
export function highlightWords(text: string, query: string): { text: string; match: boolean }[] {
  const words = (query.match(/[\p{L}\p{N}]+/gu) ?? []).map((w) => w.toLowerCase());
  if (words.length === 0) return [{ text, match: false }];
  const out: { text: string; match: boolean }[] = [];
  let last = 0;
  for (const m of text.matchAll(/[\p{L}\p{N}]+/gu)) {
    const hit = words.find((w) => m[0].toLowerCase().startsWith(w));
    if (!hit) continue;
    if (m.index! > last) out.push({ text: text.slice(last, m.index), match: false });
    out.push({ text: text.slice(m.index!, m.index! + hit.length), match: true });
    last = m.index! + hit.length;
  }
  if (last < text.length) out.push({ text: text.slice(last), match: false });
  return out;
}

const KIND_ICON = { note: "note", board: "board", database: "database" } as const;

function FilterChip({ label, pressed, onClick }: { label: string; pressed: boolean; onClick: () => void }) {
  return (
    <button type="button" aria-pressed={pressed} onClick={onClick} className={`inline-flex h-6 items-center gap-1 rounded-full border px-2.5 transition-colors duration-100 text-[length:var(--text-ui-small-size)] ${pressed ? "border-[var(--c-accent)] bg-[var(--chip-info-bg)] font-medium text-[var(--chip-info-fg)]" : "border-[var(--c-border-control)] text-[var(--c-text-muted)] hover:bg-[var(--c-raised)]"}`}>
      {pressed && <Icon name="check" size={14} />}
      {label}
    </button>
  );
}
const ITEM = "flex cursor-pointer items-start gap-2 rounded border-l-2 border-transparent px-2 py-1.5 text-[length:var(--text-ui-size)] data-[selected=true]:border-[var(--c-accent)] data-[selected=true]:bg-[var(--c-raised)]";

/** Paleta de comandos (RF-9): recientes y acciones sin texto, búsqueda en vivo con filtros como chips. La búsqueda es siempre del espacio abierto. */
export function CommandPalette({ controller, open, onClose, onOpenPage, actions, onCreatePage }: Props) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<PageKind | "any">("any");
  const [within, setWithin] = useState<Within>("any");
  const [trash, setTrash] = useState(false);
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [recent, setRecent] = useState<RecentPage[]>([]);
  const [searched, setSearched] = useState(false);
  const [paths, setPaths] = useState<Record<string, string>>({});
  const seq = useRef(0);
  const opener = useRef<HTMLElement | null>(null);
  const wasOpen = useRef(false);

  // Se recuerda quién tenía el foco al abrir y se le devuelve al cerrar (RF-9.5).
  useEffect(() => {
    if (open && !wasOpen.current) opener.current = document.activeElement as HTMLElement | null;
    if (!open && wasOpen.current) { const el = opener.current; requestAnimationFrame(() => el?.focus()); }
    wasOpen.current = open;
  }, [open]);

  useEffect(() => {
    if (!open) { setQuery(""); setKind("any"); setWithin("any"); setTrash(false); setTagIds([]); }
  }, [open]);

  // Recientes al abrir
  useEffect(() => {
    if (open) void controller.recent().then(setRecent);
  }, [open, controller]);

  // Búsqueda en vivo; una respuesta lenta no pisa a una más reciente
  useEffect(() => {
    if (!open) return;
    const mine = ++seq.current;
    if (query.trim() === "" && tagIds.length === 0) { setHits([]); setSearched(false); return; }
    const days = DAYS[within];
    void controller
      .search({ query, ...(kind !== "any" ? { kind } : {}), ...(days ? { withinDays: days } : {}), includeTrashed: trash, ...(tagIds.length ? { tagIds } : {}) })
      .then((r) => { if (mine === seq.current) { setHits(r); setSearched(true); } })
      .catch(() => { if (mine === seq.current) { setHits([]); setSearched(true); } });
  }, [open, query, kind, within, trash, tagIds, controller]);

  // Ruta (padres) de cada resultado visible
  useEffect(() => {
    let alive = true;
    void Promise.all(hits.slice(0, 20).map(async (h) => [h.pageId, (await controller.ancestorsOf(h.pageId)).map((a) => (a.title.trim() === "" ? t("palette.untitled") : a.title)).join(" › ")] as const))
      .then((entries) => { if (alive) setPaths(Object.fromEntries(entries)); });
    return () => { alive = false; };
  }, [hits, controller, t]);

  const q = query.trim().toLowerCase();
  const shownActions = q === "" ? actions : actions.filter((a) => a.label.toLowerCase().includes(q));
  const choosePage = (id: string) => { onOpenPage(id); onClose(); };
  const title = (s: string) => (s === "" ? t("palette.untitled") : s);
  const nothing = (q !== "" || tagIds.length > 0) && searched && hits.length === 0 && shownActions.length === 0;
  const toggleKind = (k: PageKind) => setKind((cur) => (cur === k ? "any" : k));
  const toggleWithin = (w: Within) => setWithin((cur) => (cur === w ? "any" : w));

  return (
    <Command.Dialog
      open={open}
      onOpenChange={(o) => { if (!o) onClose(); }}
      label={t("palette.title")}
      shouldFilter={false}
      overlayClassName="fixed inset-0 z-[var(--z-scrim)] bg-[var(--c-scrim)]"
      contentClassName="fixed left-1/2 top-[12%] z-[var(--z-dialog)] w-[var(--size-palette-width)] max-w-[calc(100vw-var(--space-12))] max-h-[70vh] -translate-x-1/2 overflow-hidden rounded-lg border border-[var(--c-border)] bg-[var(--c-card)] shadow-[var(--elevation-4)]"
      className="flex max-h-[70vh] flex-col text-[var(--c-text)]"
    >
      <div className="flex items-center gap-2 border-b border-[var(--c-border)] px-3">
        <Icon name="search" />
        <Command.Input value={query} onValueChange={setQuery} placeholder={t("palette.placeholder")} className="h-11 w-full bg-transparent text-[length:var(--text-ui-size)] outline-none placeholder:text-[var(--c-text-placeholder)]" />
        {query && <IconButton icon="close" label={t("palette.clear")} onClick={() => setQuery("")} />}
      </div>
      <div className="flex flex-wrap items-center gap-1 px-3 py-2" role="group" aria-label={t("palette.filters")}>
        <FilterChip label={t("palette.note")} pressed={kind === "note"} onClick={() => toggleKind("note")} />
        <FilterChip label={t("palette.board")} pressed={kind === "board"} onClick={() => toggleKind("board")} />
        <FilterChip label={t("palette.database")} pressed={kind === "database"} onClick={() => toggleKind("database")} />
        <span aria-hidden="true" className="mx-1 h-4 w-px bg-[var(--c-border)]" />
        <FilterChip label={t("palette.today")} pressed={within === "today"} onClick={() => toggleWithin("today")} />
        <FilterChip label={t("palette.week")} pressed={within === "week"} onClick={() => toggleWithin("week")} />
        <FilterChip label={t("palette.month")} pressed={within === "month"} onClick={() => toggleWithin("month")} />
        <span aria-hidden="true" className="mx-1 h-4 w-px bg-[var(--c-border)]" />
        <FilterChip label={t("palette.includeTrash")} pressed={trash} onClick={() => setTrash((v) => !v)} />
        <TagFilter controller={controller} value={tagIds} onChange={setTagIds} active={open} />
      </div>
      <Command.List className="min-h-0 flex-1 overflow-y-auto px-2 pb-2 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1 [&_[cmdk-group-heading]]:text-[length:var(--text-label-size)] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:text-[var(--c-text-muted)]">
        {q === "" && tagIds.length === 0 && recent.length > 0 && (
          <Command.Group heading={t("palette.recent")}>
            {recent.map((r) => (
              <Command.Item key={r.pageId} value={`recent-${r.pageId}`} onSelect={() => choosePage(r.pageId)} className={ITEM}><Icon name="note" />{title(r.title)}</Command.Item>
            ))}
          </Command.Group>
        )}
        {(q !== "" || tagIds.length > 0) && hits.length > 0 && (
          <Command.Group heading={t("palette.pages")}>
            {hits.map((h) => (
              <Command.Item key={h.pageId} value={`hit-${h.pageId}`} aria-label={`${title(h.title)}${h.trashed ? `, ${t("palette.inTrash")}` : ""}`} onSelect={() => choosePage(h.pageId)} className={ITEM}>
                <span className="mt-0.5 text-[var(--c-text-muted)]"><Icon name={KIND_ICON[h.kind]} /></span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{h.title === "" ? t("palette.untitled") : highlightWords(h.title, query).map((p, i) => (p.match ? <mark key={i} className="rounded-sm bg-[var(--chip-warning-bg)] text-[var(--chip-warning-fg)]">{p.text}</mark> : <span key={i}>{p.text}</span>))}</span>
                  {paths[h.pageId] && <span data-result-path className="block truncate text-[length:var(--text-note-size)] text-[var(--c-text-muted)]">{paths[h.pageId]}</span>}
                  <small className="block truncate text-[length:var(--text-note-size)] text-[var(--c-text-muted)]">
                    {h.snippet.map((p, i) => (p.match ? <mark key={i} className="rounded-sm bg-[var(--chip-warning-bg)] text-[var(--chip-warning-fg)]">{p.text}</mark> : <span key={i}>{p.text}</span>))}
                  </small>
                </span>
                {h.trashed && <em className="ml-2 text-[length:var(--text-note-size)] not-italic text-[var(--c-text-muted)]">{t("palette.inTrash")}</em>}
              </Command.Item>
            ))}
          </Command.Group>
        )}
        {shownActions.length > 0 && (
          <Command.Group heading={t("palette.actions")}>
            {shownActions.map((a) => (
              <Command.Item key={a.id} value={`action-${a.id}`} {...(a.ariaShortcut ? { "aria-keyshortcuts": a.ariaShortcut } : {})} onSelect={() => { a.run(); onClose(); }} className={`${ITEM} items-center justify-between`}>
                <span>{a.label}</span>
                {a.shortcut && <kbd aria-hidden="true" className="rounded-sm bg-[var(--c-raised)] px-1 font-mono text-[length:var(--text-note-size)] text-[var(--c-text-muted)]">{a.shortcut}</kbd>}
              </Command.Item>
            ))}
          </Command.Group>
        )}
        {nothing && (
          <>
            <EmptyState illustration="search" title={t("palette.empty")} />
            {onCreatePage && (
              <Command.Item value="create-page" onSelect={() => { onCreatePage(query.trim()); onClose(); }} className={ITEM}>
                <Icon name="create" />
                <span>{t("palette.createWithTitle")} «{query.trim()}»</span>
              </Command.Item>
            )}
          </>
        )}
      </Command.List>
    </Command.Dialog>
  );
}
