import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { TAG_COLORS, parseIcon, type Property, type QueryRow } from "@vnote/core";
import { PageIcon } from "../page/icon/PageIcon";
import { EmptyState } from "../empty/EmptyState";
import { IconButton } from "../components/IconButton";
import { Icon } from "../design/Icon";
import { cx } from "../design/cx";
import { coverBackground, coverImageHash } from "../page/cover";
import { useCoverImage } from "../page/cover/useCoverImage";
import { useDatabaseAssets } from "./AssetsContext";
import type { DatabaseController } from "./databaseController";
import { useFormatValue } from "./cells";
import { titleOf } from "./viewHelpers";
import { useDatabase } from "./useDatabase";

type Props = { controller: DatabaseController; onOpenRow?: (pageId: string) => void };
type Meta = Record<string, { icon: string | null; cover: string | null }>;

function useRows(controller: DatabaseController) {
  const snap = useDatabase(controller);
  const props = (snap.result?.visibleProperties ?? []).map((id) => snap.properties.find((p) => p.id === id)).filter((p): p is NonNullable<typeof p> => !!p);
  const rows = snap.result?.rows ?? [];
  const [meta, setMeta] = useState<Meta>({});
  const key = rows.map((r) => r.pageId).join(",");
  useEffect(() => {
    let alive = true;
    void controller.rowMeta(rows.map((r) => r.pageId)).then((m) => { if (alive) setMeta(m); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controller, key]);
  return { rows, props, meta };
}

/** Color de una opción: un nombre de la paleta de bloques o neutro. */
const optionStyle = (color: string | undefined) => (color && (TAG_COLORS as readonly string[]).includes(color) ? { background: `var(--block-${color}-bg)`, color: `var(--block-${color}-text)` } : undefined);

/** Valores de una fila como píldoras: las opciones con su color y el resto como texto; el nombre de la propiedad va en el título. */
function ValueChips({ row, props, className }: { row: QueryRow; props: Property[]; className?: string }) {
  const format = useFormatValue();
  const items = props.flatMap((p) => {
    const v = row.values[p.id];
    if (v === null || v === undefined) return [];
    if ((p.type === "select" || p.type === "status") && typeof v === "string") { const o = p.config.options?.find((x) => x.id === v); return o ? [{ key: p.id, name: p.name, text: o.name, style: optionStyle(o.color) }] : []; }
    if (p.type === "multi_select" && Array.isArray(v)) return v.flatMap((id) => { const o = p.config.options?.find((x) => x.id === id); return o ? [{ key: `${p.id}:${id}`, name: p.name, text: o.name, style: optionStyle(o.color) }] : []; });
    const text = format(p, v);
    return text ? [{ key: p.id, name: p.name, text, style: undefined }] : [];
  });
  if (items.length === 0) return null;
  return (
    <div className={cx("flex flex-wrap items-center gap-1", className)}>
      {items.map((i) => (
        <span key={i.key} title={i.name} style={i.style} className={cx("inline-flex h-5 max-w-full items-center truncate rounded-full px-2 text-[length:var(--text-ui-small-size)]", !i.style && "bg-[var(--c-raised)] text-[var(--c-text-muted)]")}>{i.text}</span>
      ))}
    </div>
  );
}

const PageGlyph = ({ icon, size }: { icon: string | null | undefined; size: number }) => {
  const assets = useDatabaseAssets();
  return parseIcon(icon) ? <PageIcon icon={icon} assets={assets} size={size} /> : <span aria-hidden="true" className="shrink-0 text-[var(--c-text-muted)]"><Icon name="note" size={size > 16 ? 20 : 16} /></span>;
};

/** Vista lista (T-271): una fila por página, con su ícono, su título y sus valores como píldoras. */
export function ListView({ controller, onOpenRow }: Props) {
  const { t } = useTranslation();
  const { rows, props, meta } = useRows(controller);
  if (rows.length === 0) return <EmptyState illustration="table" title={t("databases.empty")} />;
  return (
    <div className="flex flex-col">
      <ul className="flex flex-col">
        {rows.map((r) => {
          const title = titleOf(r, t("databases.untitled"));
          return (
            <li key={r.pageId} onClick={() => onOpenRow?.(r.pageId)} className={cx("group/row flex min-h-10 flex-wrap items-center gap-x-3 gap-y-1 rounded-[var(--radius-md)] px-2 py-1.5 hover:bg-[var(--c-raised)]", onOpenRow && "cursor-pointer")}>
              <PageGlyph icon={meta[r.pageId]?.icon} size={18} />
              <span className="min-w-0 truncate font-medium">{title}</span>
              <ValueChips row={r} props={props} className="min-w-0 flex-1" />
              {onOpenRow && <IconButton icon="expand" label={t("databases.openRow", { title })} className="opacity-0 focus-visible:opacity-100 group-hover/row:opacity-100" onClick={(e) => { e.stopPropagation(); onOpenRow(r.pageId); }} />}
            </li>
          );
        })}
      </ul>
      <button type="button" onClick={() => void controller.addRow("")} className="flex h-9 w-full items-center gap-2 rounded-[var(--radius-md)] px-2 text-left text-[length:var(--text-ui-size)] text-[var(--c-text-muted)] hover:bg-[var(--c-raised)]"><Icon name="create" size={16} />{t("databases.newRow")}</button>
    </div>
  );
}

/** Zona de portada de una tarjeta: imagen del almacén, degradado o color de la portada de la página; sin portada, su ícono grande y tenue. */
function CardCover({ cover, icon, fit, height, children }: { cover: string | null | undefined; icon: string | null | undefined; fit: "cover" | "contain"; height: string; children?: React.ReactNode }) {
  const assets = useDatabaseAssets();
  const hash = coverImageHash(cover);
  const src = useCoverImage(assets, hash);
  const bg = coverBackground(cover);
  return (
    <div data-testid="card-cover" className={cx("relative flex items-center justify-center overflow-hidden bg-[var(--c-raised)]", height)} style={bg ? { background: bg } : undefined}>
      {src ? <img alt="" src={src} draggable={false} className={cx("h-full w-full", fit === "contain" ? "object-contain" : "object-cover")} />
        : !bg && <span className="opacity-40"><PageGlyph icon={icon} size={34} /></span>}
      {children}
    </div>
  );
}

const CARD_MIN = { small: "11rem", medium: "15rem", large: "21rem" } as const;
const CARD_COVER_H = { small: "h-24", medium: "h-36", large: "h-52" } as const;

/** Vista galería (T-272): tarjetas como en Notion, con la portada arriba, el título con su ícono y los valores como píldoras. */
export function GalleryView({ controller, onOpenRow }: Props) {
  const { t } = useTranslation();
  const snap = useDatabase(controller);
  const { rows, props, meta } = useRows(controller);
  const cfg = snap.views.find((v) => v.id === snap.activeViewId)?.config ?? {};
  const size = cfg.cardSize ?? "medium";
  if (rows.length === 0) return <EmptyState illustration="table" title={t("databases.empty")} />;
  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${CARD_MIN[size]}, 1fr))` }}>
      {rows.map((r) => {
        const title = titleOf(r, t("databases.untitled"));
        const m = meta[r.pageId];
        return (
          <article key={r.pageId} aria-label={title} onClick={() => onOpenRow?.(r.pageId)}
            className={cx("group/card flex flex-col overflow-hidden rounded-[var(--radius-lg)] border border-[var(--c-border)] bg-[var(--c-card)] transition-[box-shadow,transform] duration-150 hover:-translate-y-0.5 hover:shadow-[var(--elevation-2)] motion-reduce:transition-none motion-reduce:hover:translate-y-0", onOpenRow && "cursor-pointer")}>
            {cfg.showCover !== false && (
              <CardCover cover={m?.cover} icon={m?.icon} fit={cfg.coverFit ?? "cover"} height={CARD_COVER_H[size]}>
                {onOpenRow && <IconButton icon="expand" label={t("databases.openRow", { title })} className="absolute right-2 top-2 bg-[var(--c-card)]/80 opacity-0 backdrop-blur-sm focus-visible:opacity-100 group-hover/card:opacity-100" onClick={(e) => { e.stopPropagation(); onOpenRow(r.pageId); }} />}
              </CardCover>
            )}
            <div className="flex flex-col gap-2 p-3">
              <div className="flex items-center gap-2"><PageGlyph icon={m?.icon} size={16} /><strong className="min-w-0 flex-1 break-words font-semibold">{title}</strong>
                {cfg.showCover === false && onOpenRow && <IconButton icon="expand" label={t("databases.openRow", { title })} className="opacity-0 focus-visible:opacity-100 group-hover/card:opacity-100" onClick={(e) => { e.stopPropagation(); onOpenRow(r.pageId); }} />}
              </div>
              <ValueChips row={r} props={props} />
            </div>
          </article>
        );
      })}
      <button type="button" onClick={() => void controller.addRow("")} className="flex min-h-48 items-center justify-center gap-2 rounded-[var(--radius-lg)] border border-dashed border-[var(--c-border-control)] text-[length:var(--text-ui-size)] text-[var(--c-text-muted)] transition-colors duration-150 hover:bg-[var(--c-raised)] hover:text-[var(--c-text)]">
        <Icon name="create" size={16} />{t("databases.newRow")}
      </button>
    </div>
  );
}
