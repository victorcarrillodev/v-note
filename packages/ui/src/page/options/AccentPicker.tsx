import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ACCENT_COLUMNS, GRADIENT_ACCENTS, PASTEL_ACCENTS, VIVID_ACCENTS, accentSwatch, parseCustomAccent, type CustomAccent, type PageStyle } from "@vnote/core";
import { Button } from "../../components/Button";
import { Checkbox, ColorInput } from "../../components/controls";
import { cx } from "../../design/cx";
import { addSavedAccent, loadSavedAccents, removeSavedAccent } from "./savedAccents";

type Accent = PageStyle["accent"];
type Tab = "vivid" | "pastel" | "gradient" | "mine";
const TABS: Tab[] = ["vivid", "pastel", "gradient", "mine"];

const GRID_SWATCH = "aspect-square w-full rounded-full aria-checked:outline aria-checked:outline-2 aria-checked:outline-offset-1 aria-checked:outline-[var(--c-text)]";
const SWATCH = "h-7 w-7 rounded-full aria-checked:outline aria-checked:outline-2 aria-checked:outline-offset-2 aria-checked:outline-[var(--c-text)] [@media(pointer:coarse)]:h-9 [@media(pointer:coarse)]:w-9";

/**
 * Color de acento de la página: «Predeterminado», tres paletas de 66 (vivos, pastel y degradados) y los propios,
 * que se crean con uno o dos colores y se guardan en este dispositivo para usarlos en cualquier página.
 */
export function AccentPicker({ value, onChange, label, allowDefault = true }: { value: Accent; onChange: (v: Accent) => void; label?: string; allowDefault?: boolean }) {
  const { t } = useTranslation();
  const title = label ?? t("pageOptions.page.accent");
  const [tab, setTab] = useState<Tab>(() => (value?.includes("~") ? "gradient" : "vivid"));
  const [saved, setSaved] = useState<CustomAccent[]>(() => loadSavedAccents());
  const [gradient, setGradient] = useState(false);
  const [c1, setC1] = useState<string>(VIVID_ACCENTS[22]!);
  const [c2, setC2] = useState<string>(VIVID_ACCENTS[28]!);
  const draft = parseCustomAccent(gradient ? `${c1}~${c2}` : c1)!;

  const swatch = (v: string, label: string, bg: string, key = v) => (
    <button key={key} type="button" role="radio" aria-checked={value === v} aria-label={label} title={label} data-accent={v} onClick={() => onChange(v as Accent)} style={{ background: bg }} className={tab === "mine" ? SWATCH : GRID_SWATCH} />
  );
  const palette = (list: readonly CustomAccent[], group: string) => list.map((v, i) => swatch(v, `${t(`pageOptions.accent.${group}`)} ${i + 1}`, accentSwatch(v)));

  return (
    <div className="flex flex-col gap-2">
      <span className="text-[length:var(--text-ui-small-size)] font-medium">{title}</span>
      {allowDefault && (
        <button type="button" role="radio" aria-checked={value === undefined} onClick={() => onChange(undefined)}
          className="h-8 self-start rounded-[var(--radius-md)] border border-[var(--c-border-control)] px-2 text-[length:var(--text-ui-small-size)] aria-checked:border-[var(--c-accent)] aria-checked:font-semibold [@media(pointer:coarse)]:h-11">{t("pageOptions.default")}</button>
      )}
      <div role="tablist" aria-label={title} className="flex flex-wrap gap-1">
        {TABS.map((id) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} data-accent-tab={id} onClick={() => setTab(id)}
            className={cx("h-7 rounded-full px-2.5 text-[length:var(--text-ui-small-size)] hover:bg-[var(--c-raised)] [@media(pointer:coarse)]:h-9", tab === id && "bg-[var(--c-raised)] font-semibold")}>{t(`pageOptions.accent.tabs.${id}`)}</button>
        ))}
      </div>
      <div role="radiogroup" aria-label={t(`pageOptions.accent.tabs.${tab}`)} className={tab === "mine" ? "flex flex-wrap gap-1.5" : "grid gap-1.5"} style={tab === "mine" ? undefined : { gridTemplateColumns: `repeat(${ACCENT_COLUMNS}, minmax(0, 1fr))` }}>
        {tab === "vivid" && palette(VIVID_ACCENTS, "vivid")}
        {tab === "pastel" && palette(PASTEL_ACCENTS, "pastel")}
        {tab === "gradient" && palette(GRADIENT_ACCENTS, "gradient")}
        {tab === "mine" && saved.map((v, i) => swatch(v, `${t("pageOptions.accent.mine")} ${i + 1}`, accentSwatch(v)))}
      </div>
      {tab === "mine" && (
        <div className="flex flex-col gap-2" data-accent-creator>
          {saved.length === 0 && <p className="text-[length:var(--text-note-size)] text-[var(--c-text-muted)]">{t("pageOptions.accent.noneSaved")}</p>}
          <div className="flex flex-wrap items-center gap-2">
            <ColorInput label={t("pageOptions.accent.color1")} value={c1} onChange={setC1} />
            {gradient && <ColorInput label={t("pageOptions.accent.color2")} value={c2} onChange={setC2} />}
            <Checkbox label={t("pageOptions.accent.gradientOn")} checked={gradient} onChange={setGradient} />
            <span aria-hidden="true" data-accent-preview style={{ background: accentSwatch(draft) }} className="h-7 w-12 rounded-full" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => { setSaved(addSavedAccent(draft)); onChange(draft); }}>{t("pageOptions.accent.save")}</Button>
            {value !== undefined && saved.includes(value as CustomAccent) && (
              <Button size="sm" onClick={() => { setSaved(removeSavedAccent(value)); onChange(undefined); }}>{t("pageOptions.accent.remove")}</Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
