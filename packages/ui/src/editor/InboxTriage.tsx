import { useEffect, useState } from "react";
import { InlineAlert } from "../components/InlineAlert";
import { useTranslation } from "react-i18next";
import type { WorkspaceController } from "../workspace/controller";

/** Acciones sobre una nota de la Bandeja de entrada: moverla a otra página o convertirla en tarjeta (RF-13). */
export function InboxTriage({ controller, pageId }: { controller: WorkspaceController; pageId: string }) {
  const { t } = useTranslation();
  const [isNote, setIsNote] = useState(false);
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<{ id: string; title: string }[]>([]);
  const [boards, setBoards] = useState<{ id: string; name: string }[]>([]);
  const [board, setBoard] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setMessage(null); setError(null);
    void controller.isInboxNote(pageId).then(async (v) => {
      if (cancelled) return;
      setIsNote(v);
      if (v) { const b = await controller.listDatabases(); if (!cancelled) { setBoards(b); setBoard(b[0]?.id ?? ""); } }
    });
    return () => { cancelled = true; };
  }, [controller, pageId]);
  useEffect(() => {
    if (!isNote || query.trim() === "") { setFound([]); return; }
    let cancelled = false;
    void controller.findPages(query).then((r) => { if (!cancelled) setFound(r.filter((p) => p.id !== pageId)); });
    return () => { cancelled = true; };
  }, [controller, isNote, query, pageId]);

  if (!isNote) return message ? <InlineAlert tone="success">{message}</InlineAlert> : null;
  const done = () => { setIsNote(false); setMessage(t("capture.moved")); };
  const move = async (parent: string | null) => { const r = await controller.moveInboxNote(pageId, parent); if (r.ok) done(); else setError(r.error.message); };
  const toCard = async () => { const r = await controller.inboxToCard(pageId, board); if (r.ok) done(); else setError(r.error.message); };
  return (
    <div role="region" aria-label={t("capture.triage")} className="mb-3 flex flex-col gap-2 rounded border p-2 text-sm">
      <strong>{t("capture.triage")}</strong>
      {error && <InlineAlert tone="error">{error}</InlineAlert>}
      <div className="flex flex-wrap items-center gap-2">
        <label>{t("capture.moveTo")}{" "}<input aria-label={t("capture.moveSearch")} value={query} onChange={(e) => setQuery(e.target.value)} className="rounded border px-1" /></label>
        <button type="button" onClick={() => void move(null)}>{t("capture.moveRoot")}</button>
      </div>
      {found.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {found.map((p) => <li key={p.id}><button type="button" aria-label={t("capture.moveInto", { title: p.title.trim() || t("app.untitled") })} onClick={() => void move(p.id)}>{p.title.trim() || t("app.untitled")}</button></li>)}
        </ul>
      )}
      {boards.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <label>{t("capture.pickBoard")}{" "}
            <select value={board} onChange={(e) => setBoard(e.target.value)}>{boards.map((b) => <option key={b.id} value={b.id}>{b.name.trim() || t("app.untitled")}</option>)}</select>
          </label>
          <button type="button" onClick={() => void toCard()}>{t("capture.doToCard")}</button>
        </div>
      )}
    </div>
  );
}
