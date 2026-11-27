import { useState } from "react";
import { useTranslation } from "react-i18next";
import { brand } from "@vnote/core";
import { Button } from "../components/Button";
import { bookmarkletCode } from "./clipper";

/** Explica el recortador y entrega el código del marcador (se copia: un enlace `javascript:` no se puede arrastrar desde la app). */
export function ClipperHelp() {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const code = bookmarkletCode(t("clipper.done", { app: brand.name }));
  return (
    <details className="text-[length:var(--text-ui-small-size)]">
      <summary className="cursor-pointer text-[var(--c-text-muted)]">{t("clipper.title")}</summary>
      <p className="my-2">{t("clipper.help")}</p>
      <input readOnly aria-label={t("clipper.codeLabel")} value={code} onFocus={(e) => e.target.select()} className="mb-2 w-full rounded-[var(--radius-md)] border border-[var(--c-border-control)] bg-[var(--c-card)] px-2 py-1 font-mono" />
      <Button onClick={() => void navigator.clipboard?.writeText(code).then(() => setCopied(true))}>{t("clipper.copy")}</Button>
      {copied && <span role="status" className="ml-2">{t("clipper.copied")}</span>}
    </details>
  );
}
