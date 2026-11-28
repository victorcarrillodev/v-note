import { coreText } from "../i18n/coreText";
import { useEffect, useState, type FormEvent, useRef } from "react";
import { useTranslation } from "react-i18next";
import { GITHUB_BACKUP_ACCOUNT, OAuthTokenStore, connectOAuth, type DestinationConfig, type FetchLike, type Keychain, type OAuthPort, type OAuthProviderId, type UnifiedBackupController } from "@vnote/core";
import { Button } from "../components/Button";
import { Dropdown } from "../components/ChoiceMenu";
import { InlineAlert } from "../components/InlineAlert";
import { ViewSection } from "../components/ViewLayout";
import { FIELD, INPUT, MUTED } from "../components/formStyles";
import type { PreferenceStore } from "../theme/theme";
import { loadUnifiedConfig, saveUnifiedConfig, type UnifiedConfig } from "./unifiedConfig";

/** Client ID del destino OAuth configurado (vacío si el destino no lo usa). */
const clientIdOf = (d: DestinationConfig): string => ("clientId" in d ? d.clientId : "");

type Props = {
  controller: Pick<UnifiedBackupController, "status" | "onStatus" | "syncNow" | "setContinuous" | "destinationChanged">;
  preferences: PreferenceStore;
  keychain: Keychain;
  fetch: FetchLike;
  /** Solo escritorio: diálogo nativo de carpeta. Sin él no hay destino «carpeta local». */
  pickFolder?: (() => Promise<string | null>) | undefined;
  /** Solo escritorio: retorno de OAuth. Sin él no hay Google Drive ni Dropbox. */
  oauth?: OAuthPort | undefined;
  onRestoreAll: () => void;
};

