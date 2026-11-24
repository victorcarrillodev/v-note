import { ExternalLink } from "../components/ExternalLink";
import { useEffect, useRef, useState, type ClipboardEvent, type DragEvent, type KeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { useTranslation } from "react-i18next";
import { type AssetStore, type CornerRadius, type Page, type PageNode, type StylePatch } from "@vnote/core";
import type { WorkspaceController } from "../workspace/controller";
import { useUndoToast } from "../feedback/useUndoToast";
import { PageTags } from "../tags/PageTags";
import { Button } from "../components/Button";
import { Chip } from "../components/Chip";
import { useBleedBox } from "./cover/useBleedBox";
import { InlineAlert } from "../components/InlineAlert";
import { Tooltip } from "../components/Tooltip";
import { hasCover } from "./cover";
import { CoverArt } from "./cover/CoverArt";
import { CoverPicker, type CoverApply } from "./cover/CoverPicker";
import { CoverAdjust, type CoverPreview } from "./cover/CoverAdjust";
import { useCoverImport } from "./cover/useCoverImport";
import { dragPosition, keyPosition, type Pos } from "./cover/reposition";
import type { CoverImportDeps } from "./cover/importCoverImage";
import { IconPicker } from "./icon/IconPicker";
import { PageIcon } from "./icon/PageIcon";
import { importIconImage, type IconImportDeps, type IconImportError } from "./icon/importIconImage";
import { usePageUiStore } from "./pageUiStore";
import { usePagePropsUndo } from "./usePagePropsUndo";
import { relativeParts } from "../layout/relativeTime";
import { useWorkspace } from "../workspace/useController";
import { Icon } from "../design/Icon";
import { cx } from "../design/cx";

/** Acciones de la página: discretas (texto atenuado) hasta pasar el puntero, como en un editor de notas. */
const ACTION = "inline-flex h-7 items-center gap-1.5 rounded-[var(--radius-md)] px-2 text-[length:var(--text-ui-small-size)] text-[var(--c-text-muted)] transition-colors duration-100 hover:bg-[var(--c-raised)] hover:text-[var(--c-text)] [@media(pointer:coarse)]:h-11";
const MENU_ITEM = "flex items-center gap-2 rounded-[var(--radius-base)] px-2 py-1 text-left text-[length:var(--text-ui-small-size)] text-[var(--c-text)] hover:bg-[var(--c-raised)] [@media(pointer:coarse)]:py-3";
/** Botón translúcido sobre la portada: visible al pasar el puntero o con foco dentro de la cabecera; siempre en pantallas táctiles (RF-1.7). */
const COVER_BTN = "inline-flex h-8 items-center gap-1.5 rounded-[var(--radius-md)] bg-black/50 px-2.5 text-[length:var(--text-ui-small-size)] text-white opacity-0 backdrop-blur-sm transition-opacity duration-100 hover:bg-black/65 focus-visible:opacity-100 group-hover/header:opacity-100 group-focus-within/header:opacity-100 data-[state=open]:opacity-100 [@media(pointer:coarse)]:h-11 [@media(pointer:coarse)]:opacity-100";
/** Texto blanco con sombra suave sobre la imagen oscurecida (RF-1.7, DP-16). */
const ON_COVER = "text-white [text-shadow:0_1px_3px_rgba(0,0,0,0.6)]";
const DEFAULT_ROUNDED_RADIUS = 16;
const IMAGE_TYPES = /^image\/(png|jpeg|webp)$/;

/** Busca una página en el árbol y devuelve su ruta de ancestros (iterativo). */
function locate(tree: readonly PageNode[], id: string): { page: Page; ancestors: Page[] } | null {
  const stack: { node: PageNode; ancestors: Page[] }[] = tree.map((node) => ({ node, ancestors: [] }));
  while (stack.length) {
    const { node, ancestors } = stack.pop()!;
    if (node.page.id === id) return { page: node.page, ancestors };
    for (const c of node.children) stack.push({ node: c, ancestors: [...ancestors, node.page] });
  }
  return null;
}

const grow = (el: HTMLTextAreaElement) => { el.style.height = "auto"; el.style.height = `${el.scrollHeight}px`; };

/** Fecha de actualización relativa («hoy», «ayer», «hace 3 días») con la fecha exacta al pasar el puntero o enfocarla (RF-1.5). */
function UpdatedLabel({ at, now, onCover }: { at: number; now: number; onCover: boolean }) {
  const { t, i18n } = useTranslation();
  const p = relativeParts(Math.max(0, now - at));
  const days = Math.floor(Math.max(0, now - at) / 86_400_000);
  const when = p.key !== "days" ? t("pageHeader.today") : days <= 1 ? t("pageHeader.yesterday") : t("pageHeader.daysAgo", { count: days });
  const exact = t("pageHeader.updatedExact", { date: new Date(at).toLocaleString(i18n.language, { dateStyle: "long", timeStyle: "short" }) });
  return (
    <Tooltip label={exact}>
      <time dateTime={new Date(at).toISOString()} tabIndex={0} className={cx("rounded-sm text-[length:var(--text-ui-small-size)]", onCover ? ON_COVER : "text-[var(--c-text-muted)]")}>{t("pageHeader.updated", { when })}</time>
    </Tooltip>
  );
}

export function PageHeader({ controller, pageId, onExport, assets, workspaceName = "", now, optimize, iconEncode }: {
  controller: WorkspaceController; pageId: string; onNavigate?: (id: string) => void; onExport?: (id: string) => void;
  /** Almacén de archivos del espacio: sin él no se pueden subir imágenes como portada. */
  assets?: AssetStore | undefined; workspaceName?: string; now?: number; optimize?: CoverImportDeps["optimize"]; iconEncode?: IconImportDeps["encode"];
}) {
  const { t } = useTranslation();
  const snap = useWorkspace(controller);
  const announce = useUndoToast();
  const trash = (id: string) => void controller.trashPageUndoable(id).then((r) => { if (r.ok) announce("trash", t("toast.trashed"), r.value.undo); });
  const duplicate = (id: string, withChildren: boolean) => void controller.duplicateUndoable(id, { withChildren }).then((r) => { if (r.ok) announce("duplicate", t("toast.duplicated"), r.value.undo); });
  const found = locate(snap.tree, pageId);
  const title = found?.page.title ?? "";
  const description = found?.page.description ?? "";
  const [draft, setDraft] = useState(title);
  const [descDraft, setDescDraft] = useState(description);
  const [editingDesc, setEditingDesc] = useState(false);
  const [iconOpen, setIconOpen] = useState(false);
  const [iconBusy, setIconBusy] = useState(false);
  const [iconError, setIconError] = useState<IconImportError | null>(null);
  const [dupOpen, setDupOpen] = useState(false);
  const [warn, setWarn] = useState<{ id: string; name: string }[] | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [preview, setPreview] = useState<CoverPreview | null>(null);
  const [repositioning, setRepositioning] = useState<Pos | null>(null);
  const [dropping, setDropping] = useState(false);
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const coverRef = useRef<HTMLDivElement>(null);
  const bleed = useBleedBox(coverRef, [pageId, found?.page.cover]);
  const areaRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ start: Pos; x: number; y: number } | null>(null);
  const untitledOnOpen = found !== null && found.page.title === "";
  const imp = useCoverImport(controller, pageId, assets, optimize);
  usePagePropsUndo(controller, pageId);
  useEffect(() => setDraft(title), [title, pageId]);
  useEffect(() => setDescDraft(description), [description, pageId]);
  useEffect(() => { setRepositioning(null); setPreview(null); }, [pageId]);
  // Al empezar a reposicionar el foco pasa al área, para que las flechas funcionen sin hacer clic.
  const isRepositioning = repositioning !== null;
  useEffect(() => { if (isRepositioning) areaRef.current?.focus(); }, [isRepositioning]);
  // Una página nueva (sin título) recibe el foco para escribir de inmediato.
  useEffect(() => { if (untitledOnOpen) titleRef.current?.focus(); }, [pageId]); // eslint-disable-line react-hooks/exhaustive-deps

  // El menú de opciones (en la barra superior) pide abrir el selector o los ajustes de la portada (RF-4.2).
  const pickerRequest = usePageUiStore((s) => s.pickerRequest);
  const adjustRequest = usePageUiStore((s) => s.adjustRequest);
  const seen = useRef({ pickerRequest, adjustRequest });
  // Se abre un instante después: el menú que lo pidió se está cerrando y devuelve el foco a su botón, lo que cerraría el selector recién abierto.
  useEffect(() => {
    if (pickerRequest === seen.current.pickerRequest) return;
    seen.current.pickerRequest = pickerRequest;
    const id = setTimeout(() => setPickerOpen(true), 0);
    return () => clearTimeout(id);
  }, [pickerRequest]);
  useEffect(() => {
    if (adjustRequest === seen.current.adjustRequest) return;
    seen.current.adjustRequest = adjustRequest;
    const id = setTimeout(() => setAdjustOpen(true), 0);
    return () => clearTimeout(id);
  }, [adjustRequest]);

  if (!found) return null;
  const { page } = found;
  const locked = page.locked;
  const header = page.style.header ?? {};
  const coverStyle = page.style.cover ?? {};
  const hasC = hasCover(page.cover);
  // Sin portada, las piezas que dependen de ella no se muestran y la cabecera es la clásica, sin huecos (RF-1.6).
  const card = hasC && header.titleOverCover === true;
  const iconOverlap = hasC && header.iconOverlap === true;
  const showDesc = header.description === true || (header.description !== false && page.description !== null);
  const clock = now ?? Date.now();
  const tagText = header.tagText?.trim() || workspaceName;

  const commitTitle = () => { if (!locked && draft !== page.title) void controller.renamePage(page.id, draft); };
  const onTitleKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter") { e.preventDefault(); commitTitle(); }
    if (e.key === "Escape") { setDraft(page.title); }
  };
  const commitDesc = () => { setEditingDesc(false); if (!locked && descDraft !== (page.description ?? "")) void controller.setPageProps(page.id, { description: descDraft.trim() === "" ? null : descDraft }); };
  const onDescKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); }
    if (e.key === "Escape") { setDescDraft(page.description ?? ""); setEditingDesc(false); }
  };
  const setStyle = (patch: StylePatch) => void controller.patchPageStyle(page.id, patch);
  const applyCover = (p: CoverApply) => void controller.setPageProps(page.id, p);

  // Radio efectivo: el ajuste de esquinas manda; si no hay, un ajuste antiguo de «esquinas redondeadas» (ya sin opción propia) pone un radio de serie (RF-1.3).
  const radius: CornerRadius | undefined = preview?.radius ?? (coverStyle.radius !== undefined ? coverStyle.radius : header.rounded ? DEFAULT_ROUNDED_RADIUS : undefined);
  // Con esquinas redondeadas la portada se separa de los lados y de arriba, más cuanto mayor es el radio, para que se vea la curva.
  const maxRadius = radius === undefined ? 0 : Array.isArray(radius) ? Math.max(...radius) : radius;
  const inset = Math.min(Math.round(maxRadius * 1.5), 64);
  // Los botones y el crédito sobre la portada se meten lo justo para no tocar la curva de su esquina.
  const cornerR = (i: number) => (radius === undefined ? 0 : Array.isArray(radius) ? radius[i]! : radius);
  const pad = (i: number, base: number) => Math.max(base, Math.round(cornerR(i) * 0.5));
  const artStyle = {
    ...page.style,
    cover: { ...coverStyle, ...(preview?.overlay !== undefined ? { overlay: preview.overlay } : {}), ...(radius !== undefined ? { radius } : {}) },
  };

  // — Reposicionar (RF-3.1): arrastrar o usar el teclado; «Guardar» es una sola entrada del historial —
  const onRepositionKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!repositioning) return;
    if (e.key === "Escape") { e.preventDefault(); setRepositioning(null); return; }
    const next = keyPosition(repositioning, e.key, e.shiftKey);
    if (next) { e.preventDefault(); setRepositioning(next); }
  };
  const onDragStart = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!repositioning) return;
    drag.current = { start: repositioning, x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onDragMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current, el = coverRef.current;
    if (!d || !el) return;
    const rect = el.getBoundingClientRect();
    const img = el.querySelector("img");
    const natural = img && img.naturalWidth > 0 ? { w: img.naturalWidth, h: img.naturalHeight } : null;
    setRepositioning(dragPosition(d.start, { dx: e.clientX - d.x, dy: e.clientY - d.y }, { w: rect.width, h: rect.height }, natural));
  };
  const saveReposition = () => { if (repositioning) setStyle({ cover: { posX: repositioning.x, posY: repositioning.y } }); setRepositioning(null); };

  // — Arrastrar o pegar una imagen sobre la cabecera la usa como portada (CL-7) —
  const imageFrom = (files: FileList | null | undefined): File | null => Array.from(files ?? []).find((f) => IMAGE_TYPES.test(f.type)) ?? null;
  const canDrop = imp.canImport && !locked;
  const onDragOver = (e: DragEvent<HTMLDivElement>) => { if (canDrop && Array.from(e.dataTransfer?.items ?? []).some((i) => i.kind === "file")) { e.preventDefault(); setDropping(true); } };
  const onDrop = (e: DragEvent<HTMLDivElement>) => { setDropping(false); const f = imageFrom(e.dataTransfer?.files); if (canDrop && f) { e.preventDefault(); void imp.importFile(f); } };
  const onPaste = (e: ClipboardEvent<HTMLDivElement>) => { const f = imageFrom(e.clipboardData?.files); if (canDrop && f) { e.preventDefault(); void imp.importFile(f); } };

  const changeBtn = (
    <button type="button" className={COVER_BTN}><Icon name="image" size={14} />{t("cover.change")}</button>
  );
  const uploadIcon = (file: File) => {
    if (!assets) return;
    setIconBusy(true); setIconError(null);
    void importIconImage(file, { assets, setIcon: (icon) => controller.setIcon(pageId, icon), ...(iconEncode ? { encode: iconEncode } : {}) }).then((r) => {
      setIconBusy(false);
      if (r.ok) setIconOpen(false); else setIconError(r.error);
    });
  };
  const iconPicker = (trigger: ReactNode) => (
    <IconPicker trigger={trigger} open={iconOpen} onOpenChange={(o) => { setIconOpen(o); if (!o) setIconError(null); }} hasIcon={page.icon !== null}
      canUpload={assets !== undefined} uploading={iconBusy} error={iconError}
      onEmoji={(emoji) => void controller.setIcon(pageId, emoji)} onFile={uploadIcon} onRemove={() => void controller.setIcon(pageId, null)} />
  );
  const picker = (trigger: ReactNode) => (
    <CoverPicker trigger={trigger} open={pickerOpen} onOpenChange={(o) => { setPickerOpen(o); if (!o) imp.clear(); }} hasCover={hasC}
      canUpload={imp.canImport} error={imp.error} onApply={applyCover} onFile={(f) => { void imp.importFile(f); }}
      onUnsplash={(photo) => { void imp.importUnsplash(photo).then((ok) => { if (ok) setPickerOpen(false); }); }} unsplashBusy={imp.busy && imp.stage === "download"} unsplashError={imp.unsplashError} />
  );

  const titleField = (onCover: boolean) => (
    <textarea
      ref={titleRef} rows={1} readOnly={locked} data-page-title=""
      aria-label={t("page.titleLabel")} placeholder={t("page.titlePlaceholder")}
      value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={commitTitle} onKeyDown={onTitleKey}
      onInput={(e) => grow(e.currentTarget)}
      className={cx("min-w-0 flex-1 resize-none overflow-hidden break-words bg-transparent text-[length:var(--text-page-title-size)] font-bold leading-tight outline-none", onCover ? cx(ON_COVER, "placeholder:text-white/70") : "placeholder:text-[var(--c-text-muted)]")}
    />
  );

  const descriptionField = (onCover: boolean) => {
    if (!showDesc) return null;
    const cls = cx("w-full break-words bg-transparent text-left text-[length:var(--text-ui-size)]", onCover ? ON_COVER : "text-[var(--c-text-muted)]");
    // Fuera de edición se corta en dos líneas; al editar se ve completa (CL-4).
    return editingDesc && !locked ? (
      <textarea
        autoFocus rows={1} maxLength={280} aria-label={t("pageHeader.description")} placeholder={t("pageHeader.descriptionPlaceholder")}
        value={descDraft} onChange={(e) => setDescDraft(e.target.value)} onBlur={commitDesc} onKeyDown={onDescKey}
        onFocus={(e) => grow(e.currentTarget)} onInput={(e) => grow(e.currentTarget)}
        className={cx(cls, "resize-none overflow-hidden outline-none placeholder:opacity-70")}
      />
    ) : (
      <button type="button" disabled={locked} aria-label={`${t("pageHeader.description")}: ${page.description ?? t("pageHeader.descriptionPlaceholder")}`} onClick={() => setEditingDesc(true)} onFocus={() => !locked && setEditingDesc(true)}
        className={cx(cls, "line-clamp-2 cursor-text", !page.description && "opacity-70")}>
        {page.description ?? t("pageHeader.descriptionPlaceholder")}
      </button>
    );
  };

  const metaRow = (onCover: boolean) => (header.tag || header.updated) ? (
    <div className="flex flex-wrap items-center gap-2">
      {header.tag && tagText && (
        <span aria-label={t("pageHeader.tagLabel")} className={cx("inline-flex rounded-sm", onCover && "bg-white/20 backdrop-blur-sm")}>
          <Chip tone="neutral">{tagText}</Chip>
        </span>
      )}
      {header.updated && <UpdatedLabel at={page.updatedAt} now={clock} onCover={onCover} />}
    </div>
  ) : null;

  const iconNode = <PageIcon icon={page.icon} assets={assets} size={iconOverlap ? 36 : 32} />;
  const iconBox = page.icon && (
    <span data-testid="page-icon" className={cx("shrink-0", iconOverlap && "absolute -bottom-7 left-6 z-10 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--c-card)] shadow-[var(--elevation-2)]")}>
      {locked ? iconNode : iconPicker(<button type="button" aria-label={t("page.changeIcon")} className="inline-flex items-center justify-center rounded-[var(--radius-md)] hover:bg-[var(--c-raised)]">{iconNode}</button>)}
    </span>
  );

  const coverControls = !locked && (
    <div className="absolute z-10 flex gap-2 transition-[top,right] duration-300 ease-out motion-reduce:transition-none" style={{ top: pad(1, 12), right: pad(1, 12) }}>
      {!repositioning && (
        <CoverAdjust trigger={<button type="button" className={COVER_BTN}><Icon name="settings" size={14} />{t("cover.adjust")}</button>}
          open={adjustOpen} onOpenChange={setAdjustOpen} style={page.style} onStyle={setStyle} onPreview={setPreview}
          onReposition={() => setRepositioning({ x: coverStyle.posX ?? 50, y: coverStyle.posY ?? 50 })} />
      )}
      {!repositioning && picker(changeBtn)}
    </div>
  );

  const repositionBar = repositioning && (
    <div className="absolute inset-x-0 bottom-3 z-10 flex flex-col items-center gap-2">
      <p className="rounded-[var(--radius-md)] bg-black/60 px-2 py-1 text-[length:var(--text-note-size)] text-white">{t("cover.repositionHint")}</p>
      <div className="flex gap-2">
        <Button variant="primary" size="sm" onClick={saveReposition}>{t("cover.repositionSave")}</Button>
        <Button size="sm" onClick={() => setRepositioning(null)} className="bg-[var(--c-card)]">{t("cover.repositionCancel")}</Button>
      </div>
    </div>
  );

  return (
    <div
      data-testid="page-header" data-mode={card ? "card" : "classic"} onDragOver={onDragOver} onDragLeave={() => setDropping(false)} onDrop={onDrop} onPaste={onPaste}
      className={cx("group/header relative flex flex-col gap-2", dropping && "outline-dashed outline-2 outline-[var(--c-accent)]")}
    >
      {dropping && <p role="status" className="rounded-[var(--radius-md)] bg-[var(--chip-info-bg)] p-2 text-[length:var(--text-ui-small-size)] text-[var(--chip-info-fg)]">{t("cover.dropHint")}</p>}

      {imp.busy && (
        <div role="status" className="inline-flex items-center gap-2 text-[length:var(--text-ui-small-size)] text-[var(--c-text-muted)]">
          <Icon name="loading" size={14} className="animate-spin motion-reduce:animate-none" />{imp.stage === "download" ? t("unsplash.downloading") : t("cover.processing")}
        </div>
      )}
      {(imp.lowRes || (imp.error && !pickerOpen)) && (
        <div data-testid="cover-alerts" className="relative z-30 flex flex-col gap-2 shadow-[var(--shadow-md,0_4px_12px_rgb(0_0_0/0.35))]">
        {imp.lowRes && <InlineAlert tone="warning" onDismiss={imp.clear} dismissLabel={t("toast.close")}>{t("cover.lowRes")}</InlineAlert>}
        {imp.error && !pickerOpen && <InlineAlert tone="error" onDismiss={imp.clear} dismissLabel={t("toast.close")}>{t(({ empty: "cover.errEmpty", tooLarge: "cover.errTooLarge", unsupported: "cover.errUnsupported", corrupt: "cover.errCorrupt", save: "cover.errSave" } as const)[imp.error])}</InlineAlert>}
        </div>
      )}

      {locked && (
        <button type="button" data-testid="lock-indicator" onClick={() => void controller.setPageProps(page.id, { locked: false })} aria-label={t("pageHeader.unlock")} title={t("pageHeader.unlock")}
          className="inline-flex h-7 items-center gap-1.5 self-start rounded-[var(--radius-md)] bg-[var(--c-raised)] px-2 text-[length:var(--text-ui-small-size)] text-[var(--c-text)] hover:bg-[var(--c-border)] [@media(pointer:coarse)]:h-11">
          <Icon name="lock" size={14} />{t("pageHeader.locked")}
        </button>
      )}

      {hasC && (
        <div ref={coverRef} data-testid="cover-bleed" className={cx("relative transition-[width,margin] duration-300 ease-out motion-reduce:transition-none", iconOverlap && page.icon && "mb-7")}
          style={bleed
            ? { width: bleed.width - 2 * inset, marginLeft: bleed.left + inset, marginTop: inset - bleed.top }
            : { width: `calc(100cqw - ${2 * inset}px)`, marginLeft: `calc(50% - 50cqw + ${inset}px)`, marginTop: `${inset - 24}px` }}>
          <CoverArt cover={page.cover} style={artStyle} assets={assets} grow={card} positionOverride={repositioning ?? undefined}
            darken={header.gradient ?? card}>
            {coverControls}
            {repositioning && (
              <div ref={areaRef} role="group" tabIndex={0} aria-label={t("cover.repositionArea")} data-testid="reposition-area" onKeyDown={onRepositionKey}
                onPointerDown={onDragStart} onPointerMove={onDragMove} onPointerUp={() => { drag.current = null; }}
                className="absolute inset-0 z-[5] cursor-grab touch-none active:cursor-grabbing" />
            )}
            {repositionBar}
            {page.coverCredit && page.cover?.startsWith("asset:") && (
              <p data-testid="cover-credit" style={{ bottom: pad(2, 6), right: pad(2, 12) }} className="absolute bottom-1.5 right-3 z-10 rounded-sm bg-black/50 px-1.5 py-0.5 text-[length:var(--text-note-size)] text-white">
                {t("cover.creditBy")}{" "}
                <ExternalLink href={page.coverCredit.authorUrl} className="underline">{page.coverCredit.author}</ExternalLink>{" "}
                {t("cover.creditOn")}{" "}
                <ExternalLink href={page.coverCredit.photoUrl} className="underline">{t(`cover.src.${page.coverCredit.source}`)}</ExternalLink>
              </p>
            )}
            {card && (
              <div className="relative mx-auto flex min-h-[inherit] w-full max-w-[var(--size-reading-width)] flex-col justify-end gap-2 px-6 pb-6 pt-16 max-sm:px-4 max-sm:pb-4">
                {metaRow(true)}
                <div className="flex items-end gap-3">
                  {!iconOverlap && iconBox}
                  {titleField(true)}
                </div>
                {descriptionField(true)}
              </div>
            )}
          </CoverArt>
          {iconOverlap && <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10"><div className="relative mx-auto w-full max-w-[var(--size-reading-width)]">{iconBox}</div></div>}
        </div>
      )}

      {!card && (
        <>
          {metaRow(false)}
          <div className="flex items-center gap-2">
            {(!hasC || !iconOverlap) && iconBox}
            {titleField(false)}
          </div>
          {descriptionField(false)}
        </>
      )}

      <PageTags controller={controller} pageId={page.id} />

      <div className="-ml-2 flex flex-wrap items-center gap-0.5 text-sm">
        {page.icon ? (
          <button type="button" className={ACTION} onClick={() => void controller.setIcon(page.id, null)}><Icon name="emoji" size={14} />{t("page.removeIcon")}</button>
        ) : (
          iconPicker(<button type="button" className={ACTION}><Icon name="emoji" size={14} />{t("page.addIcon")}</button>)
        )}

        {!hasC && !locked && picker(<button type="button" className={ACTION}><Icon name="image" size={14} />{t("page.addCover")}</button>)}

        <button type="button" className={cx(ACTION, page.favorite && "text-[var(--c-text)]")} aria-pressed={page.favorite} onClick={() => void controller.toggleFavorite(page.id)}>
          <Icon name="favorite" size={14} />{page.favorite ? t("page.unfavorite") : t("page.favorite")}
        </button>

        <div className="relative">
          <button type="button" className={ACTION} aria-haspopup="menu" aria-expanded={dupOpen} onClick={() => setDupOpen((o) => !o)}><Icon name="duplicate" size={14} />{t("page.duplicate")}</button>
          {dupOpen && (
            <div role="menu" className="absolute z-10 mt-1 flex min-w-max flex-col rounded-[var(--radius-lg)] border border-[var(--c-border)] bg-[var(--c-card)] p-1 shadow-[var(--elevation-3)]">
              <button type="button" role="menuitem" className={MENU_ITEM} onClick={() => { duplicate(page.id, false); setDupOpen(false); }}><Icon name="duplicate" size={14} />{t("page.duplicateOnlyThis")}</button>
              <button type="button" role="menuitem" className={MENU_ITEM} onClick={() => { duplicate(page.id, true); setDupOpen(false); }}><Icon name="folder" size={14} />{t("page.duplicateWithChildren")}</button>
            </div>
          )}
        </div>


        {onExport && <button type="button" className={ACTION} onClick={() => onExport(page.id)}><Icon name="export" size={14} />{t("export.action")}</button>}

        <button type="button" className={cx(ACTION, "hover:text-[var(--c-danger)]")} onClick={() => void controller.describeRemoval(page.id).then((d) => { if (d.needsWarning) setWarn(d.databases); else trash(page.id); })}><Icon name="delete" size={14} />{t("page.delete")}</button>
        <AlertDialog.Root open={warn !== null} onOpenChange={(o) => !o && setWarn(null)}>
          <AlertDialog.Portal>
            <AlertDialog.Overlay className="fixed inset-0 bg-black/40" />
            <AlertDialog.Content className="fixed left-1/2 top-1/2 w-[28rem] -translate-x-1/2 -translate-y-1/2 rounded bg-[var(--bg)] p-4 shadow">
              <AlertDialog.Title className="font-semibold">{t("page.deleteInDatabasesTitle")}</AlertDialog.Title>
              <AlertDialog.Description className="my-2 text-sm">{t("page.deleteInDatabases", { count: warn?.length ?? 0 })}</AlertDialog.Description>
              <ul className="mb-3 list-disc pl-5 text-sm">{(warn ?? []).map((d) => <li key={d.id}>{d.name.trim() === "" ? t("app.untitled") : d.name}</li>)}</ul>
              <div className="flex justify-end gap-2">
                <AlertDialog.Cancel asChild><button type="button">{t("page.cancel")}</button></AlertDialog.Cancel>
                <button type="button" onClick={() => { setWarn(null); trash(page.id); }}>{t("page.deleteEverywhere")}</button>
              </div>
            </AlertDialog.Content>
          </AlertDialog.Portal>
        </AlertDialog.Root>
      </div>
    </div>
  );
}
