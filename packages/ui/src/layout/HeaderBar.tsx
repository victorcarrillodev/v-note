import { useTranslation } from "react-i18next";
import { Icon } from "../design/Icon";
import { Button } from "../components/Button";
import { Menu } from "../components/Menu";
import { truncateBreadcrumbs, type Crumb } from "./breadcrumbs";
import { relativeParts } from "./relativeTime";
import type { SaveStatus } from "./saveStatus";

const MAX_CRUMBS = 4;

/** Contenido de la cabecera del marco: migas de pan navegables y estado de guardado discreto (plan 10.3). */
export function HeaderBar({ crumbs, onNavigate, status, onRetry, lastEditedAt, now }: {
  crumbs: readonly Crumb[]; onNavigate: (id: string) => void; status: SaveStatus; onRetry: () => void; lastEditedAt?: number; now?: number;
}) {
  const { t } = useTranslation();
  const parts = truncateBreadcrumbs(crumbs, MAX_CRUMBS);
  const edited = lastEditedAt !== undefined && now !== undefined ? relativeParts(Math.max(0, now - lastEditedAt)) : null;
  const editedText = edited ? t(`header.edited.${edited.key}`, { count: edited.count }) : undefined;

  return (
    <>
      <nav aria-label={t("header.route")} className="min-w-0 flex-1">
        <ol className="flex min-w-0 items-center gap-1 text-[length:var(--text-ui-small-size)]">
          {parts.map((p, i) => {
            const isLast = i === parts.length - 1;
            return (
              <li key={p.kind === "item" ? p.item.id : "gap"} className="flex min-w-0 items-center gap-1">
                {p.kind === "gap" ? (
                  <Menu label={t("header.hiddenCrumbs")} items={p.hidden.map((h) => ({ label: h.title.trim() === "" ? t("app.untitled") : h.title, icon: "note", onSelect: () => onNavigate(h.id) }))} />
                ) : isLast ? (
                  <span aria-current="page" title={p.item.title} className="truncate font-medium text-[var(--c-text)]">{p.item.title.trim() === "" ? t("app.untitled") : p.item.title}</span>
                ) : (
                  <button type="button" onClick={() => onNavigate(p.item.id)} title={p.item.title} className="max-w-48 truncate rounded px-1 text-[var(--c-text-muted)] hover:bg-[var(--c-raised)] hover:text-[var(--c-text)]">
                    {p.item.title.trim() === "" ? t("app.untitled") : p.item.title}
                  </button>
                )}
                {!isLast && <Icon name="expand" size={14} />}
              </li>
            );
          })}
        </ol>
      </nav>
      {status.kind === "error" ? (
        <div role="alert" className="flex shrink-0 items-center gap-2 text-[length:var(--text-ui-small-size)] text-[var(--c-danger)]">
          <Icon name="error" />
          <span>{t("header.saveFailed")} · {status.message}</span>
          <Button size="sm" onClick={onRetry}>{t("header.retry")}</Button>
        </div>
      ) : (
        <div role="status" {...(editedText ? { title: editedText } : {})} className="flex shrink-0 items-center gap-1 text-[length:var(--text-note-size)] text-[var(--c-text-muted)]">
          <Icon name={status.kind === "saving" ? "loading" : "check"} size={14} {...(status.kind === "saving" ? { className: "animate-spin motion-reduce:animate-none" } : {})} />
          <span>{status.kind === "saving" ? t("header.saving") : t("header.saved")}</span>
        </div>
      )}
    </>
  );
}
