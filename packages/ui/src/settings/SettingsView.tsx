import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ACTIONS, comboFromEvent, defaultBindings, setBinding, type Bindings } from "@vnote/core";
import { useTheme, type PreferenceStore, type ThemeMode } from "../theme/theme";
import { displayCombo, loadBindings, saveBindings } from "./bindingsStore";
import { useGlobalShortcutState } from "../capture/globalShortcut";

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

  return (
    <section aria-label={t("settings.title")} className="flex max-w-2xl flex-col gap-4 p-4">
      <h1 className="text-xl font-semibold">{t("settings.title")}</h1>
      <label className="flex flex-col gap-1">{t("settings.theme")}
        <select value={mode} onChange={(e) => setMode(e.target.value as ThemeMode)} className="rounded border px-2 py-1">
          <option value="system">{t("theme.system")}</option>
          <option value="light">{t("theme.light")}</option>
          <option value="dark">{t("theme.dark")}</option>
        </select>
      </label>
      <label className="flex flex-col gap-1">{t("settings.language")}
        <select
          value={i18n.language === "en" ? "en" : "es-MX"}
          onChange={(e) => { preferences.set("language", e.target.value); void i18n.changeLanguage(e.target.value); }}
          className="rounded border px-2 py-1"
        >
          <option value="es-MX">{t("settings.spanish")}</option>
          <option value="en">{t("settings.english")}</option>
        </select>
      </label>

      {globalShortcut && (
        <section role="region" aria-label={t("capture.globalTitle")} className="rounded border p-2 text-sm">
          <h2 className="text-lg font-semibold">{t("capture.globalTitle")}</h2>
          {globalShortcut.status === "active" && <p role="status">{t("capture.globalActive")}</p>}
          {globalShortcut.status === "off" && <p>{t("capture.globalOff")}</p>}
          {globalShortcut.status === "unavailable" && (
            <div role="alert" className="flex flex-col gap-1">
              <p>{t("capture.globalUnavailable")}{globalShortcut.message ? ` (${globalShortcut.message})` : ""}</p>
              <p>{t("capture.globalHowTo")}</p>
              <code className="block rounded bg-black/10 p-1">{globalShortcut.command}</code>
              <p>{t("capture.globalFallback")}</p>
            </div>
          )}
        </section>
      )}

      <h2 className="text-lg font-semibold">{t("shortcuts.title")}</h2>
      {pending && (
        <div role="alert" className="rounded border border-amber-500 bg-amber-50 p-2 text-sm text-amber-900">
          <p>{t("shortcuts.conflict", { combo: displayCombo(pending.combo, ""), other: pending.others.map(labelOf).join(", ") })}</p>
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={() => {
              const r = setBinding(bindings, pending.actionId, pending.combo, { takeFromOthers: true });
              if (r.ok) commit(r.bindings);
              setPending(null);
            }}>{t("shortcuts.useHere")}</button>
            <button type="button" onClick={() => setPending(null)}>{t("shortcuts.keepOther")}</button>
          </div>
        </div>
      )}
      <table className="text-sm">
        <thead><tr><th scope="col" className="text-left">{t("shortcuts.action")}</th><th scope="col" className="text-left">{t("shortcuts.shortcut")}</th><th /></tr></thead>
        <tbody>
          {ACTIONS.map((a) => (
            <tr key={a.id}>
              <td>{t(a.labelKey)}</td>
              <td><kbd>{capturing === a.id ? t("shortcuts.press") : displayCombo(bindings[a.id] ?? null, t("shortcuts.none"))}</kbd></td>
              <td><button type="button" aria-label={t("shortcuts.change", { action: t(a.labelKey) })} onClick={() => { setPending(null); setCapturing(a.id); }}>✎</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <button type="button" className="self-start" onClick={() => commit(defaultBindings())}>{t("shortcuts.reset")}</button>
    </section>
  );
}
