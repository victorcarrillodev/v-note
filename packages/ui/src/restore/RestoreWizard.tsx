import { ConfirmDialog } from "../components/ConfirmDialog";
import { InlineAlert } from "../components/InlineAlert";
import { useEffect, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
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

  return (
    <section aria-label={t("restore.title")} className="flex max-w-xl flex-col gap-3 p-4">
      <h1 className="text-xl font-semibold">{t("restore.title")}</h1>
      {error && <InlineAlert tone="error">{error.message}</InlineAlert>}

      {step === "connect" && (
        <form onSubmit={(e: FormEvent) => { e.preventDefault(); void connect(); }} className="flex flex-col gap-2">
          <label className="flex flex-col gap-1">{t("backup.token")}
            <input type="password" autoComplete="off" value={form.token} onChange={(e) => setForm({ ...form, token: e.target.value })} className="rounded border px-2 py-1" />
          </label>
          <label className="flex flex-col gap-1">{t("backup.owner")}
            <input value={form.owner} onChange={(e) => setForm({ ...form, owner: e.target.value })} className="rounded border px-2 py-1" />
          </label>
          <label className="flex flex-col gap-1">{t("backup.repo")}
            <input value={form.repo} onChange={(e) => setForm({ ...form, repo: e.target.value })} className="rounded border px-2 py-1" />
          </label>
          {askPublic && <InlineAlert tone="warning" action={{ label: t("backup.publicRepo.confirm"), onClick: () => void connect(true) }}>{t("backup.publicRepo.body")}</InlineAlert>}
          <div className="flex gap-2">
            <button type="submit" disabled={busy}>{t("backup.connect")}</button>
            <button type="button" onClick={onCancel}>{t("restore.cancel")}</button>
          </div>
        </form>
      )}

      {step === "pick" && points && (
        <>
          {points.length === 0 ? (
            <p>{t("restore.none")}</p>
          ) : (
            <div role="radiogroup" aria-label={t("restore.available")} className="flex flex-col gap-1">
              {points.map((p) => (
                <label key={p.sha} className="flex gap-2">
                  <input type="radio" name="punto" checked={sha === p.sha} onChange={() => setSha(p.sha)} />
                  <span>{when(p.date)} — {p.message}</span>
                </label>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <button type="button" disabled={!sha || busy} onClick={() => void next()}>{t("restore.next")}</button>
            <button type="button" onClick={onCancel}>{t("restore.cancel")}</button>
          </div>
        </>
      )}

      {step === "destination" && (
        <>
          <label className="flex items-center gap-2">
            <input type="radio" name="destino" checked={mode === "new"} onChange={() => setMode("new")} />{t("restore.newSpace")}
          </label>
          {mode === "new" && (
            <label className="ml-6 flex flex-col gap-1">{t("restore.newName")}
              <input value={newName} onChange={(e) => setNewName(e.target.value)} className="rounded border px-2 py-1" />
            </label>
          )}
          {existing.length > 0 && (
            <>
              <label className="flex items-center gap-2">
                <input type="radio" name="destino" checked={mode === "replace"} onChange={() => setMode("replace")} />{t("restore.replaceSpace")}
              </label>
              {mode === "replace" && (
                <div className="ml-6 flex flex-col gap-2">
                  <label className="flex flex-col gap-1">{t("restore.chooseWorkspace")}
                    <select value={targetId} onChange={(e) => { setTargetId(e.target.value); setTyped(""); }} className="rounded border px-2 py-1">
                      {existing.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                  </label>
                  {info && (
                    <>
                      <p>{t("restore.willReplace", { current: info.currentPages, name: info.workspaceName, backup: info.backupPages })}</p>
                      {info.hasNoBackup && <p role="status" className="font-semibold text-[var(--c-danger)]">{t("workspace.noBackup")}</p>}
                    </>
                  )}
                  <label className="flex flex-col gap-1">{t("restore.typeName", { name: target?.name ?? "" })}
                    <input value={typed} onChange={(e) => setTyped(e.target.value)} className="rounded border px-2 py-1" />
                  </label>
                </div>
              )}
            </>
          )}
          <div className="flex gap-2">
            {mode === "new" ? (
              <button type="button" disabled={busy || newName.trim() === ""} onClick={() => void restore()}>{busy ? t("restore.restoring") : t("restore.restore")}</button>
            ) : (
              <button type="button" disabled={busy || typed !== target?.name} onClick={() => setConfirmingReplace(true)}>{busy ? t("restore.restoring") : t("restore.replace")}</button>
            )}
            <button type="button" onClick={onCancel}>{t("restore.cancel")}</button>
          </div>
        </>
      )}

      {step === "done" && restored && <p role="status">{t("restore.done", { name: restored.name })}</p>}
      <ConfirmDialog
        open={confirmingReplace}
        onOpenChange={setConfirmingReplace}
        title={t("restore.replaceConfirmTitle")}
        description={t("restore.replaceConfirmBody", { name: target?.name ?? "" })}
        confirmLabel={t("restore.replace")}
        cancelLabel={t("restore.cancel")}
        onConfirm={() => void restore()}
      />
    </section>
  );
}
