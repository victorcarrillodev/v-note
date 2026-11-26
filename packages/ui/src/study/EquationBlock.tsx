import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import katex from "katex";
import "katex/dist/katex.min.css";
import { Button } from "../components/Button";
import { Icon } from "../design/Icon";
import "./study.css";

/** Atajos para escribir lo más común sin recordar LaTeX: [lo que se ve, lo que se inserta]. */
const SNIPPETS: [string, string][] = [
  ["x²", "x^{2}"], ["xᵢ", "x_{i}"], ["a⁄b", "\\frac{a}{b}"], ["√", "\\sqrt{x}"], ["Σ", "\\sum_{i=1}^{n} i"],
  ["log", "\\log_{2} n"], ["O( )", "O(n \\log n)"], ["≤", "\\le "], ["≥", "\\ge "], ["→", "\\to "], ["∞", "\\infty "],
];

/** Ecuación en LaTeX: se ve compuesta; al pulsarla se abre el editor con vista previa. */
export function EquationView({ formula, editable, onChange }: { formula: string; editable: boolean; onChange: (formula: string) => void }) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(formula);
  const area = useRef<HTMLTextAreaElement>(null);
  const shown = editing ? draft : formula;
  // `trust: false` (predeterminado) impide enlaces e imágenes desde la fórmula.
  const html = katex.renderToString(shown, { displayMode: true, throwOnError: false });
  const change = (value: string) => { setDraft(value); onChange(value); };
  const insert = (snippet: string) => {
    const el = area.current;
    if (!el) return;
    const from = el.selectionStart, to = el.selectionEnd;
    change(draft.slice(0, from) + snippet + draft.slice(to));
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(from + snippet.length, from + snippet.length); });
  };
  const preview = (
    <button type="button" aria-label={t("study.equation.edit")} disabled={!editable || editing} onClick={() => { setDraft(formula); setEditing(true); }}
      className={`w-full overflow-x-auto rounded-[var(--radius-md)] py-2 ${editing ? "" : "hover:bg-[var(--c-raised)]"}`}>
      {shown.trim() === "" ? <span className="text-[length:var(--text-ui-size)] text-[var(--c-text-muted)]">{t("study.equation.empty")}</span> : <span dangerouslySetInnerHTML={{ __html: html }} />}
    </button>
  );
  if (!editing) return <div className="w-full" contentEditable={false}>{preview}</div>;
  return (
    // El foco puede moverse entre el texto y los atajos; solo al salir del bloque se cierra.
    <div className="vn-study" contentEditable={false} onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setEditing(false); }}>
      <div className="vn-study-head">
        <Icon name="equation" size={16} /><strong>{t("study.equation.slash")}</strong>
        <Button size="sm" onClick={() => setEditing(false)}>{t("study.done")}</Button>
      </div>
      <div className="vn-study-body">
        {preview}
        <div role="group" aria-label={t("study.equation.snippets")} className="flex flex-wrap gap-1">
          {SNIPPETS.map(([label, code]) => <button key={label} type="button" className="vn-study-chip" title={code} onMouseDown={(e) => e.preventDefault()} onClick={() => insert(code)}>{label}</button>)}
        </div>
        <textarea
          ref={area} autoFocus rows={Math.max(2, draft.split("\n").length)} spellCheck={false} aria-label={t("study.equation.source")} placeholder="T(n) = O(n \log n)" className="vn-study-source vn-study-mono" value={draft}
          onChange={(e) => change(e.target.value)}
          onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Escape" || (e.key === "Enter" && (e.ctrlKey || e.metaKey))) { e.preventDefault(); setEditing(false); } }}
        />
      </div>
    </div>
  );
}
