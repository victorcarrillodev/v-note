import { useCallback, useEffect, useState, type FormEvent } from "react";
import { InlineAlert } from "../components/InlineAlert";
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { useTranslation } from "react-i18next";
import type { BackupService, BackupSettings, BackupStatus } from "@vnote/core";

export function BackupPanel({ service, platform = "desktop" }: { service: BackupService; platform?: "desktop" | "web" }) {
  const { t, i18n } = useTranslation();
  const [settings, setSettings] = useState<BackupSettings | null>(null);
  const [status, setStatus] = useState<BackupStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ token: "", owner: "", repo: "" });
  const [connectError, setConnectError] = useState<string | null>(null);
  const [askPublic, setAskPublic] = useState(false);
  const [tokenNotSaved, setTokenNotSaved] = useState(false);

  const load = useCallback(async () => {
    setSettings(await service.getSettings());
    setStatus(await service.getStatus());
  }, [service]);
  useEffect(() => { void load(); return service.subscribe(() => void load()); }, [service, load]);

  const when = (ms: number | null) => (ms === null ? t("backup.never") : new Date(ms).toLocaleString(i18n.language));
  const errorText = (kind: string) => t(`backup.error.${kind}`, { defaultValue: t("backup.error.UNKNOWN") });

  const connect = async (confirmPublic = false) => {
    setConnectError(null);
    setBusy(true);
    const r = await service.connect({ ...form, confirmPublic });
    setBusy(false);
    if (r.ok) {
      setForm({ token: "", owner: "", repo: "" }); // el token no se conserva en pantalla
      setAskPublic(false);
      setTokenNotSaved(!r.value.tokenPersisted);
    } else if (r.error.code === "NEEDS_CONFIRMATION") setAskPublic(true);
    else setConnectError(r.error.details && "kind" in r.error.details ? errorText(String(r.error.details.kind)) : r.error.message);
    await load();
  };
  const onSubmit = (e: FormEvent) => { e.preventDefault(); void connect(); };
  const run = async () => { setBusy(true); await service.runNow(); setBusy(false); };

  if (!settings || !status) return <p role="status">{t("app.loading")}</p>;

  return (
    <section aria-label={t("backup.title")} className="flex flex-col gap-4 p-4">
      <h1 className="text-xl font-semibold">{t("backup.title")}</h1>
      {platform === "web" && (
        <div role="note" className="rounded border border-[var(--c-warning)] bg-[var(--chip-warning-bg)] p-2 text-sm text-[var(--chip-warning-fg)]">
          <p>{t("backup.webNotice")}</p>
          <p>{t("backup.independentNotice")}</p>
        </div>
      )}

      {!status.connected ? (
        <form onSubmit={onSubmit} className="flex max-w-md flex-col gap-2">
          <label className="flex flex-col gap-1">{t("backup.token")}
            <input type="password" autoComplete="off" value={form.token} onChange={(e) => setForm({ ...form, token: e.target.value })} className="rounded border px-2 py-1" />
          </label>
          <label className="flex flex-col gap-1">{t("backup.owner")}
            <input value={form.owner} onChange={(e) => setForm({ ...form, owner: e.target.value })} className="rounded border px-2 py-1" />
          </label>
          <label className="flex flex-col gap-1">{t("backup.repo")}
            <input value={form.repo} onChange={(e) => setForm({ ...form, repo: e.target.value })} className="rounded border px-2 py-1" />
          </label>
          {connectError && <InlineAlert tone="error">{connectError}</InlineAlert>}
          <button type="submit" disabled={busy} className="self-start rounded border px-3 py-1">{t("backup.connect")}</button>
        </form>
      ) : (
        <>
          <div className="flex items-center gap-3">
            <p className="font-medium">{settings.owner}/{settings.repo}</p>
            <button type="button" onClick={() => void service.disconnect()}>{t("backup.disconnect")}</button>
          </div>
          {tokenNotSaved && <p role="note" className="text-sm text-[var(--chip-warning-fg)]">{t("backup.tokenNotSaved")}</p>}

          <label className="flex items-center gap-2">{t("backup.frequency")}
            <select value={String(settings.frequencyDays)} onChange={(e) => void service.setFrequency(Number(e.target.value))} className="rounded border px-2 py-1">
              {[1, 2, 3, 4, 5, 6, 7].map((d) => <option key={d} value={String(d)}>{t("backup.everyDays", { count: d })}</option>)}
            </select>
          </label>

          <div>
            <button type="button" disabled={busy} onClick={() => void run()} className="rounded border px-3 py-1 disabled:opacity-50">
              {busy ? t("backup.running") : t("backup.runNow")}
            </button>
          </div>

          {status.alert?.type === "failed" && (
            <InlineAlert tone="error" title={errorText(String(status.alert.kind))} action={{ label: t("backup.retry"), onClick: () => void run() }}>
              {status.alert.suggestions && (
                <>
                  <p className="mt-2 font-medium">{t("backup.suggestionsTitle")}</p>
                  <ul className="list-disc pl-5">{status.alert.suggestions.map((s) => <li key={s}>{t(`backup.suggestion.${s}`)}</li>)}</ul>
                </>
              )}
            </InlineAlert>
          )}
          {status.paused && status.alert === null && <InlineAlert tone="warning">{t("backup.paused")}</InlineAlert>}

          <div className="text-sm">
            <p>{t("backup.lastSuccess", { when: when(status.lastSuccessAt) })}</p>
            {status.nextDueAt !== null && <p>{t("backup.nextDue", { when: when(status.nextDueAt) })}</p>}
            {status.retryAt !== null && <p>{t("backup.retryingAt", { when: when(status.retryAt) })}</p>}
          </div>

          <ul aria-label={t("backup.history")} className="flex flex-col gap-1 text-sm">
            {status.history.map((h) => (
              <li key={h.id} className="flex gap-2">
                <span>{when(h.finishedAt)}</span>
                <span>{t(`backup.status.${h.status}`)}</span>
                {h.errorKind && <span className="opacity-70">{errorText(h.errorKind)}</span>}
              </li>
            ))}
          </ul>
        </>
      )}

      <AlertDialog.Root open={askPublic} onOpenChange={(o) => !o && setAskPublic(false)}>
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="fixed inset-0 bg-black/40" />
          <AlertDialog.Content className="fixed left-1/2 top-1/2 w-96 -translate-x-1/2 -translate-y-1/2 rounded bg-[var(--bg)] p-4 shadow">
            <AlertDialog.Title className="font-semibold">{t("backup.publicRepo.title")}</AlertDialog.Title>
            <AlertDialog.Description className="my-2 text-sm">{t("backup.publicRepo.body")}</AlertDialog.Description>
            <div className="flex justify-end gap-2">
              <AlertDialog.Cancel asChild><button type="button">{t("backup.publicRepo.cancel")}</button></AlertDialog.Cancel>
              <button type="button" onClick={() => void connect(true)}>{t("backup.publicRepo.confirm")}</button>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>

      <AlertDialog.Root open={status.alert?.type === "needs_decision"}>
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="fixed inset-0 bg-black/40" />
          <AlertDialog.Content className="fixed left-1/2 top-1/2 w-[28rem] -translate-x-1/2 -translate-y-1/2 rounded bg-[var(--bg)] p-4 shadow">
            <AlertDialog.Title className="font-semibold">{t("backup.decision.title")}</AlertDialog.Title>
            <AlertDialog.Description className="my-2 text-sm">{t("backup.decision.body")}</AlertDialog.Description>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => void service.resolveExternalChange("cancel")}>{t("backup.decision.cancel")}</button>
              <button type="button" onClick={() => void service.resolveExternalChange("continue")}>{t("backup.decision.continue")}</button>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </section>
  );
}
