import { coreText } from "../i18n/coreText";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { InlineAlert } from "../components/InlineAlert";
import { Button } from "../components/Button";
import { Chip } from "../components/Chip";
import { ViewLayout, ViewSection, VIEW_ROW } from "../components/ViewLayout";
import { FIELD, INPUT, MUTED } from "../components/formStyles";
import { Icon } from "../design/Icon";
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { useTranslation } from "react-i18next";
import type { BackupService, BackupSettings, BackupStatus } from "@vnote/core";
import { Dropdown } from "../components/ChoiceMenu";

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
    else setConnectError(r.error.details && "kind" in r.error.details ? errorText(String(r.error.details.kind)) : coreText(r.error.message));
    await load();
  };
  const onSubmit = (e: FormEvent) => { e.preventDefault(); void connect(); };
  const run = async () => { setBusy(true); await service.runNow(); setBusy(false); };

  if (!settings || !status) return <p role="status">{t("app.loading")}</p>;

  const DIALOG = "fixed left-1/2 top-1/3 z-[var(--z-dialog)] w-[var(--size-modal-s)] max-w-[calc(100vw-var(--space-12))] -translate-x-1/2 rounded-lg border border-[var(--c-border)] bg-[var(--c-card)] p-6 shadow-[var(--elevation-4)]";
  const SCRIM = "fixed inset-0 z-[var(--z-scrim)] bg-[var(--c-scrim)]";
  const DIALOG_TITLE = "text-[length:var(--text-dialog-title-size)] font-semibold text-[var(--c-text)]";
  const DIALOG_BODY = "mt-2 text-[length:var(--text-ui-size)] text-[var(--c-text-muted)]";
  const statusTone = (st: string) => (st === "success" ? "success" : st === "failed" ? "error" : st === "needs_decision" ? "warning" : "neutral") as "success" | "error" | "warning" | "neutral";

  return (
    <ViewLayout title={t("backup.title")} description={t("backup.hint")}>
      {platform === "web" && (
        <div role="note" className="flex items-start gap-2 rounded-md bg-[var(--chip-warning-bg)] p-3 text-[length:var(--text-ui-size)] text-[var(--chip-warning-fg)]">
          <span className="mt-0.5 shrink-0"><Icon name="info" size={20} /></span>
          <div>
            <p>{t("backup.webNotice")}</p>
            <p>{t("backup.independentNotice")}</p>
          </div>
        </div>
      )}

      {!status.connected ? (
        <ViewSection title={t("backup.connectSection")} hint={t("backup.connectHint")}>
          <form onSubmit={onSubmit} className="flex max-w-md flex-col gap-3">
            <label className={FIELD}>{t("backup.token")}
              <input type="password" autoComplete="off" value={form.token} onChange={(e) => setForm({ ...form, token: e.target.value })} className={INPUT} />
            </label>
            <label className={FIELD}>{t("backup.owner")}
              <input value={form.owner} onChange={(e) => setForm({ ...form, owner: e.target.value })} className={INPUT} />
            </label>
            <label className={FIELD}>{t("backup.repo")}
              <input value={form.repo} onChange={(e) => setForm({ ...form, repo: e.target.value })} className={INPUT} />
            </label>
            {connectError && <InlineAlert tone="error">{connectError}</InlineAlert>}
            <Button type="submit" variant="primary" disabled={busy} className="mt-1 self-start">{t("backup.connect")}</Button>
          </form>
        </ViewSection>
      ) : (
        <>
          <ViewSection>
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center gap-3">
                <span className="shrink-0 text-[var(--c-text-muted)]"><Icon name="backup" size={20} /></span>
                <p className="min-w-0 flex-1 truncate font-medium">{settings.owner}/{settings.repo}</p>
                <Button size="sm" onClick={() => void service.disconnect()}>{t("backup.disconnect")}</Button>
              </div>
              {tokenNotSaved && <p role="note" className="text-[length:var(--text-ui-small-size)] text-[var(--chip-warning-fg)]">{t("backup.tokenNotSaved")}</p>}

              <div className="flex flex-wrap items-end justify-between gap-3 border-t border-[var(--c-border)] pt-4">
                <label className={FIELD}>{t("backup.frequency")}
                  <Dropdown value={String(settings.frequencyDays)} onChange={(e) => void service.setFrequency(Number(e.target.value))} className={`${INPUT} min-w-40`}>
                    {[1, 2, 3, 4, 5, 6, 7].map((d) => <option key={d} value={String(d)}>{t("backup.everyDays", { count: d })}</option>)}
                  </Dropdown>
                </label>
                <Button variant="primary" disabled={busy} onClick={() => void run()}>
                  <Icon name="backup" />{busy ? t("backup.running") : t("backup.runNow")}
                </Button>
              </div>

              <div className={`flex flex-col gap-0.5 ${MUTED}`}>
                <p>{t("backup.lastSuccess", { when: when(status.lastSuccessAt) })}</p>
                {status.nextDueAt !== null && <p>{t("backup.nextDue", { when: when(status.nextDueAt) })}</p>}
                {status.retryAt !== null && <p>{t("backup.retryingAt", { when: when(status.retryAt) })}</p>}
              </div>
            </div>
          </ViewSection>

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

          <ViewSection title={t("backup.history")} flush>
            <ul aria-label={t("backup.history")} className="flex flex-col text-[length:var(--text-ui-size)]">
              {status.history.map((h) => (
                <li key={h.id} className={VIEW_ROW}>
                  <span className="tabular-nums">{when(h.finishedAt)}</span>
                  <Chip tone={statusTone(h.status)}>{t(`backup.status.${h.status}`)}</Chip>
                  {h.errorKind && <span className={`min-w-0 flex-1 truncate ${MUTED}`}>{errorText(h.errorKind)}</span>}
                </li>
              ))}
            </ul>
            {status.history.length === 0 && <p className={`px-4 py-3 ${MUTED}`}>{t("backup.noHistory")}</p>}
          </ViewSection>
        </>
      )}

      <AlertDialog.Root open={askPublic} onOpenChange={(o) => !o && setAskPublic(false)}>
        <AlertDialog.Portal>
          <AlertDialog.Overlay className={SCRIM} />
          <AlertDialog.Content className={DIALOG}>
            <AlertDialog.Title className={DIALOG_TITLE}>{t("backup.publicRepo.title")}</AlertDialog.Title>
            <AlertDialog.Description className={DIALOG_BODY}>{t("backup.publicRepo.body")}</AlertDialog.Description>
            <div className="mt-6 flex justify-end gap-2">
              <AlertDialog.Cancel asChild><Button>{t("backup.publicRepo.cancel")}</Button></AlertDialog.Cancel>
              <Button variant="danger" onClick={() => void connect(true)}>{t("backup.publicRepo.confirm")}</Button>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>

      <AlertDialog.Root open={status.alert?.type === "needs_decision"}>
        <AlertDialog.Portal>
          <AlertDialog.Overlay className={SCRIM} />
          <AlertDialog.Content className={DIALOG}>
            <AlertDialog.Title className={DIALOG_TITLE}>{t("backup.decision.title")}</AlertDialog.Title>
            <AlertDialog.Description className={DIALOG_BODY}>{t("backup.decision.body")}</AlertDialog.Description>
            <div className="mt-6 flex justify-end gap-2">
              <Button onClick={() => void service.resolveExternalChange("cancel")}>{t("backup.decision.cancel")}</Button>
              <Button variant="primary" onClick={() => void service.resolveExternalChange("continue")}>{t("backup.decision.continue")}</Button>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </ViewLayout>
  );
}