/** Respaldo unificado (todos los espacios en un solo destino que se actualiza in-place). */
export function UnifiedBackupPanel({ controller, preferences, keychain, fetch, pickFolder, oauth, onRestoreAll }: Props) {
  const { t, i18n } = useTranslation();
  const [cfg, setCfg] = useState<UnifiedConfig>(() => loadUnifiedConfig(preferences));
  const [status, setStatus] = useState(controller.status());
  const [form, setForm] = useState({ token: "", owner: "", repo: "", clientId: "", folderId: "" });
  const [msg, setMsg] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [connected, setConnected] = useState(false);

  useEffect(() => controller.onStatus(setStatus), [controller]);
  const kind = cfg.destination.kind;
  const provider: OAuthProviderId | null = kind === "google-drive" || kind === "dropbox" ? kind : null;

  useEffect(() => {
    if (!provider) { setConnected(false); return; }
    let live = true;
    const clientId = clientIdOf(cfg.destination);
    void new OAuthTokenStore({ keychain, fetch, provider, clientId }).isConnected().then((c) => { if (live) setConnected(c); });
    return () => { live = false; };
  }, [provider, cfg.destination, keychain, fetch]);

  const commit = (next: UnifiedConfig) => { setCfg(next); saveUnifiedConfig(preferences, next); controller.destinationChanged(); };

  const options: { value: DestinationConfig["kind"]; label: string }[] = [
    ...(pickFolder ? [{ value: "local-folder" as const, label: t("backupAll.localFolder") }] : []),
    ...(oauth ? [{ value: "google-drive" as const, label: t("backupAll.googleDrive") }, { value: "dropbox" as const, label: t("backupAll.dropbox") }] : []),
    { value: "github", label: t("backupAll.github") },
  ];

  const chooseKind = (k: DestinationConfig["kind"]) => {
    setMsg(null);
    const destination: DestinationConfig =
      k === "local-folder" ? { kind: k } : k === "github" ? { kind: k, owner: "", repo: "" } : k === "google-drive" ? { kind: k, clientId: "", folderId: "root" } : { kind: k, clientId: "" };
    commit({ ...cfg, destination });
  };

  const pick = async () => {
    const path = await pickFolder?.();
    if (path) commit({ ...cfg, folderPath: path });
  };

  const saveDestination = async (e: FormEvent) => {
    e.preventDefault();
    setMsg(null);
    try {
      if (kind === "github") {
        if (form.token.trim()) await keychain.set(GITHUB_BACKUP_ACCOUNT, form.token.trim());
        commit({ ...cfg, destination: { kind: "github", owner: form.owner.trim(), repo: form.repo.trim() } });
        setForm((f) => ({ ...f, token: "" })); // el token no se conserva en pantalla
      } else if (kind === "google-drive") {
        commit({ ...cfg, destination: { kind, clientId: form.clientId.trim(), folderId: form.folderId.trim() || "root" } });
      } else if (kind === "dropbox") {
        commit({ ...cfg, destination: { kind, clientId: form.clientId.trim() } });
      }
      setMsg({ tone: "success", text: t("backupAll.saved") });
    } catch (err) {
      setMsg({ tone: "error", text: err instanceof Error ? err.message : String(err) });
    }
  };

  const [connecting, setConnecting] = useState(false);
  const cancelled = useRef(false);
  // Salir de la pantalla no deja el puerto local esperando.
  useEffect(() => () => { void oauth?.cancel?.(); }, [oauth]);

  const connect = async () => {
    if (!oauth || !provider) return;
    const clientId = clientIdOf(cfg.destination);
    if (!clientId) { setMsg({ tone: "error", text: t("backupAll.needClientId") }); return; }
    setBusy(true);
    setConnecting(true);
    cancelled.current = false;
    let r: Awaited<ReturnType<typeof connectOAuth>>;
    try {
      r = await connectOAuth({ port: oauth, fetch, provider, clientId, keychain });
    } catch (err) {
      r = { ok: false, message: err instanceof Error ? err.message : String(err) };
    } finally {
      setBusy(false);
      setConnecting(false);
    }
    if (!r.ok && cancelled.current) { setMsg(null); return; }
    if (r.ok) { setConnected(true); controller.destinationChanged(); setMsg({ tone: "success", text: t("backupAll.connected") }); }
    else setMsg({ tone: "error", text: coreText(r.message) });
  };

  const cancelConnect = () => { cancelled.current = true; void oauth?.cancel?.(); };

  const disconnect = async () => {
    if (!provider) return;
    try {
      await new OAuthTokenStore({ keychain, fetch, provider, clientId: clientIdOf(cfg.destination) }).clear();
      setConnected(false);
      controller.destinationChanged();
    } catch (err) {
      setMsg({ tone: "error", text: err instanceof Error ? err.message : String(err) });
    }
  };

  const runNow = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const o = await controller.syncNow();
      if (o.status === "failed") setMsg({ tone: "error", text: coreText(o.error.message) });
    } catch (e) {
      setMsg({ tone: "error", text: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  };

  const setContinuous = (on: boolean) => { controller.setContinuous(on); commit({ ...cfg, continuous: on }); };
  const when = (ms: number | null) => (ms === null ? t("backup.never") : new Date(ms).toLocaleString(i18n.language));
  const d = cfg.destination;

  return (
    <ViewSection title={t("backupAll.title")} hint={t("backupAll.hint")}>
      <div className="flex max-w-md flex-col gap-4">
        <label className={FIELD}>{t("backupAll.destination")}
          <Dropdown value={kind} onChange={(e) => chooseKind(e.target.value as DestinationConfig["kind"])} className={INPUT}>
            {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Dropdown>
        </label>

        {kind === "local-folder" && (
          <div className="flex flex-wrap items-center gap-3">
            <Button size="sm" onClick={() => void pick()}>{t("backupAll.pickFolder")}</Button>
            <span className={`min-w-0 flex-1 truncate ${MUTED}`}>{cfg.folderPath ?? t("backupAll.noFolder")}</span>
          </div>
        )}

        {kind !== "local-folder" && (
          <form onSubmit={(e) => void saveDestination(e)} className="flex flex-col gap-3">
            {kind === "github" && (
              <>
                <label className={FIELD}>{t("backup.token")}
                  <input type="password" autoComplete="off" value={form.token} onChange={(e) => setForm({ ...form, token: e.target.value })} className={INPUT} />
                </label>
                <label className={FIELD}>{t("backup.owner")}
                  <input value={form.owner || ("owner" in d ? d.owner : "")} onChange={(e) => setForm({ ...form, owner: e.target.value })} className={INPUT} />
                </label>
                <label className={FIELD}>{t("backup.repo")}
                  <input value={form.repo || ("repo" in d ? d.repo : "")} onChange={(e) => setForm({ ...form, repo: e.target.value })} className={INPUT} />
                </label>
                <p className={MUTED}>{t("backup.connectHint")}</p>
              </>
            )}
            {provider && (
              <>
                <label className={FIELD}>{t("backupAll.clientId")}
                  <input value={form.clientId || clientIdOf(d)} onChange={(e) => setForm({ ...form, clientId: e.target.value })} className={INPUT} />
                </label>
                {kind === "google-drive" && (
                  <label className={FIELD}>{t("backupAll.driveFolder")}
                    <input value={form.folderId || ("folderId" in d ? d.folderId : "")} onChange={(e) => setForm({ ...form, folderId: e.target.value })} className={INPUT} />
                  </label>
                )}
              </>
            )}
            <div className="flex flex-wrap gap-2">
              <Button type="submit" size="sm">{t("backupAll.save")}</Button>
              {provider && (connected
                ? <Button size="sm" onClick={() => void disconnect()}>{t("backup.disconnect")}</Button>
                : <Button size="sm" variant="primary" disabled={busy} onClick={() => void connect()}>{t("backupAll.authorize")}</Button>)}
              {connecting && oauth?.cancel && <Button size="sm" onClick={cancelConnect}>{t("backupAll.cancelAuthorize")}</Button>}
            </div>
          </form>
        )}

        <label className={FIELD}>{t("backupAll.continuous")}
          <Dropdown value={cfg.continuous ? "true" : "false"} onChange={(e) => setContinuous(e.target.value === "true")} className={INPUT}>
            <option value="true">{t("backupAll.on")}</option>
            <option value="false">{t("backupAll.off")}</option>
          </Dropdown>
        </label>
        <p className={MUTED}>{t("backupAll.continuousHint")}</p>

        {msg && <InlineAlert tone={msg.tone}>{msg.text}</InlineAlert>}
        {status.state === "error" && status.message && <InlineAlert tone="error">{coreText(status.message)}</InlineAlert>}
        {status.state === "retrying" && <InlineAlert tone="warning">{t("backupAll.retrying")}</InlineAlert>}

        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary" disabled={busy || status.state === "syncing"} onClick={() => void runNow()}>
            {status.state === "syncing" ? t("backup.running") : t("backup.runNow")}
          </Button>
          <Button onClick={onRestoreAll}>{t("backupAll.restoreAll")}</Button>
        </div>
        <p className={MUTED}>{t("backup.lastSuccess", { when: when(status.lastSyncAt) })}</p>
      </div>
    </ViewSection>
  );
}
