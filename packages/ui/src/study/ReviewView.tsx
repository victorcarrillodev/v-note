import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { isDue, reviewCard, type Grade } from "@vnote/core";
import type { WorkspaceController, StudyCard } from "../workspace/controller";
import { Button } from "../components/Button";
import { EmptyState } from "../empty/EmptyState";
import { localDay } from "./day";
import "./study.css";

export { localDay };

const GRADES: Grade[] = ["again", "good", "easy"];

/** Sesión de repaso: las tarjetas que tocan hoy, de una en una. «Otra vez» la devuelve al final de la cola. */
export function ReviewView({ controller, now, onOpenPage }: { controller: Pick<WorkspaceController, "listFlashcards" | "saveFlashcard">; now: () => number; onOpenPage: (pageId: string) => void }) {
  const { t } = useTranslation();
  const [queue, setQueue] = useState<StudyCard[] | null>(null);
  const [total, setTotal] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [planned, setPlanned] = useState(0);
  const [answered, setAnswered] = useState(0);

  useEffect(() => {
    let alive = true;
    void controller.listFlashcards().then((cards) => {
      if (!alive) return;
      const today = localDay(now());
      setTotal(cards.length);
      const pending = cards.filter((c) => isDue(c, today));
      setPlanned(pending.length);
      setQueue(pending);
    }, () => { if (alive) { setQueue([]); setFailed(true); } });
    return () => { alive = false; };
  }, [controller]); // eslint-disable-line react-hooks/exhaustive-deps -- `now` solo lee el reloj

  const card = queue?.[0];
  const grade = useCallback(async (g: Grade) => {
    if (!card) return;
    setBusy(true);
    const state = reviewCard(card, g, localDay(now()));
    const saved = await controller.saveFlashcard(card.pageId, card.blockId, state);
    setBusy(false);
    setFailed(!saved);
    if (!saved) return;
    setRevealed(false);
    if (g !== "again") setAnswered((n) => n + 1);
    setQueue((q) => { const rest = (q ?? []).slice(1); return g === "again" ? [...rest, { ...card, ...state }] : rest; });
  }, [card, controller, now]);

  // Teclado: espacio muestra la respuesta; 1, 2 y 3 califican.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (!card || e.ctrlKey || e.metaKey || e.altKey || target.closest("input, textarea, [contenteditable=true], [role=dialog]")) return;
      if (e.key === " " && !revealed && !target.closest("button, a")) { e.preventDefault(); setRevealed(true); }
      const g = GRADES[Number(e.key) - 1];
      if (g && revealed && !busy) { e.preventDefault(); void grade(g); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [card, revealed, busy, grade]);

  const nextIn = (g: Grade) => {
    const days = reviewCard(card!, g, localDay(now())).interval;
    return days === 0 ? t("study.review.now") : t("study.review.days", { count: days });
  };

  return (
    <section aria-label={t("study.review.title")} className="mx-auto flex w-full max-w-2xl flex-col gap-4 p-6">
      <h1 className="text-[length:var(--text-page-title-size)] font-bold">{t("study.review.title")}</h1>
      {failed && <p role="alert" className="text-[var(--c-danger)]">{t("study.review.failed")}</p>}
      {queue === null && <p role="status">{t("app.loading")}</p>}
      {queue !== null && !card && !failed && (
        <div role="status"><EmptyState illustration="pages" title={total === 0 ? t("study.review.none") : t("study.review.done")} hint={total === 0 ? t("study.review.noneHint") : t("study.review.doneHint", { count: answered })} /></div>
      )}
      {card && (
        <>
          <div className="flex flex-col gap-1">
            <p className="text-[length:var(--text-ui-small-size)] text-[var(--c-text-muted)]">{t("study.review.left", { count: queue!.length })}</p>
            <div role="progressbar" aria-label={t("study.review.progress")} aria-valuemin={0} aria-valuemax={planned} aria-valuenow={answered} className="h-1.5 overflow-hidden rounded-full bg-[var(--c-raised)]">
              <div className="h-full rounded-full bg-[var(--c-accent)] transition-[width] duration-200" style={{ width: `${planned ? (answered / planned) * 100 : 0}%` }} />
            </div>
          </div>
          <div className="vn-study">
            <div className="vn-study-head">
              <button type="button" className="mr-auto truncate underline" onClick={() => onOpenPage(card.pageId)}>{card.pageTitle || t("app.untitled")}</button>
              {card.reps === 0 && <span className="vn-study-chip">{t("study.card.new")}</span>}
            </div>
            <div className="flex min-h-56 flex-col justify-center gap-5 p-8 text-center">
              <p className="whitespace-pre-wrap text-[length:var(--text-reading-size)] font-semibold">{card.front}</p>
              {revealed && <p data-testid="answer" className="whitespace-pre-wrap border-t border-[var(--c-border)] pt-5 text-[length:var(--text-reading-size)]">{card.back || t("study.review.noAnswer")}</p>}
            </div>
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            {revealed
              ? GRADES.map((g) => (
                <div key={g} className="flex min-w-28 flex-col items-center gap-1">
                  <Button className="w-full" aria-label={t(`study.review.${g}`)} variant={g === "good" ? "primary" : "secondary"} disabled={busy} onClick={() => void grade(g)}>{t(`study.review.${g}`)}</Button>
                  <span className="text-[length:var(--text-note-size)] text-[var(--c-text-muted)]">{nextIn(g)}</span>
                </div>
              ))
              : <Button variant="primary" aria-label={t("study.review.reveal")} onClick={() => setRevealed(true)}>{t("study.review.reveal")}</Button>}
          </div>
          <p className="text-center text-[length:var(--text-note-size)] text-[var(--c-text-muted)]">{t("study.review.keys")}</p>
        </>
      )}
    </section>
  );
}
