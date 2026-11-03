import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { QuickCapture, resolveCaptureTarget, type Clock, type Workspace, type WorkspaceManager } from "@vnote/core";

const SAVE_DELAY_MS = 250;
type State =
  | { phase: "loading" }
  | { phase: "empty" }
  | { phase: "choose"; workspaces: Workspace[] }
  | { phase: "ready"; workspace: Workspace };

/** Ventana mínima de captura rápida (RF-13): escribe, guarda el borrador sin parar y confirma en la Bandeja del espacio predeterminado. */
export function QuickCaptureView({ manager, clock, onSaved, onClose }: { manager: WorkspaceManager; clock: Clock; onSaved?: (workspaceId: string) => void; onClose?: () => void }) {
  const { t } = useTranslation();
  const [state, setState] = useState<State>({ phase: "loading" });
  const [text, setText] = useState("");
  const [recovered, setRecovered] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cap = useRef<QuickCapture | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pending = useRef<string | null>(null);
  const area = useRef<HTMLTextAreaElement>(null);

  const load = useCallback(async () => {
    const target = await resolveCaptureTarget(manager);
    if (target.status === "empty") { setState({ phase: "empty" }); return; }
    if (target.status === "choose") { setState({ phase: "choose", workspaces: target.workspaces }); return; }
    const opened = await manager.open(target.workspace.id);
    if (!opened.ok) { setError(opened.error.message); setState({ phase: "empty" }); return; }
    cap.current = new QuickCapture(opened.value.store, clock, t("capture.inboxTitle"));
    const draft = await cap.current.getDraft();
    setText(draft ?? ""); setRecovered(draft !== null);
    setState({ phase: "ready", workspace: target.workspace });
  }, [manager, clock, t]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (state.phase === "ready") area.current?.focus(); }, [state.phase]);

  /** Escribe de inmediato lo pendiente (al cerrar, confirmar o salir de la página). */
  const flush = useCallback(async () => {
    clearTimeout(timer.current);
    if (pending.current !== null && cap.current) { const v = pending.current; pending.current = null; await cap.current.saveDraft(v); }
  }, []);
  useEffect(() => {
    const onHide = () => void flush();
    window.addEventListener("pagehide", onHide);
    return () => { window.removeEventListener("pagehide", onHide); void flush(); };
  }, [flush]);

  const onChange = (value: string) => {
    setText(value); setMessage(null); setRecovered(false);
    pending.current = value;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), SAVE_DELAY_MS);
  };

  const confirm = async () => {
    if (!cap.current || text.trim() === "" || state.phase !== "ready") return;
    clearTimeout(timer.current); pending.current = null;
    const r = await cap.current.confirm(text);
    if (!r.ok) { setError(r.error.message); return; }
    setError(null); setText(""); setRecovered(false);
    setMessage(t("capture.saved", { space: state.workspace.name }));
    onSaved?.(state.workspace.id);
  };
  const cancel = async () => { await flush(); onClose?.(); };
  const discard = async () => { clearTimeout(timer.current); pending.current = null; await cap.current?.discardDraft(); setText(""); setRecovered(false); setMessage(null); area.current?.focus(); };

  if (state.phase === "loading") return <p role="status" className="p-4 opacity-70">{t("app.loading")}</p>;
  if (state.phase === "empty") return <p role="status" className="p-4">{error ?? t("capture.noWorkspaces")}</p>;
  if (state.phase === "choose") {
    return (
      <section aria-label={t("capture.title")} className="flex flex-col gap-2 p-4">
        <h1 className="text-lg font-semibold">{t("capture.title")}</h1>
        <p>{t("capture.chooseWorkspace")}</p>
        <ul className="flex flex-col gap-1">
          {state.workspaces.map((w) => (
            <li key={w.id}><button type="button" aria-label={t("capture.useWorkspace", { name: w.name })} onClick={() => void manager.setCaptureDefault(w.id).then(() => load())}>{w.name}</button></li>
          ))}
        </ul>
      </section>
    );
  }
  return (
    <section aria-label={t("capture.title")} className="flex flex-col gap-2 p-4">
      <h1 className="text-lg font-semibold">{t("capture.title")}</h1>
      <p className="text-sm opacity-70">{t("capture.destination", { space: state.workspace.name })}</p>
      {recovered && <p role="status" className="rounded border border-[var(--c-warning)] bg-[var(--chip-warning-bg)] p-1 text-sm text-[var(--chip-warning-fg)]">{t("capture.recovered")}</p>}
      {message && <p role="status" className="rounded border border-[var(--c-success)] bg-[var(--chip-success-bg)] p-1 text-sm text-[var(--chip-success-fg)]">{message}</p>}
      {error && <p role="alert" className="text-sm text-[var(--c-danger)]">{error}</p>}
      <textarea
        ref={area} aria-label={t("capture.noteLabel")} value={text} rows={6} className="w-full rounded border p-2"
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); void confirm(); }
          else if (e.key === "Escape") { e.preventDefault(); void cancel(); }
        }}
      />
      <div className="flex gap-2">
        <button type="button" onClick={() => void confirm()} disabled={text.trim() === ""}>{t("capture.save")}</button>
        <button type="button" onClick={() => void cancel()}>{t("capture.cancel")}</button>
        {(recovered || text !== "") && <button type="button" onClick={() => void discard()}>{t("capture.discard")}</button>}
      </div>
      <p className="text-xs opacity-70">{t("capture.hint")}</p>
    </section>
  );
}
