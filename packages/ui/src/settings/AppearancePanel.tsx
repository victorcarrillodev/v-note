import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Segmented } from "../components/controls";
import { InlineAlert } from "../components/InlineAlert";
import { ViewSection } from "../components/ViewLayout";
import { applyAppearance, loadAppearance, saveAppearance, type Appearance } from "../design/appearance";
import type { PreferenceStore } from "../theme/theme";

/** Ajustes › Apariencia: densidad del contenido. Se aplican al instante; si no se pueden conservar, se avisa con «Reintentar». */
export function AppearancePanel({ preferences }: { preferences: PreferenceStore }) {
  const { t } = useTranslation();
  const [a, setA] = useState<Appearance>(() => loadAppearance(preferences));
  const [failed, setFailed] = useState(false);

  const change = (next: Appearance) => {
    setA(next);
    applyAppearance(document.documentElement, next); // se aplica en la sesión pase lo que pase
    setFailed(!saveAppearance(preferences, next));
  };
  return (
    <section aria-label={t("appearance.title")}>
      <ViewSection title={t("appearance.title")}>
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-6">
            <div className="flex flex-col gap-1"><span className="text-[length:var(--text-ui-small-size)] font-medium">{t("appearance.density")}</span>
              <Segmented label={t("appearance.density")} value={a.density} onChange={(v) => change({ ...a, density: v as Appearance["density"] })} options={[{ value: "comfortable", label: t("appearance.comfortable") }, { value: "compact", label: t("appearance.compact") }]} />
            </div>
          </div>
          {failed && <InlineAlert tone="warning" action={{ label: t("header.retry"), onClick: () => setFailed(!saveAppearance(preferences, a)) }}>{t("appearance.notSaved")}</InlineAlert>}
          <div data-testid="appearance-preview" data-font={a.font} data-density={a.density} className="rounded-md border border-[var(--c-border)] bg-[var(--c-canvas)] p-4" style={{ fontFamily: `var(--font-${a.font})` }}>
            <p className="font-semibold" style={{ fontSize: "var(--text-h3-size)" }}>{t("appearance.previewTitle")}</p>
            <p style={{ fontSize: a.density === "compact" ? "15px" : "var(--text-reading-size)", lineHeight: a.density === "compact" ? "22px" : "var(--text-reading-line)" }}>{t("appearance.previewBody")}</p>
          </div>
        </div>
      </ViewSection>
    </section>
  );
}
