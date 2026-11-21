import { useEffect, useRef, useState, type ReactNode } from "react";
import * as D from "@radix-ui/react-dropdown-menu";
import { useTranslation } from "react-i18next";
import {
  clampSpan, GALLERY_FITS, galleryCarouselRem, galleryFitOf, galleryLayoutOf, galleryMosaicStyleOf, galleryRowHeightOf, galleryRowRem,
  MAX_GALLERY_IMAGES, MAX_GALLERY_SPAN, parseGallery, serializeGallery,
  type GalleryFit, type GalleryImage, type GalleryLayout, type GalleryMosaicStyle, type GalleryRowHeight,
} from "@vnote/core";
import { Button } from "../components/Button";
import { ChoiceMenu } from "../components/ChoiceMenu";
import { Segmented } from "../components/controls";
import { Icon } from "../design/Icon";

type Resolve = (url: string) => Promise<string>;

/** URLs ya resueltas: si el editor vuelve a dibujar el bloque (cada cambio lo rehace), la imagen aparece al instante, sin parpadeo. */
const RESOLVED = new Map<string, string>();

const MENU = "z-[var(--z-menu)] min-w-48 rounded-md border border-[var(--c-border)] bg-[var(--c-card)] p-1 font-[family-name:var(--font-sans)] text-[length:var(--text-ui-size)] text-[var(--c-text)] shadow-[var(--elevation-3)]";
const ITEM = "flex h-8 cursor-pointer items-center gap-2 rounded px-2 outline-none data-[disabled]:cursor-default data-[disabled]:opacity-40 data-[highlighted]:bg-[var(--c-raised)]";
const GROUP_LABEL = "px-2 pb-0.5 pt-1.5 text-[length:var(--text-label-size)] font-semibold uppercase text-[var(--c-text-muted)]";

/** Menú de una imagen: tamaño en el mosaico personalizado, ajuste y quitar. Un solo botón, para que quepa en cualquier celda. */
function ImageMenu({ label, image, fit, sizable, onSpan, onFit, onRemove }: {
  label: string; image: GalleryImage; fit: GalleryFit; sizable: boolean;
  onSpan: (cols: number, rows: number) => void; onFit: (fit: GalleryFit | "") => void; onRemove: () => void;
}) {
  const { t } = useTranslation();
  return (
    <D.Root modal={false}>
      <D.Trigger aria-label={t("gallery.imageOptions", { name: label })} className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-[var(--c-card)] text-[var(--c-text)] shadow outline-none hover:bg-[var(--c-raised)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--c-accent)]">
        <Icon name="more" />
      </D.Trigger>
      <D.Portal>
        <D.Content sideOffset={4} align="end" className={MENU} onFocusOutside={(e) => e.preventDefault()} onCloseAutoFocus={(e) => e.preventDefault()}>
          {sizable && (
            <>
              <D.Label className={GROUP_LABEL}>{t("gallery.size")} · {image.cols}×{image.rows}</D.Label>
              <D.Item className={ITEM} disabled={image.cols >= MAX_GALLERY_SPAN} onSelect={(e) => { e.preventDefault(); onSpan(image.cols + 1, image.rows); }}>{t("gallery.wider")}</D.Item>
              <D.Item className={ITEM} disabled={image.cols <= 1} onSelect={(e) => { e.preventDefault(); onSpan(image.cols - 1, image.rows); }}>{t("gallery.narrower")}</D.Item>
              <D.Item className={ITEM} disabled={image.rows >= MAX_GALLERY_SPAN} onSelect={(e) => { e.preventDefault(); onSpan(image.cols, image.rows + 1); }}>{t("gallery.taller")}</D.Item>
              <D.Item className={ITEM} disabled={image.rows <= 1} onSelect={(e) => { e.preventDefault(); onSpan(image.cols, image.rows - 1); }}>{t("gallery.shorter")}</D.Item>
              <D.Separator className="my-1 h-px bg-[var(--c-border)]" />
            </>
          )}
          <D.Label className={GROUP_LABEL}>{t("gallery.fitLabel")}</D.Label>
          <D.RadioGroup value={image.fit} onValueChange={(v) => onFit(v === "" ? "" : galleryFitOf(v))}>
            {[["", t("gallery.fitInherit", { fit: t(`gallery.fit.${fit}`) })] as const, ...GALLERY_FITS.map((f) => [f, t(`gallery.fit.${f}`)] as const)].map(([v, text]) => (
              <D.RadioItem key={v || "inherit"} value={v} className={ITEM}>
                <span className="inline-flex w-4 shrink-0 justify-center"><D.ItemIndicator><Icon name="check" size={14} /></D.ItemIndicator></span>
                {text}
              </D.RadioItem>
            ))}
          </D.RadioGroup>
          <D.Separator className="my-1 h-px bg-[var(--c-border)]" />
          <D.Item className={`${ITEM} text-[var(--c-danger)]`} onSelect={onRemove}><Icon name="delete" />{t("gallery.removeImage")}</D.Item>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}

