import { useState } from "react";
import { useTranslation } from "react-i18next";
import katex from "katex";
import "katex/dist/katex.min.css";

/**
 * Ecuación en línea (`$…$`): se ve compuesta con KaTeX dentro del texto; al pulsarla se edita en su sitio.
 * Una fórmula vacía abre el editor sola. `trust: false` (predeterminado) impide enlaces e imágenes desde la fórmula.
 */
export function InlineMathView({ formula, editable, onChange }: { formula: string; editable: boolean; onChange: (formula: string) => void }) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(editable && formula.trim() === "");
  // Borrador local mientras se escribe: el editor confirma el cambio con retraso y la propiedad no debe pisar lo tecleado.
  const [draft, setDraft] = useState(formula);
  const close = () => setEditing(false);
  const change = (value: string) => { setDraft(value); onChange(value); };
  if (editing) {
    return (
      <input
        autoFocus spellCheck={false} aria-label={t("study.math.source")} value={draft} placeholder="x^2" size={Math.max(4, draft.length + 1)}
        className="vn-inline-math-input" contentEditable={false}
        onChange={(e) => change(e.target.value)}
        onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Enter" || e.key === "Escape") { e.preventDefault(); close(); } }}
        onBlur={close}
      />
    );
  }
  const html = katex.renderToString(formula, { displayMode: false, throwOnError: false });
  return (
    <button
      type="button" aria-label={t("study.math.edit")} contentEditable={false}
      onClick={() => { if (editable) { setDraft(formula); setEditing(true); } }}
      className="vn-inline-math"
    >
      {formula.trim() === "" ? <span className="text-[var(--c-text-muted)]">{t("study.math.empty")}</span> : <span dangerouslySetInnerHTML={{ __html: html }} />}
    </button>
  );
}
