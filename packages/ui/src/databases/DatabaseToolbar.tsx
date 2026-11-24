import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { DatabaseController } from "./databaseController";
import { useDatabase } from "./useDatabase";
import { activeChips, removeChip, type Chip } from "./toolbar";
import { Icon } from "../design/Icon";
import { IconButton } from "../components/IconButton";
import { cx } from "../design/cx";

/** Búsqueda como en Notion: un icono que se despliega en un campo; queda abierto mientras haya texto. Filtra por título y texto sin tocar la vista guardada. */
export function DatabaseSearch({ controller }: { controller: DatabaseController }) {
  const { t } = useTranslation();
  const snap = useDatabase(controller);
  const [open, setOpen] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const shown = open || snap.keyword !== "";
  return (
    <span className="inline-flex items-center">
      <IconButton icon="search" label={t("databases.search")} aria-expanded={shown} onClick={() => { setOpen(true); requestAnimationFrame(() => input.current?.focus()); }} className={cx(shown && "hidden")} />
      <input
        ref={input}
        type="search"
        aria-label={t("databases.keyword")}
        placeholder={t("databases.keywordPlaceholder")}
        value={snap.keyword}
        onChange={(e) => void controller.setKeyword(e.target.value)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => { if (e.key === "Escape") { void controller.setKeyword(""); setOpen(false); input.current?.blur(); } }}
        className={cx("h-8 rounded-[var(--radius-md)] bg-[var(--c-card)] px-2 text-[length:var(--text-ui-size)] outline-none transition-[width,opacity] duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--c-accent)] motion-reduce:transition-none", shown ? "w-48 border border-[var(--c-border-control)] opacity-100" : "w-0 border-0 px-0 opacity-0")}
      />
    </span>
  );
}

/** Chips de filtro, orden y agrupación activos de la vista (RF-6.2). */
export function DatabaseToolbar({ controller, onEditFilters }: { controller: DatabaseController; onEditFilters: () => void }) {
  const { t } = useTranslation();
  const snap = useDatabase(controller);
  const view = snap.views.find((v) => v.id === snap.activeViewId);
  const chips = view ? activeChips(view.config, snap.properties) : [];
  const text = (c: Chip) => (c.kind === "filter" ? `${c.label} ${t(`databases.op.${c.detail.split(" ")[0]}`, { defaultValue: c.detail.split(" ")[0] })}${c.detail.includes(" ") ? ` ${c.detail.slice(c.detail.indexOf(" ") + 1)}` : ""}` : c.kind === "sort" ? `${t("databases.chipSort")}: ${c.label} ${c.detail === "asc" ? "↑" : "↓"}` : `${t("databases.chipGroup")}: ${c.label}`);
  if (chips.length === 0) return null;
  return (
    <ul aria-label={t("databases.activeChips")} className="flex flex-wrap gap-1">
      {chips.map((c) => (
        <li key={c.key} className="inline-flex items-center gap-1 rounded-full bg-[var(--c-raised)] pl-3 pr-1 text-[length:var(--text-ui-small-size)]">
          <button type="button" aria-label={`${text(c)}. ${t("databases.editChip", { name: c.label })}`} onClick={onEditFilters} className="py-1">{text(c)}</button>
          <button type="button" aria-label={t("databases.removeChip", { name: c.label })} onClick={() => void controller.updateViewConfig(removeChip(view!.config, c))} className="rounded-full p-1 hover:bg-[var(--c-border)]"><Icon name="close" size={14} /></button>
        </li>
      ))}
    </ul>
  );
}
