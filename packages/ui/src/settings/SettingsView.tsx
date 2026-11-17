import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ACTIONS, comboFromEvent, defaultBindings, setBinding, type Bindings } from "@vnote/core";
import { useTheme, type PreferenceStore, type ThemeMode } from "../theme/theme";
import { displayCombo, loadBindings, saveBindings } from "./bindingsStore";
import { useGlobalShortcutState } from "../capture/globalShortcut";
import { AppearancePanel } from "./AppearancePanel";
import { UnsplashPanel } from "./UnsplashPanel";
import { Button } from "../components/Button";
import { IconButton } from "../components/IconButton";
import { ViewLayout, ViewSection } from "../components/ViewLayout";
import { INPUT, MUTED } from "../components/formStyles";

type Pending = { actionId: string; combo: string; others: string[] };

export function SettingsView({ preferences }: { preferences: PreferenceStore }) {
  const { t, i18n } = useTranslation();
  const { mode, setMode } = useTheme();
  const [bindings, setBindings] = useState<Bindings>(() => loadBindings(preferences));
  const [capturing, setCapturing] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const globalShortcut = useGlobalShortcutState();

  const commit = (b: Bindings) => { saveBindings(preferences, b); setBindings(b); };
  const labelOf = (id: string) => t(ACTIONS.find((a) => a.id === id)?.labelKey ?? id);

  useEffect(() => {
    if (!capturing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); setCapturing(null); return; }
      const combo = comboFromEvent(e);
      if (combo === null) return;
      e.preventDefault();
      e.stopPropagation();
      const r = setBinding(bindings, capturing, combo);
      if (r.ok) commit(r.bindings);
      else setPending({ actionId: capturing, combo, others: r.conflictsWith });
      setCapturing(null);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [capturing, bindings]);

  const SETTING = "flex flex-wrap items-center justify-between gap-x-6 gap-y-1 border-b border-[var(--c-border)] px-4 py-3 last:border-b-0";
  const KBD = "inline-flex min-h-6 items-center rounded border border-[var(--c-border)] bg-[var(--c-raised)] px-1.5 font-mono text-[length:var(--text-note-size)]";

  return (
    <ViewLayout title={t("settings.title")}>
      <ViewSection title={t("settings.general")} flush>
        <label className={SETTING}><span className="font-medium">{t("settings.theme")}</span>
          <select value={mode} onChange={(e) => setMode(e.target.value as ThemeMode)} className={`${INPUT} max-w-56`}>
            <option value="system">{t("theme.system")}</option>
            <option value="light">{t("theme.light")}</option>
            <option value="dark">{t("theme.dark")}</option>
          </select>
        </label>
        <label className={SETTING}><span className="font-medium">{t("settings.language")}</span>
          <select
            value={i18n.language === "en" ? "en" : "es-MX"}
            onChange={(e) => { preferences.set("language", e.target.value); void i18n.changeLanguage(e.target.value); }}
            className={`${INPUT} max-w-56`}
          >
            <option value="es-MX">{t("settings.spanish")}</option>
            <option value="en">{t("settings.english")}</option>
          </select>
        </label>
      </ViewSection>

      <AppearancePanel preferences={preferences} />

      <UnsplashPanel />

      {globalShortcut && (
        <section role="region" aria-label={t("capture.globalTitle")}>
          <ViewSection title={t("capture.globalTitle")}>
            <div className="text-[length:var(--text-ui-size)]">
              {globalShortcut.status === "active" && <p role="status">{t("capture.globalActive")}</p>}
              {globalShortcut.status === "off" && <p className="text-[var(--c-text-muted)]">{t("capture.globalOff")}</p>}
              {globalShortcut.status === "unavailable" && (
                <div role="alert" className="flex flex-col gap-2">
                  <p>{t("capture.globalUnavailable")}{globalShortcut.message ? ` (${globalShortcut.message})` : ""}</p>
                  <p>{t("capture.globalHowTo")}</p>
                  <code className="block overflow-x-auto rounded bg-[var(--c-raised)] p-2 font-mono text-[length:var(--text-ui-small-size)]">{globalShortcut.command}</code>
                  <p className={MUTED}>{t("capture.globalFallback")}</p>
                </div>
              )}
            </div>
          </ViewSection>
        </section>
      )}

      <ViewSection title={t("shortcuts.title")} flush actions={<Button size="sm" variant="ghost" onClick={() => commit(defaultBindings())}>{t("shortcuts.reset")}</Button>}>
        {pending && (
          <div role="alert" className="m-3 rounded-md bg-[var(--chip-warning-bg)] p-3 text-[length:var(--text-ui-size)] text-[var(--chip-warning-fg)]">
            <p>{t("shortcuts.conflict", { combo: displayCombo(pending.combo, ""), other: pending.others.map(labelOf).join(", ") })}</p>
            <div className="mt-2 flex gap-2">
              <Button size="sm" onClick={() => {
                const r = setBinding(bindings, pending.actionId, pending.combo, { takeFromOthers: true });
                if (r.ok) commit(r.bindings);
                setPending(null);
              }}>{t("shortcuts.useHere")}</Button>
              <Button size="sm" onClick={() => setPending(null)}>{t("shortcuts.keepOther")}</Button>
            </div>
          </div>
        )}
        <table className="w-full text-[length:var(--text-ui-size)]">
          <thead className="sr-only"><tr><th scope="col">{t("shortcuts.action")}</th><th scope="col">{t("shortcuts.shortcut")}</th><th /></tr></thead>
          <tbody>
            {ACTIONS.map((a) => (
              <tr key={a.id} className="border-b border-[var(--c-border)] last:border-b-0 hover:bg-[var(--c-raised)]">
                <td className="py-1.5 pl-4">{t(a.labelKey)}</td>
                <td className="py-1.5 text-right">{capturing === a.id ? <span className="text-[var(--c-accent)]">{t("shortcuts.press")}</span> : <kbd className={KBD}>{displayCombo(bindings[a.id] ?? null, t("shortcuts.none"))}</kbd>}</td>
                <td className="w-12 py-1.5 pr-2 text-right"><IconButton icon="edit" label={t("shortcuts.change", { action: t(a.labelKey) })} onClick={() => { setPending(null); setCapturing(a.id); }} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </ViewSection>
    </ViewLayout>
  );
}
