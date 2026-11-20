import { useTranslation } from "react-i18next";
import type { ViewConfig } from "@vnote/core";
import type { DatabaseController } from "./databaseController";
import { useDatabase } from "./useDatabase";
import { Checkbox, Segmented, Switch } from "../components/controls";

/** Disposición de la vista activa (como el panel de ajustes de Notion): tamaño y portada de las tarjetas (galería) y propiedades visibles. */
export function ViewOptions({ controller }: { controller: DatabaseController }) {
  const { t } = useTranslation();
  const snap = useDatabase(controller);
  const view = snap.views.find((v) => v.id === snap.activeViewId);
  if (!view) return null;
  const cfg: ViewConfig = view.config;
  const set = (patch: Partial<Record<keyof ViewConfig, unknown>>) => void controller.updateViewConfig(patch);
  const visible = snap.result?.visibleProperties ?? [];
  const toggle = (id: string, on: boolean) => set({ visibleProperties: on ? [...visible, id] : visible.filter((x) => x !== id) });
  return (
    <div role="group" aria-label={t("databases.layout")} className="flex w-64 flex-col gap-3">
      {view.type === "gallery" && (
        <>
          <div className="flex flex-col gap-1">
            <span className="text-[length:var(--text-ui-small-size)] font-medium">{t("databases.cardSize")}</span>
            <Segmented label={t("databases.cardSize")} value={cfg.cardSize ?? "medium"} onChange={(v) => set({ cardSize: v })}
              options={(["small", "medium", "large"] as const).map((v) => ({ value: v, label: t(`databases.size.${v}`) }))} />
          </div>
          <Switch label={t("databases.showCover")} checked={cfg.showCover !== false} onChange={(v) => set({ showCover: v })} />
          <Switch label={t("databases.containCover")} checked={cfg.coverFit === "contain"} disabled={cfg.showCover === false} onChange={(v) => set({ coverFit: v ? "contain" : "cover" })} />
        </>
      )}
      <div className="flex flex-col gap-1">
        <span className="text-[length:var(--text-ui-small-size)] font-medium">{t("databases.visibleProps")}</span>
        {snap.properties.length === 0 && <span className="text-[length:var(--text-ui-small-size)] text-[var(--c-text-muted)]">{t("databases.noProps")}</span>}
        {snap.properties.map((p) => <Checkbox key={p.id} label={p.name} checked={visible.includes(p.id)} onChange={(v) => toggle(p.id, v)} />)}
      </div>
    </div>
  );
}
