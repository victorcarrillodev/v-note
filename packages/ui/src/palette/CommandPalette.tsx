import { useEffect, useRef, useState } from "react";
import { Command } from "cmdk";
import { useTranslation } from "react-i18next";
import type { PageKind, RecentPage, SearchHit } from "@vnote/core";
import type { WorkspaceController } from "../workspace/controller";

export type PaletteAction = { id: string; label: string; run: () => void };
type Props = {
  controller: WorkspaceController;
  open: boolean;
  onClose: () => void;
  onOpenPage: (pageId: string) => void;
  actions: PaletteAction[];
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

/** Paleta de comandos (RF-5): recientes sin texto, búsqueda en vivo con filtros y acciones. La búsqueda es siempre del espacio abierto. */
export function CommandPalette({ controller, open, onClose, onOpenPage, actions }: Props) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<PageKind | "any">("any");
  const [within, setWithin] = useState<Within>("any");
  const [trash, setTrash] = useState(false);
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [recent, setRecent] = useState<RecentPage[]>([]);
  const [searched, setSearched] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    if (!open) { setQuery(""); setKind("any"); setWithin("any"); setTrash(false); }
  }, [open]);

  // Recientes al abrir
  useEffect(() => {
    if (open) void controller.recent().then(setRecent);
  }, [open, controller]);

  // Búsqueda en vivo; una respuesta lenta no pisa a una más reciente
  useEffect(() => {
    if (!open) return;
    const mine = ++seq.current;
    if (query.trim() === "") { setHits([]); setSearched(false); return; }
    const days = DAYS[within];
    void controller
      .search({ query, ...(kind !== "any" ? { kind } : {}), ...(days ? { withinDays: days } : {}), includeTrashed: trash })
      .then((r) => { if (mine === seq.current) { setHits(r); setSearched(true); } })
      .catch(() => { if (mine === seq.current) { setHits([]); setSearched(true); } });
  }, [open, query, kind, within, trash, controller]);

  const q = query.trim().toLowerCase();
  const shownActions = q === "" ? actions : actions.filter((a) => a.label.toLowerCase().includes(q));
  const choosePage = (id: string) => { onOpenPage(id); onClose(); };
  const title = (s: string) => (s === "" ? t("palette.untitled") : s);
  const nothing = q !== "" && searched && hits.length === 0 && shownActions.length === 0;

  return (
    <Command.Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }} label={t("palette.title")} shouldFilter={false} className="fixed left-1/2 top-24 z-50 w-[36rem] max-w-[95vw] -translate-x-1/2 rounded border bg-[var(--bg)] p-2 shadow-lg">
      <Command.Input value={query} onValueChange={setQuery} placeholder={t("palette.placeholder")} className="w-full rounded border px-2 py-1" />
      <div className="my-2 flex flex-wrap items-center gap-2 text-sm">
        <label>{t("palette.kind")}{" "}
          <select value={kind} onChange={(e) => setKind(e.target.value as PageKind | "any")}>
            <option value="any">{t("palette.anyKind")}</option>
            <option value="note">{t("palette.note")}</option>
            <option value="board">{t("palette.board")}</option>
            <option value="database">{t("palette.database")}</option>
          </select>
        </label>
        <label>{t("palette.modified")}{" "}
          <select value={within} onChange={(e) => setWithin(e.target.value as Within)}>
            <option value="any">{t("palette.anyTime")}</option>
            <option value="today">{t("palette.today")}</option>
            <option value="week">{t("palette.week")}</option>
            <option value="month">{t("palette.month")}</option>
          </select>
        </label>
        <label><input type="checkbox" checked={trash} onChange={(e) => setTrash(e.target.checked)} /> {t("palette.includeTrash")}</label>
      </div>
      <Command.List className="max-h-80 overflow-y-auto">
        {q === "" && recent.length > 0 && (
          <Command.Group heading={t("palette.recent")}>
            {recent.map((r) => (
              <Command.Item key={r.pageId} value={`recent-${r.pageId}`} onSelect={() => choosePage(r.pageId)}>{title(r.title)}</Command.Item>
            ))}
          </Command.Group>
        )}
        {q !== "" && hits.length > 0 && (
          <Command.Group heading={t("palette.pages")}>
            {hits.map((h) => (
              <Command.Item key={h.pageId} value={`hit-${h.pageId}`} aria-label={`${title(h.title)}${h.trashed ? `, ${t("palette.inTrash")}` : ""}`} onSelect={() => choosePage(h.pageId)}>
                <span>{h.title === "" ? t("palette.untitled") : highlightWords(h.title, query).map((p, i) => (p.match ? <mark key={i}>{p.text}</mark> : <span key={i}>{p.text}</span>))}</span>
                {h.trashed && <em className="ml-2 text-xs">{t("palette.inTrash")}</em>}
                <small className="block opacity-70">
                  {h.snippet.map((p, i) => (p.match ? <mark key={i}>{p.text}</mark> : <span key={i}>{p.text}</span>))}
                </small>
              </Command.Item>
            ))}
          </Command.Group>
        )}
        {shownActions.length > 0 && (
          <Command.Group heading={t("palette.actions")}>
            {shownActions.map((a) => (
              <Command.Item key={a.id} value={`action-${a.id}`} onSelect={() => { a.run(); onClose(); }}>{a.label}</Command.Item>
            ))}
          </Command.Group>
        )}
        {nothing && <div role="status" className="p-2 text-sm opacity-70">{t("palette.empty")}</div>}
      </Command.List>
    </Command.Dialog>
  );
}
