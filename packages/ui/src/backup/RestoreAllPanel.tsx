import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "../components/Button";
import { InlineAlert } from "../components/InlineAlert";
import { ViewSection } from "../components/ViewLayout";

export type RestoreAllResult = { restored: number; failed: { name: string; message: string }[] } | { error: string };

/** Restaura TODOS los espacios del destino como espacios nuevos; nada se toca hasta confirmar y los actuales no se sobrescriben. */
export function RestoreAllPanel({ restore, onDone, onCancel }: { restore: () => Promise<RestoreAllResult>; onDone: () => void; onCancel: () => void }) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<RestoreAllResult | null>(null);

  const run = async () => {
    setBusy(true);
    setResult(await restore());
    setBusy(false);
  };

  return (
    <ViewSection title={t("backupAll.restoreTitle")} hint={t("backupAll.restoreHint")}>
      <div className="flex max-w-md flex-col gap-3">
        {result && "error" in result && <InlineAlert tone="error">{result.error}</InlineAlert>}
        {result && "restored" in result && (
          <>
            <InlineAlert tone={result.failed.length ? "warning" : "success"}>{t("backupAll.restoredCount", { count: result.restored })}</InlineAlert>
            {result.failed.length > 0 && <ul className="list-disc pl-5">{result.failed.map((f) => <li key={f.name}>{f.name}: {f.message}</li>)}</ul>}
          </>
        )}
        <div className="flex gap-2">
          {result && "restored" in result ? (
            <Button variant="primary" onClick={onDone}>{t("backupAll.done")}</Button>
          ) : (
            <>
              <Button variant="primary" disabled={busy} onClick={() => void run()}>{busy ? t("backupAll.restoring") : t("backupAll.restore")}</Button>
              <Button disabled={busy} onClick={onCancel}>{t("backupAll.cancel")}</Button>
            </>
          )}
        </div>
      </div>
    </ViewSection>
  );
}
