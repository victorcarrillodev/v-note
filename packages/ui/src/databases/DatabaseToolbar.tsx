import { useTranslation } from "react-i18next";
import type { DatabaseController } from "./databaseController";
import { useDatabase } from "./useDatabase";
import { activeChips, removeChip, type Chip } from "./toolbar";
import { Icon } from "../design/Icon";

/** Palabra clave y chips de filtro, orden y agrupación activos de la vista (RF-6.2). */
export function DatabaseToolbar({ controller, onEditFilters }: { controller: DatabaseController; onEditFilters: () => void }) {
  const { t } = useTranslation();
  const snap = useDatabase(controller);
  const view = snap.views.find((v) => v.id === snap.activeViewId);
  const chips = view ? activeChips(view.config, snap.properties) : [];
  const text = (c: Chip) => (c.kind === "filter" ? `${c.label} ${t(`databases.op.${c.detail.split(" ")[0]}`, { defaultValue: c.detail.split(" ")[0] })}${c.detail.includes(" ") ? ` ${c.detail.slice(c.detail.indexOf(" ") + 1)}` : ""}` : c.kind === "sort" ? `${t("databases.chipSort")}: ${c.label} ${c.detail === "asc" ? "↑" : "↓"}` : `${t("databases.chipGroup")}: ${c.label}`);
  return (
    <div className="flex flex-col gap-2">
      <input
        type="search"
        aria-label={t("databases.keyword")}
        placeholder={t("databases.keywordPlaceholder")}
        value={snap.keyword}
        onChange={(e) => void controller.setKeyword(e.target.value)}
        className="h-8 w-full max-w-xs rounded-md border border-[var(--c-border-control)] bg-[var(--c-card)] px-2 text-[length:var(--text-ui-size)]"
      />
      {chips.length > 0 && (
        <ul aria-label={t("databases.activeChips")} className="flex flex-wrap gap-1">
          {chips.map((c) => (
            <li key={c.key} className="inline-flex items-center gap-1 rounded-full bg-[var(--c-raised)] pl-3 pr-1 text-[length:var(--text-ui-small-size)]">
              <button type="button" aria-label={t("databases.editChip", { name: c.label })} onClick={onEditFilters} className="py-1">{text(c)}</button>
              <button type="button" aria-label={t("databases.removeChip", { name: c.label })} onClick={() => void controller.updateViewConfig(removeChip(view!.config, c))} className="rounded-full p-1 hover:bg-[var(--c-border)]"><Icon name="close" size={14} /></button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
