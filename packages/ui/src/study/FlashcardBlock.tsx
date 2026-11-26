import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Icon } from "../design/Icon";
import { localDay, shortDay } from "./day";
import "./study.css";

/** Tarjeta de estudio dentro de la página: pregunta y respuesta. El repaso se hace en la vista «Repaso». */
export function FlashcardBlockView({ front, back, due, editable, onChange }: { front: string; back: string; due: string; editable: boolean; onChange: (patch: { front?: string; back?: string }) => void }) {
  const { t, i18n } = useTranslation();
  const [draft, setDraft] = useState({ front, back });
  useEffect(() => setDraft({ front, back }), [front, back]);
  const status = draft.front.trim() === "" ? t("study.card.incomplete")
    : due === "" ? t("study.card.new")
    : due <= localDay(Date.now()) ? t("study.card.today")
    : t("study.card.next", { date: shortDay(due, i18n.language) });
  const field = (key: "front" | "back") => (
    <label className="flex flex-col gap-1 text-[length:var(--text-ui-small-size)] leading-normal text-[var(--c-text-muted)]">
      {t(`study.card.${key}`)}
      <textarea
        rows={Math.max(key === "front" ? 1 : 2, draft[key].split("\n").length)} readOnly={!editable} className={`vn-study-source ${key === "front" ? "font-semibold" : ""}`} value={draft[key]}
        placeholder={t(`study.card.${key}Hint`)}
        onChange={(e) => { const value = e.target.value; setDraft((d) => ({ ...d, [key]: value })); onChange({ [key]: value }); }}
        onKeyDown={(e) => e.stopPropagation()}
      />
    </label>
  );
  return (
    <div className="vn-study vn-flashcard" contentEditable={false}>
      <div className="vn-study-head">
        <Icon name="flashcard" size={16} /><strong>{t("study.card.slash")}</strong>
        <span className="vn-study-chip">{status}</span>
      </div>
      <div className="vn-study-body">{field("front")}{field("back")}</div>
    </div>
  );
}
