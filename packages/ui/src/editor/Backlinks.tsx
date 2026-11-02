import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Backlink } from "@vnote/core";
import type { WorkspaceController } from "../workspace/controller";

/** Páginas que enlazan a esta (RF-6). */
export function Backlinks({ controller, pageId }: { controller: WorkspaceController; pageId: string }) {
  const { t } = useTranslation();
  const [items, setItems] = useState<Backlink[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    setItems(null);
    void controller.backlinks(pageId).then((r) => { if (!cancelled) setItems(r); });
    return () => { cancelled = true; };
  }, [controller, pageId]);
  if (items === null) return null;
  return (
    <section aria-label={t("links.backlinks")} className="mt-6 border-t pt-3">
      <h2 className="text-sm font-semibold">{t("links.backlinks")}</h2>
      {items.length === 0 ? <p className="text-sm opacity-70">{t("links.noBacklinks")}</p> : (
        <ul className="text-sm">
          {items.map((p) => (
            <li key={p.id}><button type="button" className="underline" onClick={() => void controller.select(p.id)}>{p.title.trim() || t("app.untitled")}</button></li>
          ))}
        </ul>
      )}
    </section>
  );
}
