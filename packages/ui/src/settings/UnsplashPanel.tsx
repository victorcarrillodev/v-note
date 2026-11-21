import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "../components/Button";
import { Switch } from "../components/controls";
import { ViewSection } from "../components/ViewLayout";
import { INPUT, MUTED } from "../components/formStyles";
import { ExternalLink } from "../components/ExternalLink";
import { useUnsplash } from "../unsplash/UnsplashContext";

/** Dirección de la página de desarrolladores donde se obtiene una clave (RF-9.1). */
export const UNSPLASH_DEVELOPERS_URL = "https://unsplash.com/developers";

/**
 * Ajustes de Unsplash (RF-9): interruptor de la preferencia (apagado por defecto), qué sale del equipo al usarlo,
 * la clave de acceso (en el llavero del sistema; en la web solo dura la sesión) y el enlace para obtenerla.
 */
export function UnsplashPanel() {
  const { t } = useTranslation();
  const u = useUnsplash();
  const [key, setKey] = useState("");
  const [hasKey, setHasKey] = useState(false);
  const [note, setNote] = useState<{ tone: "ok" | "warn" | "error"; text: string } | null>(null);
  const keyStore = u.keyStore;
  useEffect(() => {
    let alive = true;
    void keyStore?.get().then((k) => { if (alive) setHasKey(!!k); });
    return () => { alive = false; };
  }, [keyStore]);
  if (!u.supported) return null;
  const save = async () => {
    const r = await u.keyStore!.set(key);
    if (!r.ok) { setNote({ tone: "error", text: t("unsplash.keyInvalid") }); return; }
    setKey(""); setHasKey(true);
    setNote(r.value.persisted ? { tone: "ok", text: t("unsplash.keySaved") } : { tone: "warn", text: t("unsplash.keyNotPersisted") });
  };
  return (
    <section role="region" aria-label={t("unsplash.settingsTitle")}>
      <ViewSection title={t("unsplash.settingsTitle")}>
        <div className="flex flex-col gap-3 text-[length:var(--text-ui-size)]">
          <Switch label={t("unsplash.enable")} checked={u.enabled} onChange={u.setEnabled} />
          <p className={MUTED}>{t("unsplash.explain")}</p>
          <div className="flex flex-col gap-1">
            <label htmlFor="unsplash-key" className="text-[length:var(--text-ui-small-size)] font-medium">{t("unsplash.keyLabel")}</label>
            <div className="flex flex-wrap items-center gap-2">
              <input id="unsplash-key" type="password" autoComplete="off" spellCheck={false} placeholder={hasKey ? "••••••••••••••••" : ""} value={key} onChange={(e) => { setKey(e.target.value); setNote(null); }} className={`${INPUT} max-w-80`} />
              <Button size="sm" onClick={() => void save()} disabled={key.trim() === ""}>{t("unsplash.saveKey")}</Button>
              <Button size="sm" variant="ghost" disabled={!hasKey} onClick={() => void u.keyStore!.clear().then(() => { setHasKey(false); setNote({ tone: "ok", text: t("unsplash.keyCleared") }); })}>{t("unsplash.clearKey")}</Button>
            </div>
            {hasKey && <p role="status" className="text-[var(--chip-success-fg)]">{t("unsplash.keyRegistered")}</p>}
            <p className={MUTED}>{u.platform === "web" ? t("unsplash.keyHintWeb") : t("unsplash.keyHint")}</p>
            {note && <p role={note.tone === "error" ? "alert" : "status"} className={note.tone === "error" ? "text-[var(--c-danger)]" : note.tone === "warn" ? "text-[var(--chip-warning-fg)]" : MUTED}>{note.text}</p>}
          </div>
          <ExternalLink href={UNSPLASH_DEVELOPERS_URL} className="self-start text-[var(--c-accent)] underline-offset-2 hover:underline">{t("unsplash.getKey")}</ExternalLink>
        </div>
      </ViewSection>
    </section>
  );
}
