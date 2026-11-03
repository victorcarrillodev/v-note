import { useTranslation } from "react-i18next";
import type { ViewType } from "@vnote/core";
import type { IconName } from "../design/iconMap";
import { Icon } from "../design/Icon";
import { Button } from "../components/Button";

/** Un ícono por tipo de vista (un significado = un ícono). */
export const VIEW_ICON: Record<ViewType, IconName> = { table: "database", list: "note", board: "board", gallery: "image", calendar: "calendar", timeline: "time" };

/** Cabecera de la base: ícono, título y acciones principales (RF-6.1). */
export function DatabaseHeader({ name, showTitle, onNewRow, onNewProperty }: { name: string; showTitle: boolean; onNewRow: () => void; onNewProperty: () => void }) {
  const { t } = useTranslation();
  return (
    <div role="group" aria-label={name} className="flex items-center gap-3">
      <span className="text-[var(--c-text-muted)]"><Icon name="database" size={24} /></span>
      {showTitle ? <h1 className="min-w-0 flex-1 truncate text-[length:var(--text-h2-size)] font-semibold">{name}</h1> : <span className="flex-1" />}
      <Button variant="primary" size="sm" onClick={onNewRow}>{t("databases.newRow")}</Button>
      <Button size="sm" onClick={onNewProperty}>{t("databases.newProperty")}</Button>
    </div>
  );
}
