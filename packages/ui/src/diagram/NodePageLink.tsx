import { useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import type { LinkTarget } from "@vnote/core";
import { PANEL_BUTTON } from "./panelStyles";

type Props = {
  /** Página enlazada ahora (vacío = sin enlace). */
  page: string | undefined;
  resolve: (pageId: string) => Promise<LinkTarget>;
  find: (query: string) => Promise<{ id: string; title: string }[]>;
  open: (pageId: string) => void;
  /** Id de la página elegida, o `null` para quitar el enlace. */
  onSet: (pageId: string | null) => void;
};

/** Sección «Página» de la forma seleccionada: busca una página para enlazarla, abre la enlazada o quita el enlace. */
export function NodePageLink({ page, resolve, find, open, onSet }: Props) {
  const { t } = useTranslation();
  const listId = useId();
  const [target, setTarget] = useState<LinkTarget | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ id: string; title: string }[] | null>(null);

  useEffect(() => {
    if (!page) { setTarget(null); return; }
    let live = true;
    void resolve(page).then((r) => { if (live) setTarget(r); }, () => { if (live) setTarget({ state: "missing", id: page, title: "" }); });
    return () => { live = false; };
  }, [page, resolve]);

  useEffect(() => {
    if (query.trim() === "") { setResults(null); return; }
    let live = true;
    void find(query.trim()).then((r) => { if (live) setResults(r); }, () => { if (live) setResults([]); });
    return () => { live = false; };
  }, [query, find]);

  const pick = (id: string) => { onSet(id); setQuery(""); setResults(null); };

  if (page) {
    const state = target?.state ?? "ok";
    const title = (target?.title ?? "").trim() || t("app.untitled");
    return (
      <div className="flex w-full flex-col gap-1.5" data-state={state}>
        {state === "missing"
          ? <p role="status" className="text-[var(--c-warning)]">{t("diagram.pageLink.missing")}</p>
          : <p className="truncate font-medium">{title}{state === "trashed" ? <span className="ml-2 text-[var(--c-warning)]">{t("links.inTrash")}</span> : null}</p>}
        <div className="flex flex-wrap gap-1.5">
          {state !== "missing" && <button type="button" className={PANEL_BUTTON} onClick={() => open(page)}>{t("diagram.pageLink.open")}</button>}
          <button type="button" className={PANEL_BUTTON} onClick={() => onSet(null)}>{t("diagram.pageLink.remove")}</button>
        </div>
      </div>
    );
  }
  return (
    <div className="flex w-full flex-col gap-1.5">
      <input
        role="combobox" aria-expanded={results !== null} aria-controls={listId} aria-autocomplete="list" aria-label={t("diagram.pageLink.label")}
        placeholder={t("diagram.pageLink.placeholder")} value={query} onChange={(e) => setQuery(e.target.value)} autoComplete="off"
        className="h-8 rounded-[var(--radius-md)] border border-[var(--c-border-control)] bg-[var(--c-card)] px-2"
        onKeyDown={(e) => e.stopPropagation()}
      />
      {results !== null && (
        results.length === 0
          ? <p role="status" className="text-[var(--c-text-muted)]">{t("diagram.pageLink.none")}</p>
          : <ul id={listId} role="listbox" className="flex max-h-40 flex-col overflow-auto">
              {results.map((r) => (
                <li key={r.id} role="option" aria-selected={false} tabIndex={0} className="cursor-pointer truncate rounded px-2 py-1 hover:bg-[var(--c-raised)]"
                  onClick={() => pick(r.id)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); pick(r.id); } }}>
                  {r.title.trim() || t("app.untitled")}
                </li>
              ))}
            </ul>
      )}
    </div>
  );
}
