import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { TagWithUses } from "@vnote/core";
import type { WorkspaceController } from "../workspace/controller";
import { TagChip } from "./TagChip";

/** Filtro por etiquetas reutilizable (búsqueda, listas…): cada etiqueta del espacio es un botón; las elegidas se combinan (la página debe tener todas). */
export function TagFilter({ controller, value, onChange, active = true }: { controller: WorkspaceController; value: string[]; onChange: (ids: string[]) => void; active?: boolean }) {
  const { t } = useTranslation();
  const [tags, setTags] = useState<TagWithUses[]>([]);
  useEffect(() => { if (active) void controller.tags.list().then(setTags); }, [controller, active]);
  if (tags.length === 0) return null;
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  return (
    <div role="group" aria-label={t("tags.filterLabel")} className="flex flex-wrap items-center gap-1">
      {tags.map((x) => <TagChip key={x.id} name={x.name} color={x.color} pressed={value.includes(x.id)} onToggle={() => toggle(x.id)} />)}
    </div>
  );
}
