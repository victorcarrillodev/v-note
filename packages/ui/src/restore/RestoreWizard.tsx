import { ConfirmDialog } from "../components/ConfirmDialog";
import { InlineAlert } from "../components/InlineAlert";
import { Button } from "../components/Button";
import { ViewLayout, ViewSection, VIEW_ROW } from "../components/ViewLayout";
import { FIELD, INPUT, MUTED } from "../components/formStyles";
import { cx } from "../design/cx";
import { Icon } from "../design/Icon";
import { useEffect, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Dropdown } from "../components/ChoiceMenu";
import { Radio } from "../components/controls";
import {
  describeReplacement, replaceWorkspace, restoreAsNewWorkspace,
  type AssetStore, type CommitSummary, type ReplacementInfo, type RestoreSource, type Workspace, type WorkspaceManager,
} from "@vnote/core";

type Step = "connect" | "pick" | "destination" | "done";
type Err = { code: string; message: string };

export type RestoreWizardProps = {
  source: RestoreSource;
  workspaces: WorkspaceManager;
  assetsFor: (location: string) => AssetStore;
  onDone: (w: Workspace) => void;
  onCancel: () => void;
};

export function RestoreWizard({ source, workspaces, assetsFor, onDone, onCancel }: RestoreWizardProps) {
  const { t, i18n } = useTranslation();
  const [step, setStep] = useState<Step>("connect");
  const [form, setForm] = useState({ token: "", owner: "", repo: "" });
  const [error, setError] = useState<Err | null>(null);
  const [askPublic, setAskPublic] = useState(false);
  const [busy, setBusy] = useState(false);
  const [points, setPoints] = useState<CommitSummary[] | null>(null);
  const [sha, setSha] = useState<string | null>(null);
  const [files, setFiles] = useState<Map<string, Uint8Array> | null>(null);
  const [existing, setExisting] = useState<Workspace[]>([]);
  const [mode, setMode] = useState<"new" | "replace">("new");
  const [newName, setNewName] = useState("");
  const [targetId, setTargetId] = useState<string>("");
  const [info, setInfo] = useState<ReplacementInfo | null>(null);
  const [typed, setTyped] = useState("");
  const [confirmingReplace, setConfirmingReplace] = useState(false);
  const [restored, setRestored] = useState<Workspace | null>(null);

  useEffect(() => { void workspaces.list().then((r) => { if (r.ok) { setExisting(r.value); if (r.value[0]) setTargetId(r.value[0].id); } }); }, [workspaces]);
  useEffect(() => {
    if (mode !== "replace" || !targetId || !files) { setInfo(null); return; }
    void describeReplacement(workspaces, targetId, files).then((r) => setInfo(r.ok ? r.value : null));
  }, [mode, targetId, files, workspaces]);

  const show = (e: { code: string; message: string; details?: Record<string, unknown> | undefined }) => {
    if (e.code === "UNSUPPORTED_VERSION") setError({ code: e.code, message: t("restore.futureVersion") });
    else if (e.details && "kind" in e.details) setError({ code: e.code, message: t(`backup.error.${String(e.details.kind)}`, { defaultValue: e.message }) });
    else if (e.code === "INVALID") setError({ code: e.code, message: t("restore.damaged", { message: e.message }) });
    else setError({ code: e.code, message: t("restore.failed", { message: e.message }) });
  };

  const connect = async (confirmPublic = false) => {
    setError(null); setBusy(true);
    const c = await source.connect({ ...form, confirmPublic });
    if (!c.ok) {
      setBusy(false);
      if (c.error.code === "NEEDS_CONFIRMATION") setAskPublic(true); else show(c.error);
      return;
    }
    setAskPublic(false);
    const l = await source.listPoints();
    setBusy(false);
    if (!l.ok) return show(l.error);
    setPoints(l.value);
    setStep("pick");
  };

  const next = async () => {
    if (!sha) return;
    setError(null); setBusy(true);
    const r = await source.read(sha);
    setBusy(false);
    if (!r.ok) return show(r.error);
    setFiles(r.value);
    let backupName = "Respaldo";
    try { backupName = String(JSON.parse(new TextDecoder().decode(r.value.get("workspace.json"))).name || backupName); } catch { /* se validará al restaurar */ }
    setNewName(`${backupName} (restaurado)`);
    setStep("destination");
  };

  const restore = async () => {
    if (!files) return;
    setError(null); setBusy(true);
    const r = mode === "new"
      ? await restoreAsNewWorkspace(workspaces, assetsFor, files, { name: newName })
      : await replaceWorkspace(workspaces, targetId, assetsFor, files, { confirmName: typed });
    setBusy(false);
    if (!r.ok) return show(r.error);
    source.forget(); // el token solo vive mientras dura el asistente
    setRestored(r.value.workspace);
    setStep("done");
    onDone(r.value.workspace);
  };

  const when = (iso: string) => new Date(iso).toLocaleString(i18n.language);
  const target = existing.find((w) => w.id === targetId);

  const STEPS: Step[] = ["connect", "pick", "destination"];
  const at = step === "done" ? STEPS.length : STEPS.indexOf(step);
  const OPTION = "flex cursor-pointer items-center gap-3 rounded-[var(--radius-md)] border border-[var(--c-border)] px-3 py-2 has-[:checked]:border-[var(--c-accent)] has-[:checked]:bg-[var(--c-raised)]";

  return (
    <ViewLayout title={t("restore.title")} description={t("restore.hint")}>
      <ol aria-label={t("restore.stepsLabel")} className="flex flex-wrap items-center gap-2 text-[length:var(--text-ui-small-size)]">
        {STEPS.map((s, i) => (
          <li key={s} aria-current={i === at ? "step" : undefined} className={cx("flex items-center gap-2", i === at ? "font-semibold text-[var(--c-text)]" : "text-[var(--c-text-muted)]")}>
            <span className={cx("inline-flex h-6 w-6 items-center justify-center rounded-full tabular-nums", i < at ? "bg-[var(--c-success)] text-[var(--c-on-accent)]" : i === at ? "bg-[var(--c-accent)] text-[var(--c-on-accent)]" : "bg-[var(--c-raised)]")}>
              {i < at ? <Icon name="check" size={14} /> : i + 1}
            </span>
            {t(`restore.steps.${s}`)}
            {i < STEPS.length - 1 && <span aria-hidden="true" className="mx-1 h-px w-8 bg-[var(--c-border-control)]" />}
          </li>
        ))}
      </ol>
      {error && <InlineAlert tone="error">{error.message}</InlineAlert>}

      {step === "connect" && (
        <ViewSection>
          <form onSubmit={(e: FormEvent) => { e.preventDefault(); void connect(); }} className="flex max-w-md flex-col gap-3">
            <label className={FIELD}>{t("backup.token")}
              <input type="password" autoComplete="off" value={form.token} onChange={(e) => setForm({ ...form, token: e.target.value })} className={INPUT} />
            </label>
            <label className={FIELD}>{t("backup.owner")}
              <input value={form.owner} onChange={(e) => setForm({ ...form, owner: e.target.value })} className={INPUT} />
            </label>
            <label className={FIELD}>{t("backup.repo")}
              <input value={form.repo} onChange={(e) => setForm({ ...form, repo: e.target.value })} className={INPUT} />
            </label>
            {askPublic && <InlineAlert tone="warning" action={{ label: t("backup.publicRepo.confirm"), onClick: () => void connect(true) }}>{t("backup.publicRepo.body")}</InlineAlert>}
            <div className="mt-1 flex gap-2">
              <Button type="submit" variant="primary" disabled={busy}>{t("backup.connect")}</Button>
              <Button variant="ghost" onClick={onCancel}>{t("restore.cancel")}</Button>
            </div>
          </form>
        </ViewSection>
      )}

      {step === "pick" && points && (
        <>
          {points.length === 0 ? (
            <ViewSection><p className="text-[var(--c-text-muted)]">{t("restore.none")}</p></ViewSection>
          ) : (
            <ViewSection title={t("restore.available")} flush>
              <div role="radiogroup" aria-label={t("restore.available")} className="flex flex-col">
                {points.map((p) => (
                  <label key={p.sha} className={cx(VIEW_ROW, "cursor-pointer has-[:checked]:bg-[var(--c-raised)]")}>
                    <Radio name="punto" checked={sha === p.sha} onChange={() => setSha(p.sha)} />
                    <span className="min-w-0 flex-1 truncate">{when(p.date)} — {p.message}</span>
                  </label>
                ))}
              </div>
            </ViewSection>
          )}
          <div className="flex gap-2">
            <Button variant="primary" disabled={!sha || busy} onClick={() => void next()}>{t("restore.next")}</Button>
            <Button variant="ghost" onClick={onCancel}>{t("restore.cancel")}</Button>
          </div>
        </>
      )}

      {step === "destination" && (
        <>
          <ViewSection>
            <div className="flex flex-col gap-3">
              <label className={OPTION}>
                <Radio name="destino" checked={mode === "new"} onChange={() => setMode("new")} />{t("restore.newSpace")}
              </label>
              {mode === "new" && (
                <label className={cx(FIELD, "ml-7 max-w-md")}>{t("restore.newName")}
                  <input value={newName} onChange={(e) => setNewName(e.target.value)} className={INPUT} />
                </label>
              )}
              {existing.length > 0 && (
                <>
                  <label className={OPTION}>
                    <Radio name="destino" checked={mode === "replace"} onChange={() => setMode("replace")} />{t("restore.replaceSpace")}
                  </label>
                  {mode === "replace" && (
                    <div className="ml-7 flex max-w-md flex-col gap-3">
                      <label className={FIELD}>{t("restore.chooseWorkspace")}
                        <Dropdown value={targetId} onChange={(e) => { setTargetId(e.target.value); setTyped(""); }} className="w-full">
                          {existing.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                        </Dropdown>
                      </label>
                      {info && (
                        <>
                          <p className={MUTED}>{t("restore.willReplace", { current: info.currentPages, name: info.workspaceName, backup: info.backupPages })}</p>
                          {info.hasNoBackup && <p role="status" className="font-semibold text-[var(--c-danger)]">{t("workspace.noBackup")}</p>}
                        </>
                      )}
                      <label className={FIELD}>{t("restore.typeName", { name: target?.name ?? "" })}
                        <input value={typed} onChange={(e) => setTyped(e.target.value)} className={INPUT} />
                      </label>
                    </div>
                  )}
                </>
              )}
            </div>
          </ViewSection>
          <div className="flex gap-2">
            {mode === "new" ? (
              <Button variant="primary" disabled={busy || newName.trim() === ""} onClick={() => void restore()}>{busy ? t("restore.restoring") : t("restore.restore")}</Button>
            ) : (
              <Button variant="danger" disabled={busy || typed !== target?.name} onClick={() => setConfirmingReplace(true)}>{busy ? t("restore.restoring") : t("restore.replace")}</Button>
            )}
            <Button variant="ghost" onClick={onCancel}>{t("restore.cancel")}</Button>
          </div>
        </>
      )}

      {step === "done" && restored && (
        <div role="status" className="flex items-center gap-2 rounded-md bg-[var(--chip-success-bg)] p-3 text-[var(--chip-success-fg)]">
          <Icon name="success" size={20} />{t("restore.done", { name: restored.name })}
        </div>
      )}
      <ConfirmDialog
        open={confirmingReplace}
        onOpenChange={setConfirmingReplace}
        title={t("restore.replaceConfirmTitle")}
        description={t("restore.replaceConfirmBody", { name: target?.name ?? "" })}
        confirmLabel={t("restore.replace")}
        cancelLabel={t("restore.cancel")}
        onConfirm={() => void restore()}
      />
    </ViewLayout>
  );
}
