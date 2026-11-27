import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useTranslation } from "react-i18next";
import { AssetNotesService, type AssetNote, type AssetStore, type Clock, type NoteRect, type SqlStore } from "@vnote/core";
import { Button } from "../components/Button";
import { Dialog } from "../components/Dialog";
import type { PageAttachment } from "./attachments";
import type { PdfDocument } from "./pdf";

const WHOLE: NoteRect = { x: 0, y: 0, w: 1, h: 1 };
const clamp = (v: number) => Math.min(1, Math.max(0, v));
const pct = (r: NoteRect) => ({ left: `${r.x * 100}%`, top: `${r.y * 100}%`, width: `${r.w * 100}%`, height: `${r.h * 100}%` });

function PdfPage({ doc, page }: { doc: PdfDocument; page: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let cancelled = false;
    let task: { cancel: () => void; promise: Promise<void> } | null = null;
    void doc.getPage(page).then((p) => {
      const el = canvas.current;
      if (cancelled || !el) return;
      const viewport = p.getViewport({ scale: 1.5 });
      el.width = viewport.width;
      el.height = viewport.height;
      task = p.render({ canvas: el, viewport });
      task.promise.catch(() => {});
    });
    return () => { cancelled = true; task?.cancel(); };
  }, [doc, page]);
  return <canvas ref={canvas} className="block h-auto w-full" />;
}

/** Vista previa de un PDF o una imagen con notas por zona. El archivo no se modifica. */
export function AttachmentViewer({ attachment, assets, store, clock, onClose }: { attachment: PageAttachment; assets: AssetStore; store: SqlStore; clock: Clock; onClose: () => void }) {
  const { t } = useTranslation();
  const { hash, kind, name } = attachment;
  const [url, setUrl] = useState<string | null>(null);
  const [doc, setDoc] = useState<PdfDocument | null>(null);
  const [page, setPage] = useState(1);
  const [notes, setNotes] = useState<AssetNote[]>([]);
  const [rect, setRect] = useState<NoteRect | null>(null);
  const [text, setText] = useState("");
  const [failed, setFailed] = useState(false);
  const start = useRef<{ x: number; y: number } | null>(null);
  const [service] = useState(() => new AssetNotesService(store, clock));
  const reload = useCallback(() => service.list(hash).then(setNotes), [service, hash]);
  useEffect(() => { void reload(); }, [reload]);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    let opened: PdfDocument | null = null;
    void (async () => {
      const bytes = await assets.get(hash);
      if (!bytes) throw new Error("missing");
      if (kind === "image") {
        if (cancelled) return;
        // El tipo solo importa para SVG: el navegador reconoce los demás por su contenido.
        objectUrl = URL.createObjectURL(new Blob([bytes as BlobPart], /\.svg$/i.test(name) ? { type: "image/svg+xml" } : {}));
        setUrl(objectUrl);
        return;
      }
      const loaded = await (await import("./pdf")).openPdf(bytes);
      if (cancelled) { void loaded.loadingTask.destroy(); return; }
      opened = loaded;
      setDoc(loaded);
    })().catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; if (objectUrl) URL.revokeObjectURL(objectUrl); void opened?.loadingTask.destroy(); };
  }, [assets, hash, kind, name]);

  const point = (e: ReactPointerEvent<HTMLDivElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    return { x: clamp((e.clientX - box.left) / box.width), y: clamp((e.clientY - box.top) / box.height) };
  };
  const drag = (e: ReactPointerEvent<HTMLDivElement>) => {
    const a = start.current;
    if (!a) return;
    const b = point(e);
    const next = { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) };
    setRect(next.w > 0.01 && next.h > 0.01 ? next : null);
  };
  const save = async () => {
    const r = await service.add({ hash, page, rect: rect ?? WHOLE, text });
    if (!r.ok) return;
    setText(""); setRect(null);
    await reload();
  };
  const goTo = (n: number) => { setPage(n); setRect(null); };
  const here = notes.filter((n) => n.page === page);

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }} title={name || t("attachments.untitled")} description={t("attachments.hint")} size="l" tall dirty={text.trim() !== ""}>
      {failed && <p role="alert">{t("attachments.failed")}</p>}
      {doc && (
        <div className="mb-2 flex items-center gap-2">
          <Button onClick={() => goTo(page - 1)} disabled={page <= 1}>{t("attachments.previous")}</Button>
          <span aria-live="polite">{t("attachments.page", { page, total: doc.numPages })}</span>
          <Button onClick={() => goTo(page + 1)} disabled={page >= doc.numPages}>{t("attachments.next")}</Button>
        </div>
      )}
      <div
        data-testid="note-surface"
        className="relative cursor-crosshair touch-none select-none border border-[var(--c-border)]"
        onPointerDown={(e) => { start.current = point(e); setRect(null); e.currentTarget.setPointerCapture?.(e.pointerId); }}
        onPointerMove={drag}
        onPointerUp={(e) => { drag(e); start.current = null; }}
      >
        {url && <img src={url} alt={name} draggable={false} className="block h-auto w-full" />}
        {doc && <PdfPage doc={doc} page={page} />}
        {here.map((n, i) => (
          <span key={n.id} aria-hidden="true" title={n.text} style={pct(n.rect)} className="pointer-events-none absolute border-2 border-[var(--c-warning)]">
            <span className="absolute left-0 top-0 bg-[var(--chip-warning-bg)] px-1 text-[length:var(--text-note-size)] text-[var(--chip-warning-fg)]">{i + 1}</span>
          </span>
        ))}
        {rect && <span aria-hidden="true" style={pct(rect)} className="pointer-events-none absolute border-2 border-dashed border-[var(--c-accent)]" />}
      </div>
      <form className="mt-3 flex flex-col gap-2" onSubmit={(e) => { e.preventDefault(); void save(); }}>
        <label className="flex flex-col gap-1">
          <span>{rect ? t("attachments.noteForArea") : t("attachments.noteForPage")}</span>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} className="w-full rounded-[var(--radius-md)] border border-[var(--c-border-control)] bg-[var(--c-card)] p-2" />
        </label>
        <div><Button type="submit" variant="primary" disabled={text.trim() === ""}>{t("attachments.add")}</Button></div>
      </form>
      {here.length > 0 && (
        <ol aria-label={t("attachments.notes")} className="mt-3 list-decimal pl-5">
          {here.map((n) => (
            <li key={n.id}>
              <span className="whitespace-pre-wrap">{n.text}</span>{" "}
              <button type="button" className="underline" onClick={() => void service.remove(n.id).then(reload)}>{t("attachments.remove")}</button>
            </li>
          ))}
        </ol>
      )}
    </Dialog>
  );
}
