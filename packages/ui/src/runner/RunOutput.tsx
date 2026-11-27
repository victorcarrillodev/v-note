import { useTranslation } from "react-i18next";
import type { RunResult } from "./types";

/** Salida de una ejecución: texto, valor de la última expresión, error y duración. No se guarda en el documento. */
export function RunOutput({ result, onClear }: { result: RunResult; onClear: () => void }) {
  const { t } = useTranslation();
  // Los avisos propios (tiempo, detenido, salida larga) se traducen; el resto es el mensaje del intérprete tal cual.
  const message = result.timedOut && result.limitMs !== undefined ? t("editor.run.timedOut", { seconds: Math.round(result.limitMs / 1000) })
    : result.cancelled ? t("editor.run.cancelled")
    : result.truncated ? t("editor.run.tooLong")
    : result.errorKey ? t(`editor.run.errors.${result.errorKey}`, { detail: result.error ?? "" })
    : result.error;
  return (
    <div contentEditable={false} data-run-output className="border-t border-[var(--c-border)] bg-[var(--c-raised)] px-3 py-2 text-[length:var(--text-ui-small-size)]">
      {result.stdout !== "" && <pre className="m-0 whitespace-pre-wrap font-[family-name:var(--font-mono)]">{result.stdout}</pre>}
      {result.stderr !== "" && <pre className="m-0 whitespace-pre-wrap font-[family-name:var(--font-mono)] text-[var(--c-warning)]">{result.stderr}</pre>}
      {result.value !== undefined && <p className="m-0 font-[family-name:var(--font-mono)]">{t("editor.run.value")} {result.value}</p>}
      {message && <p role="alert" className="m-0 font-[family-name:var(--font-mono)] text-[var(--c-danger)]">{message}</p>}
      <div className="mt-1 flex items-center justify-between text-[length:var(--text-note-size)] text-[var(--c-text-muted)]">
        <span>{t("editor.run.took", { ms: result.ms })}</span>
        <button type="button" className="underline" onClick={onClear}>{t("editor.run.clear")}</button>
      </div>
    </div>
  );
}
