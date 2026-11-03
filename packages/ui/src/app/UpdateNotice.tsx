import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { UpdateInfo } from "@vnote/core";

/** Aviso de versión nueva (RF-19, P-2): informa y ofrece abrir la página de descarga; nunca instala nada por su cuenta. */
export function UpdateNotice({ check, onDownload }: { check: () => Promise<UpdateInfo>; onDownload: (url: string) => void }) {
  const { t } = useTranslation();
  const [info, setInfo] = useState<UpdateInfo | null>(null);
  useEffect(() => {
    let alive = true;
    check().then((r) => { if (alive) setInfo(r); }, () => { /* sin red: no se avisa de nada */ });
    return () => { alive = false; };
  }, [check]);
  if (!info || !info.available) return null;
  return (
    <div role="status" className="m-2 flex items-center gap-2 rounded border border-[var(--c-accent)] bg-[var(--chip-info-bg)] p-2 text-sm text-[var(--chip-info-fg)]">
      <span className="flex-1">{t("update.available", { version: info.version })}</span>
      <button type="button" onClick={() => onDownload(info.url)}>{t("update.download")}</button>
      <button type="button" aria-label={t("update.dismiss")} onClick={() => setInfo(null)}>×</button>
    </div>
  );
}
