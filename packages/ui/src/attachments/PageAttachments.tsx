import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { fromYjs, systemClock, type AssetStore, type DocSession, type SqlStore } from "@vnote/core";
import { AttachmentViewer } from "./AttachmentViewer";
import { attachmentsIn, type PageAttachment } from "./attachments";
import { indexPendingPdfs } from "./indexPdfs";

const DELAY_MS = 1500;

/** PDF e imágenes de la página: vista previa con notas y lectura de los PDF para la búsqueda. */
export function PageAttachments({ session, assets, store }: { session: DocSession; assets: AssetStore; store: SqlStore }) {
  const { t } = useTranslation();
  const [items, setItems] = useState<PageAttachment[]>([]);
  const [open, setOpen] = useState<PageAttachment | null>(null);

  useEffect(() => {
    const read = () => setItems(attachmentsIn(fromYjs(session.doc.getXmlFragment("doc"))));
    read();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onUpdate = () => { clearTimeout(timer); timer = setTimeout(read, 800); };
    session.doc.on("update", onUpdate);
    return () => { clearTimeout(timer); session.doc.off("update", onUpdate); };
  }, [session]);

  // Un PDF recién adjuntado se lee cuando la página ya se guardó.
  const pdfs = items.filter((i) => i.kind === "pdf").map((i) => i.hash).join();
  useEffect(() => {
    if (pdfs === "") return;
    const timer = setTimeout(() => void session.flush().then(() => indexPendingPdfs(store, assets, systemClock)).catch(() => {}), DELAY_MS);
    return () => clearTimeout(timer);
  }, [pdfs, session, store, assets]);

  if (items.length === 0) return null;
  return (
    <section aria-label={t("attachments.title")} className="mt-6 border-t pt-3">
      <h2 className="text-sm font-semibold">{t("attachments.title")}</h2>
      <ul className="text-sm">
        {items.map((a) => (
          <li key={a.hash}><button type="button" className="underline" onClick={() => setOpen(a)}>{t("attachments.preview", { name: a.name || t("attachments.untitled") })}</button></li>
        ))}
      </ul>
      {open && <AttachmentViewer attachment={open} assets={assets} store={store} clock={systemClock} onClose={() => setOpen(null)} />}
    </section>
  );
}
