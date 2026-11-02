import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { LinkTarget } from "@vnote/core";
import { useLinks } from "./LinkContext";

/** Mención de una página dentro del texto (RF-6). Muestra el título vigente; si el destino está en la papelera o ya no existe, lo indica. */
export function MentionView({ pageId, title }: { pageId: string; title: string }) {
  const { t } = useTranslation();
  const api = useLinks();
  const [target, setTarget] = useState<LinkTarget | null>(null);
  const load = useCallback(() => { void api?.resolve(pageId).then(setTarget); }, [api, pageId]);
  useEffect(load, [load]);

  const state = target?.state ?? "ok";
  const name = (target && target.state !== "missing" ? target.title : title).trim() || t("app.untitled");
  const base = "rounded px-1";
  if (state === "ok") {
    return (
      <span contentEditable={false} data-mention={pageId} data-state="ok">
        <button type="button" className={`${base} bg-blue-50 text-blue-800 underline`} onClick={() => api?.open(pageId)}>{`@${name}`}</button>
      </span>
    );
  }
  if (state === "trashed") {
    return (
      <span contentEditable={false} data-mention={pageId} data-state="trashed" className={`${base} bg-amber-50 text-amber-900`}>
        <span>{`@${name} `}</span><span>{t("links.inTrash")}</span>{" "}
        <button type="button" className="underline" onClick={() => void api?.restore(pageId).then(load)}>{t("links.restore")}</button>
      </span>
    );
  }
  return (
    <span contentEditable={false} data-mention={pageId} data-state="missing" className={`${base} bg-red-50 text-red-900 line-through`} title={t("links.broken")}>
      {`@${name}`}<span className="sr-only">{` ${t("links.broken")}`}</span>
    </span>
  );
}
