import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { ViewType } from "@vnote/core";
import type { IconName } from "../design/iconMap";
import { Icon } from "../design/Icon";
import { Button } from "../components/Button";
import { IconButton } from "../components/IconButton";
import { Menu } from "../components/Menu";

/** Un ícono por tipo de vista (un significado = un ícono). */
export const VIEW_ICON: Record<ViewType, IconName> = { table: "database", list: "note", board: "board", gallery: "image", calendar: "calendar", timeline: "time" };

/**
 * Cabecera de la base como en Notion: título a la izquierda y, a la derecha, herramientas de icono (`tools`: filtros, búsqueda, disposición),
 * «nueva propiedad» y el botón partido «Nuevo» (crea una fila; el menú añade también una propiedad) (RF-6.1).
 */
export function DatabaseHeader({ name, showTitle, onNewRow, onNewProperty, tools }: { name: string; showTitle: boolean; onNewRow: () => void; onNewProperty: () => void; tools?: ReactNode }) {
  const { t } = useTranslation();
  return (
    <div role="group" aria-label={name} className="flex flex-wrap items-center gap-3">
      <span className="text-[var(--c-text-muted)]"><Icon name="database" size={24} /></span>
      {showTitle ? <h1 className="min-w-0 flex-1 truncate text-[length:var(--text-h2-size)] font-semibold">{name}</h1> : <span className="flex-1" />}
      <div className="flex items-center gap-0.5">
        {tools}
        <IconButton icon="create" label={t("databases.newProperty")} onClick={onNewProperty} />
        <span className="ml-1 inline-flex items-center">
          <Button variant="primary" size="sm" aria-label={t("databases.newRow")} onClick={onNewRow} className="rounded-r-none">{t("databases.newRowShort")}</Button>
          <span aria-hidden="true" className="h-7 w-px bg-[var(--c-on-accent)] opacity-30" style={{ background: "var(--c-accent)", boxShadow: "inset 1px 0 0 rgb(255 255 255 / 0.3)" }} />
          <Menu label={t("databases.moreNew")} icon="collapse" triggerClassName="h-7 w-7 rounded-l-none bg-[var(--c-accent)] text-[var(--c-on-accent)] hover:bg-[var(--c-accent)] hover:text-[var(--c-on-accent)] hover:brightness-95" items={[
            { label: t("databases.newRow"), icon: "create", onSelect: onNewRow },
            { label: t("databases.newProperty"), icon: "tag", onSelect: onNewProperty },
          ]} />
        </span>
      </div>
    </div>
  );
}