/** Una imagen de la galería: resuelve su dirección `asset:` a una URL que el navegador pueda mostrar. */
function GalleryImageView({ image, resolve, layout, custom, fit, carouselRem, editable, onRemove, onSpan, onFit }: {
  image: GalleryImage; resolve: Resolve; layout: GalleryLayout; custom: boolean; fit: GalleryFit; carouselRem: number; editable: boolean;
  onRemove: () => void; onSpan: (cols: number, rows: number) => void; onFit: (fit: GalleryFit | "") => void;
}) {
  const { t } = useTranslation();
  const [src, setSrc] = useState<string | null>(() => RESOLVED.get(image.url) ?? null);
  const resolveRef = useRef(resolve);
  resolveRef.current = resolve;
  useEffect(() => {
    let alive = true;
    void resolveRef.current(image.url).then((u) => { RESOLVED.set(image.url, u); if (alive) setSrc(u); }).catch(() => { if (alive) setSrc(null); });
    return () => { alive = false; };
  }, [image.url]);
  const label = image.caption || image.name || t("gallery.image");
  const grid = layout === "mosaic";
  const cls = grid ? "min-h-0" : layout === "columns" ? "mb-2 break-inside-avoid" : "w-[min(80%,22rem)] shrink-0 snap-center";
  const style = grid && custom ? { gridColumn: `span ${image.cols}`, gridRow: `span ${image.rows}` } : undefined;
  const objectFit = galleryFitOf(image.fit, fit);
  const imgStyle = layout === "columns" ? undefined : { objectFit, ...(layout === "carousel" ? { height: `${carouselRem}rem` } : {}) };
  const fitCls = grid ? "h-full" : "h-auto";
  return (
    <figure data-gallery-item data-cols={image.cols} data-rows={image.rows} style={style} className={`group relative m-0 ${cls}`}>
      {src ? <img src={src} alt={label} loading="eager" draggable={false} style={imgStyle} className={`block w-full rounded-[var(--radius-md)] bg-[var(--c-raised)] ${fitCls}`} /> : <div role="img" aria-label={label} className={`w-full animate-pulse rounded-[var(--radius-md)] bg-[var(--c-raised)] ${grid ? "h-full" : "aspect-[4/3]"}`} />}
      {image.caption && <figcaption className={grid ? "absolute inset-x-0 bottom-0 rounded-b-[var(--radius-md)] bg-[var(--c-card)]/80 px-2 py-1 text-center text-[length:var(--text-ui-small-size)]" : "mt-1 text-center text-[length:var(--text-ui-small-size)] text-[var(--c-text-muted)]"}>{image.caption}</figcaption>}
      {editable && (
        <span className="absolute right-1.5 top-1.5 opacity-70 transition-opacity focus-within:opacity-100 group-hover:opacity-100 has-[[data-state=open]]:opacity-100">
          <ImageMenu label={label} image={image} fit={fit} sizable={grid && custom} onSpan={onSpan} onFit={onFit} onRemove={onRemove} />
        </span>
      )}
    </figure>
  );
}

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[length:var(--text-label-size)] font-semibold uppercase text-[var(--c-text-muted)]">{label}</span>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

