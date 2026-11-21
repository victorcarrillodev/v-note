import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useTheme } from "../theme/theme";
import type { ThemeMode } from "../theme/resolveTheme";
import { THEMES, colorsOf, variantOf, type ThemeColors, type ThemeId } from "../design/themes";
import { Icon } from "../design/Icon";

type SwatchColors = Pick<ThemeColors, "canvas" | "sidebar" | "card" | "accent" | "onAccent" | "text">;
const pick = (c: ThemeColors): SwatchColors => ({ canvas: c.canvas, sidebar: c.sidebar, card: c.card, accent: c.accent, onAccent: c.onAccent, text: c.text });

/** Miniatura de un tema: lienzo, franja lateral, tarjeta, botón de acento y líneas de texto, con los colores del catálogo. */
export function ThemeSwatch({ colors, half }: { colors: SwatchColors; half?: "left" | "right" }) {
  return (
    <span
      aria-hidden="true"
      data-swatch={half ?? "full"}
      className="absolute inset-0 flex overflow-hidden rounded-sm"
      style={{ backgroundColor: colors.canvas, ...(half ? { clipPath: half === "left" ? "inset(0 50% 0 0)" : "inset(0 0 0 50%)" } : {}) }}
    >
      <span data-part="sidebar" className="h-full w-1/4" style={{ backgroundColor: colors.sidebar }} />
      <span className="flex flex-1 flex-col gap-1 p-1.5">
        <span data-part="card" className="flex flex-1 flex-col justify-center gap-1 rounded-sm px-1.5" style={{ backgroundColor: colors.card }}>
          <span data-part="text" className="h-0.5 w-3/4 rounded-full" style={{ backgroundColor: colors.text }} />
          <span data-part="text" className="h-0.5 w-1/2 rounded-full" style={{ backgroundColor: colors.text }} />
        </span>
        <span data-part="accent" className="flex h-2 w-1/2 items-center justify-center rounded-sm" style={{ backgroundColor: colors.accent }}>
          <span data-part="onAccent" className="block h-0.5 w-1/2 rounded-full" style={{ backgroundColor: colors.onAccent }} />
        </span>
      </span>
    </span>
  );
}

type Option = { id: ThemeId | "system" };
const GROUPS: { key: "groupSystem" | "groupLight" | "groupDark"; options: Option[] }[] = [
  { key: "groupSystem", options: [{ id: "system" }] },
  { key: "groupLight", options: [{ id: "light" }, ...THEMES.filter((t) => t.variant === "light").map((t) => ({ id: t.id }))] },
  { key: "groupDark", options: [{ id: "dark" }, ...THEMES.filter((t) => t.variant === "dark").map((t) => ({ id: t.id }))] },
];

/** Selector de tema con vista previa (spec 006, RF-2): radios nativos agrupados; las flechas y el foco los da el navegador. */
export function ThemePicker() {
  const { t } = useTranslation();
  const { mode, setMode } = useTheme();
  const [notSaved, setNotSaved] = useState(false);
  const choose = (m: ThemeMode) => setNotSaved(setMode(m) === false);

  const nameOf = (id: Option["id"]) => t(`theme.${id}`);
  const labelOf = (id: Option["id"]) => (id === "system" || id === "light" || id === "dark" ? nameOf(id) : t("theme.option", { name: nameOf(id), variant: t(variantOf(id) === "dark" ? "theme.variantDark" : "theme.variantLight") }));

  return (
    <fieldset className="flex flex-col gap-3 px-4 py-3">
      <legend className="sr-only">{t("settings.theme")}</legend>
      <div className="clear-both flex flex-col gap-3">
        {GROUPS.map((g) => (
          <div key={g.key} role="group" aria-labelledby={`theme-group-${g.key}`} className="flex flex-col gap-1.5">
            <p id={`theme-group-${g.key}`} className="text-[length:var(--text-label-size)] font-semibold uppercase text-[var(--c-text-muted)]">{t(`theme.${g.key}`)}</p>
            <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))" }}>
              {g.options.map(({ id }) => {
                const selected = mode === id;
                return (
                  <label
                    key={id}
                    data-selected={selected ? "true" : "false"}
                    className={`relative flex min-h-11 cursor-pointer flex-col gap-1 rounded-md border-2 p-1.5 focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--c-accent)] ${selected ? "border-[var(--c-accent)]" : "border-[var(--c-border)]"}`}
                  >
                    <input type="radio" name="theme" value={id} checked={selected} aria-label={labelOf(id)} onChange={() => choose(id as ThemeMode)} className="peer sr-only" />
                    <span className="relative block h-14 w-full">
                      {id === "system" ? (
                        <>
                          <ThemeSwatch colors={pick(colorsOf("light"))} half="left" />
                          <ThemeSwatch colors={pick(colorsOf("dark"))} half="right" />
                        </>
                      ) : (
                        <ThemeSwatch colors={pick(colorsOf(id))} />
                      )}
                    </span>
                    <span className="flex items-center justify-between gap-1 text-[length:var(--text-ui-small-size)] text-[var(--c-text)]">
                      <span className="truncate">{nameOf(id)}</span>
                      {selected && <span data-testid="theme-check" aria-hidden="true" className="shrink-0 text-[var(--c-accent)]"><Icon name="check" size={16} /></span>}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      {notSaved && <p role="status" className="text-[length:var(--text-ui-small-size)] text-[var(--c-warning)]">{t("theme.notSaved")}</p>}
    </fieldset>
  );
}
