import { useTranslation } from "react-i18next";
import type { DatabaseController } from "./databaseController";
import { useFormatValue } from "./cells";
import { titleOf } from "./viewHelpers";
import { useDatabase } from "./useDatabase";

type Props = { controller: DatabaseController; onOpenRow?: (pageId: string) => void };

function useRows(controller: DatabaseController) {
  const snap = useDatabase(controller);
  const props = (snap.result?.visibleProperties ?? []).map((id) => snap.properties.find((p) => p.id === id)).filter((p): p is NonNullable<typeof p> => !!p);
  return { rows: snap.result?.rows ?? [], props };
}

/** Vista lista (T-271): una línea por fila con su título y sus valores. */
export function ListView({ controller, onOpenRow }: Props) {
  const { t } = useTranslation();
  const format = useFormatValue();
  const { rows, props } = useRows(controller);
  if (rows.length === 0) return <p className="opacity-70">{t("databases.empty")}</p>;
  return (
    <ul className="flex flex-col divide-y">
      {rows.map((r) => (
        <li key={r.pageId} className="flex flex-wrap items-baseline gap-3 py-2">
          <span className="font-medium">{titleOf(r, t("databases.untitled"))}</span>
          {props.map((p) => { const v = format(p, r.values[p.id]); return v ? <span key={p.id} className="text-sm opacity-75">{p.name}: {v}</span> : null; })}
          {onOpenRow && <button type="button" className="ml-auto" aria-label={t("databases.openRow", { title: titleOf(r, t("databases.untitled")) })} onClick={() => onOpenRow(r.pageId)}>↗</button>}
        </li>
      ))}
    </ul>
  );
}

/** Vista galería (T-272): una tarjeta por fila. */
export function GalleryView({ controller, onOpenRow }: Props) {
  const { t } = useTranslation();
  const format = useFormatValue();
  const { rows, props } = useRows(controller);
  if (rows.length === 0) return <p className="opacity-70">{t("databases.empty")}</p>;
  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(14rem, 1fr))" }}>
      {rows.map((r) => {
        const title = titleOf(r, t("databases.untitled"));
        return (
          <article key={r.pageId} aria-label={title} className="flex flex-col gap-1 rounded border p-3">
            <div className="flex items-start gap-1"><strong className="flex-1 break-words">{title}</strong>{onOpenRow && <button type="button" aria-label={t("databases.openRow", { title })} onClick={() => onOpenRow(r.pageId)}>↗</button>}</div>
            {props.map((p) => { const v = format(p, r.values[p.id]); return v ? <span key={p.id} className="text-sm opacity-75">{p.name}: {v}</span> : null; })}
          </article>
        );
      })}
    </div>
  );
}