/** Galería de imágenes (mosaico, columnas o carrusel). El estado vive en las propiedades del bloque. */
export function GalleryView({ images, layout, mosaicStyle, fit, rowHeight, editable, resolve, upload, onChange }: {
  images: string; layout: string; mosaicStyle?: string; fit?: string; rowHeight?: string; editable: boolean; resolve: Resolve;
  upload: (file: File) => Promise<string>;
  onChange: (patch: { images?: string; layout?: GalleryLayout; mosaicStyle?: GalleryMosaicStyle; fit?: GalleryFit; rowHeight?: GalleryRowHeight }) => void;
}) {
  const { t } = useTranslation();
  const list = parseGallery(images);
  const mode = galleryLayoutOf(layout);
  const baseFit = galleryFitOf(fit);
  const height = galleryRowHeightOf(rowHeight);
  const custom = mode === "mosaic" && galleryMosaicStyleOf(mosaicStyle) === "custom";
  const input = useRef<HTMLInputElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  const add = async (files: File[]) => {
    const pics = files.filter((f) => f.type.startsWith("image/")).slice(0, Math.max(0, MAX_GALLERY_IMAGES - list.length));
    if (pics.length === 0) return;
    setBusy(true); setError(false);
    const added: GalleryImage[] = [];
    for (const f of pics) {
      try { added.push({ url: await upload(f), name: f.name, caption: "", cols: 1, rows: 1, fit: "" }); } catch { setError(true); }
    }
    setBusy(false);
    if (added.length) onChange({ images: serializeGallery([...list, ...added]) });
  };
  const scroll = (dir: 1 | -1) => track.current?.scrollBy({ left: dir * (track.current.clientWidth * 0.8), behavior: "smooth" });
  const edit = (i: number, patch: Partial<GalleryImage>) => onChange({ images: serializeGallery(list.map((x, j) => (j === i ? { ...x, ...patch } : x))) });

  const body = list.length === 0
    ? <p className="py-8 text-center text-[length:var(--text-ui-size)] text-[var(--c-text-muted)]">{t("gallery.empty")}</p>
    : (
      <div
        ref={track}
        data-gallery-layout={mode}
        style={mode === "mosaic" ? { gridAutoRows: `${galleryRowRem(rowHeight)}rem` } : undefined}
        className={mode === "mosaic" ? "grid grid-cols-4 gap-2 [grid-auto-flow:dense]" : mode === "columns" ? "columns-2 gap-2 sm:columns-3" : "flex snap-x snap-mandatory gap-2 overflow-x-auto pb-2"}
      >
        {list.map((g, i) => (
          <GalleryImageView key={`${g.url}-${i}`} image={g} resolve={resolve} layout={mode} custom={custom} fit={baseFit} carouselRem={galleryCarouselRem(rowHeight)} editable={editable}
            onRemove={() => onChange({ images: serializeGallery(list.filter((_, j) => j !== i)) })}
            onFit={(f) => edit(i, { fit: f })}
            onSpan={(cols, rows) => edit(i, { cols: clampSpan(cols), rows: clampSpan(rows) })} />
        ))}
      </div>
    );

  return (
    <div
      contentEditable={false}
      data-testid="gallery-block"
      aria-label={t("gallery.label")}
      role="group"
      className="w-full rounded-[var(--radius-md)] border border-[var(--c-border)] font-[family-name:var(--font-sans)] text-[length:var(--text-ui-size)]"
      onDragOver={(e) => { if (editable && e.dataTransfer.types.includes("Files")) e.preventDefault(); }}
      onDrop={(e) => { if (!editable || e.dataTransfer.files.length === 0) return; e.preventDefault(); e.stopPropagation(); void add([...e.dataTransfer.files]); }}
    >
      {editable && (
        <div className="flex flex-wrap items-end gap-x-6 gap-y-3 border-b border-[var(--c-border)] bg-[var(--c-raised)] px-3 py-3">
          <Group label={t("gallery.layout")}>
            <Segmented label={t("gallery.layout")} value={mode} onChange={(v) => onChange({ layout: galleryLayoutOf(v) })} options={[
              { value: "mosaic", label: t("gallery.mosaic") }, { value: "columns", label: t("gallery.columns") }, { value: "carousel", label: t("gallery.carousel") },
            ]} />
          </Group>
          {mode === "mosaic" && (
            <Group label={t("gallery.mosaicStyle")}>
              <Segmented label={t("gallery.mosaicStyle")} value={custom ? "custom" : "regular"} onChange={(v) => onChange({ mosaicStyle: galleryMosaicStyleOf(v) })} options={[
                { value: "regular", label: t("gallery.regular") }, { value: "custom", label: t("gallery.custom") },
              ]} />
            </Group>
          )}
          {mode !== "columns" && (
            <>
              <Group label={t("gallery.fitLabel")}>
                <ChoiceMenu label={t("gallery.fitLabel")} value={baseFit} onChange={(v) => onChange({ fit: galleryFitOf(v) })} options={GALLERY_FITS.map((f) => ({ value: f, label: t(`gallery.fit.${f}`) }))} />
              </Group>
              <Group label={t("gallery.height")}>
                <Segmented label={t("gallery.height")} value={height} onChange={(v) => onChange({ rowHeight: galleryRowHeightOf(v) })} options={[
                  { value: "small", label: t("gallery.small") }, { value: "medium", label: t("gallery.medium") }, { value: "large", label: t("gallery.large") },
                ]} />
              </Group>
            </>
          )}
          <div className="ml-auto flex items-center gap-2">
            {busy && <span role="status" className="text-[length:var(--text-ui-small-size)] text-[var(--c-text-muted)]">{t("gallery.uploading")}</span>}
            <Button size="sm" variant="primary" disabled={busy || list.length >= MAX_GALLERY_IMAGES} onClick={() => input.current?.click()}>+ {t("gallery.add")}</Button>
            <input ref={input} type="file" accept="image/*" multiple hidden aria-label={t("gallery.add")} onChange={(e) => { const f = [...(e.target.files ?? [])]; e.target.value = ""; void add(f); }} />
          </div>
        </div>
      )}
      {error && <p role="alert" className="px-3 pt-2 text-[length:var(--text-note-size)] text-[var(--c-danger)]">{t("gallery.failed")}</p>}
      <div className="relative p-3">
        {body}
        {mode === "carousel" && list.length > 1 && (
          <>
            <button type="button" aria-label={t("gallery.previous")} onClick={() => scroll(-1)} className="absolute left-4 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 rotate-180 items-center justify-center rounded-full bg-[var(--c-card)] text-[var(--c-text)] shadow hover:bg-[var(--c-raised)]"><Icon name="expand" /></button>
            <button type="button" aria-label={t("gallery.next")} onClick={() => scroll(1)} className="absolute right-4 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-[var(--c-card)] text-[var(--c-text)] shadow hover:bg-[var(--c-raised)]"><Icon name="expand" /></button>
          </>
        )}
      </div>
    </div>
  );
}
