import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ACCENT_IDS, CONTENT_WIDTHS, FONT_IDS, LEADINGS, LIMITS, TEXT_SIZES, TOC_LEVELS, type FontId, type Page, type PageNode, type PageStats, type StylePatch } from "@vnote/core";
import type { WorkspaceController } from "../../workspace/controller";
import { useWorkspace } from "../../workspace/useController";
import { useUndoToast } from "../../feedback/useUndoToast";
import { useToasts } from "../../feedback/ToastContext";
import { Drawer } from "../../components/Drawer";
import { IconButton } from "../../components/IconButton";
import { Button } from "../../components/Button";
import { Switch } from "../../components/controls";
import { Select } from "../../components/fields";
import { cx } from "../../design/cx";
import { pageFonts } from "../../design/tokens";
import { hasCover } from "../cover";
import { usePageUiStore } from "../pageUiStore";

function find(tree: readonly PageNode[], id: string): Page | null {
  const stack = [...tree];
  while (stack.length) { const n = stack.pop()!; if (n.page.id === id) return n.page; stack.push(...n.children); }
  return null;
}

/** Sección del menú: título y controles. */
function Section({ id, title, children }: { id: string; title: string; children?: ReactNode }) {
  return (
    <section aria-labelledby={`po-${id}`} data-section={id} className="flex flex-col gap-2 border-b border-[var(--c-border)] py-3 first:pt-0 last:border-b-0 last:pb-0">
      <h3 id={`po-${id}`} className="text-[length:var(--text-ui-small-size)] font-semibold uppercase tracking-wide text-[var(--c-text-muted)]">{title}</h3>
      {children}
    </section>
  );
}

const DEFAULT = "";

/** Lista de fuentes: «Predeterminado» y las 10 fuentes, cada nombre escrito en su propia fuente (RF-5.2). Flechas para moverse y elegir. */
function FontList({ label, value, onChange }: { label: string; value: FontId | typeof DEFAULT; onChange: (v: FontId | typeof DEFAULT) => void }) {
  const { t } = useTranslation();
  const root = useRef<HTMLDivElement>(null);
  const options: { id: FontId | typeof DEFAULT; text: string; family?: string }[] = [
    { id: DEFAULT, text: t("pageOptions.default") },
    ...FONT_IDS.map((id) => ({ id, text: pageFonts[id]!.label, family: `var(--font-${id})` })),
  ];
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const dir = e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : e.key === "ArrowUp" || e.key === "ArrowLeft" ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    const i = options.findIndex((o) => o.id === value);
    const next = options[(i + dir + options.length) % options.length]!;
    onChange(next.id);
    requestAnimationFrame(() => root.current?.querySelector<HTMLElement>(`[data-font="${next.id}"]`)?.focus());
  };
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[length:var(--text-ui-small-size)] font-medium">{label}</span>
      <div ref={root} role="radiogroup" aria-label={label} onKeyDown={onKey} className="flex max-h-44 flex-col overflow-y-auto rounded-[var(--radius-md)] border border-[var(--c-border)]">
        {options.map((o) => (
          <button
            key={o.id || "default"} type="button" role="radio" aria-checked={o.id === value} data-font={o.id} tabIndex={o.id === value ? 0 : -1}
            onClick={() => onChange(o.id)} style={o.family ? { fontFamily: o.family } : undefined}
            className={cx("flex h-8 shrink-0 items-center justify-between px-2 text-left text-[length:var(--text-ui-size)] hover:bg-[var(--c-raised)] [@media(pointer:coarse)]:h-11", o.id === value && "bg-[var(--c-raised)] font-semibold")}
          >
            {o.text}{o.id === value && <span aria-hidden="true">✓</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Menú «Opciones de la página» (RF-4): un botón en el extremo derecho de la barra superior que abre una barra lateral derecha con cinco secciones.
 * La página no se atenúa para ver los cambios en vivo. Cada cambio entra al historial y ofrece «Deshacer» (RF-4.6, D-19); Esc, la X o un clic fuera la cierran.
 */
export function PageOptionsMenu({ controller, pageId }: { controller: WorkspaceController; pageId: string }) {
  const { t, i18n } = useTranslation();
  const snap = useWorkspace(controller);
  const announce = useUndoToast();
  const toasts = useToasts();
  const [open, setOpen] = useState(false);
  const [stats, setStats] = useState<PageStats | null>(null);
  // Al pasar a otro panel (selector o ajustes de la portada) el foco no vuelve a este botón: lo recibe el panel nuevo.
  const handoff = useRef(false);
  const page = find(snap.tree, pageId);
  const header = page?.style.header ?? {};
  const [tagDraft, setTagDraft] = useState(header.tagText ?? "");
  useEffect(() => setTagDraft(page?.style.header?.tagText ?? ""), [page?.style.header?.tagText, pageId]);
  // Las estadísticas se recalculan al abrir el menú, no en cada pulsación (RF-8.3).
  useEffect(() => {
    if (!open) return;
    let alive = true;
    setStats(null);
    void controller.pageStats(pageId).then((s) => { if (alive) setStats(s); });
    return () => { alive = false; };
  }, [open, controller, pageId]);
  if (!page) return null;

  const hasC = hasCover(page.cover);
  const undoToast = (message = t("pageOptions.changed")) => announce("page-option", message, async () => { await controller.undoPageProps(page.id); });
  // Cada cambio es una entrada del historial y un aviso con «Deshacer» (D-19).
  const change = (patch: StylePatch) => {
    void controller.patchPageStyle(page.id, patch).then((r) => { if (r.ok) undoToast(); });
  };
  const flag = (key: "titleOverCover" | "tag" | "updated" | "iconOverlap" | "rounded", v: boolean) => change({ header: { [key]: v ? true : undefined } });
  const commitTag = () => {
    const v = tagDraft.trim();
    if (v !== (header.tagText ?? "")) change({ header: { tagText: v === "" ? undefined : v } });
  };
  const style = page.style;
  const fmt = (ms: number) => new Date(ms).toLocaleString(i18n.language, { dateStyle: "medium", timeStyle: "short" });
  const nf = new Intl.NumberFormat(i18n.language);
  const defaultOption = { value: DEFAULT, label: t("pageOptions.default") };

  return (
    <>
    <IconButton icon="settings" label={t("pageOptions.open")} aria-haspopup="dialog" aria-expanded={open} data-page-options-trigger onClick={() => setOpen((o) => !o)} />
    <Drawer
      open={open} onOpenChange={setOpen} title={t("pageOptions.title")} size="m" modal={false} keepOpenOn="[data-page-options-trigger]"
      restoreFocus={() => { const back = !handoff.current; handoff.current = false; return back; }}
    >
      <div role="group" aria-label={t("pageOptions.title")} className="flex flex-col">
        <Section id="typography" title={t("pageOptions.sections.typography")}>
          <Select label={t("pageOptions.spacing.textSize")} value={style.spacing?.textSize ?? DEFAULT} onChange={(v) => change({ spacing: { textSize: v === DEFAULT ? undefined : (v as (typeof TEXT_SIZES)[number]) } })}
            options={[defaultOption, ...TEXT_SIZES.map((s) => ({ value: s, label: t(`pageOptions.spacing.textSizes.${s}`) }))]} />
          <FontList label={t("pageOptions.typography.body")} value={style.typography?.body ?? DEFAULT} onChange={(v) => change({ typography: { body: v === DEFAULT ? undefined : v } })} />
          <FontList label={t("pageOptions.typography.headings")} value={style.typography?.headings ?? DEFAULT} onChange={(v) => change({ typography: { headings: v === DEFAULT ? undefined : v } })} />
        </Section>

        <Section id="spacing" title={t("pageOptions.sections.spacing")}>
          <Select label={t("pageOptions.spacing.width")} value={style.spacing?.width ?? DEFAULT} onChange={(v) => change({ spacing: { width: v === DEFAULT ? undefined : (v as (typeof CONTENT_WIDTHS)[number]) } })}
            options={[defaultOption, ...CONTENT_WIDTHS.map((w) => ({ value: w, label: t(`pageOptions.spacing.widths.${w}`) }))]} />
          <Select label={t("pageOptions.spacing.leading")} value={style.spacing?.leading ?? DEFAULT} onChange={(v) => change({ spacing: { leading: v === DEFAULT ? undefined : (v as (typeof LEADINGS)[number]) } })}
            options={[defaultOption, ...LEADINGS.map((l) => ({ value: l, label: t(`pageOptions.spacing.leadings.${l}`) }))]} />
        </Section>

        <Section id="header" title={t("pageOptions.sections.header")}>
          <Switch label={t("pageOptions.header.titleOverCover")} disabled={!hasC} checked={header.titleOverCover === true} onChange={(v) => flag("titleOverCover", v)} />
          <Switch label={t("pageOptions.header.description")} checked={header.description === true || (header.description !== false && page.description !== null)} onChange={(v) => change({ header: { description: v } })} />
          <Switch label={t("pageOptions.header.tag")} checked={header.tag === true} onChange={(v) => flag("tag", v)} />
          {header.tag === true && (
            <label className="flex flex-col gap-1 text-[length:var(--text-ui-small-size)]">
              {t("pageOptions.header.tagText")}
              <input
                value={tagDraft} maxLength={LIMITS.tagText.max} placeholder={t("pageOptions.header.tagTextHint")}
                onChange={(e) => setTagDraft(e.target.value)} onBlur={commitTag} onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
                className="h-8 rounded-[var(--radius-md)] bg-[var(--c-raised)] px-2 text-[length:var(--text-ui-size)]"
              />
            </label>
          )}
          <Switch label={t("pageOptions.header.updated")} checked={header.updated === true} onChange={(v) => flag("updated", v)} />
          <Switch label={t("pageOptions.header.iconOverlap")} disabled={!hasC} checked={header.iconOverlap === true} onChange={(v) => flag("iconOverlap", v)} />
          <Switch label={t("pageOptions.header.gradient")} disabled={!hasC} checked={header.gradient ?? header.titleOverCover === true} onChange={(v) => change({ header: { gradient: v } })} />
          <Switch label={t("pageOptions.header.rounded")} checked={header.rounded === true} onChange={(v) => flag("rounded", v)} />
          <div className="flex flex-wrap gap-2 pt-1">
            {!page.locked && <Button size="sm" onClick={() => { handoff.current = true; setOpen(false); usePageUiStore.getState().openPicker(); }}>{t("pageOptions.header.changeCover")}</Button>}
            {hasC && !page.locked && <Button size="sm" onClick={() => { handoff.current = true; setOpen(false); usePageUiStore.getState().openAdjust(); }}>{t("pageOptions.header.adjustCover")}</Button>}
          </div>
        </Section>

        <Section id="toc" title={t("pageOptions.sections.toc")}>
          <Switch label={t("pageOptions.toc.floating")} checked={style.toc?.floating !== false} onChange={(v) => change({ toc: { floating: v ? undefined : false } })} />
          <Select label={t("pageOptions.toc.levels")} value={String(style.toc?.maxLevel ?? 3)} onChange={(v) => change({ toc: { maxLevel: Number(v) === 3 ? undefined : (Number(v) as (typeof TOC_LEVELS)[number]) } })}
            options={TOC_LEVELS.map((l) => ({ value: String(l), label: t(`pageOptions.toc.levelOptions.${l}`) }))} />
        </Section>

        <Section id="page" title={t("pageOptions.sections.page")}>
          <Switch label={t("pageOptions.page.lock")} checked={page.locked} onChange={(v) => void controller.setPageProps(page.id, { locked: v }).then((r) => { if (r.ok) undoToast(); })} />
          <div role="radiogroup" aria-label={t("pageOptions.page.accent")} className="flex flex-col gap-1">
            <span className="text-[length:var(--text-ui-small-size)] font-medium">{t("pageOptions.page.accent")}</span>
            <div className="flex flex-wrap items-center gap-1.5">
              <button type="button" role="radio" aria-checked={style.accent === undefined} onClick={() => change({ accent: undefined })}
                className="h-8 rounded-[var(--radius-md)] border border-[var(--c-border-control)] px-2 text-[length:var(--text-ui-small-size)] aria-checked:border-[var(--c-accent)] aria-checked:font-semibold [@media(pointer:coarse)]:h-11">{t("pageOptions.default")}</button>
              {ACCENT_IDS.map((id) => (
                <button key={id} type="button" role="radio" aria-checked={style.accent === id} aria-label={t(`diagram.colors.${id}`)} title={t(`diagram.colors.${id}`)} data-accent={id}
                  onClick={() => change({ accent: id })} style={{ background: `var(--block-${id}-text)` }}
                  className="h-8 w-8 rounded-full border border-[var(--c-border-control)] aria-checked:outline aria-checked:outline-2 aria-checked:outline-offset-2 aria-checked:outline-[var(--c-text)] [@media(pointer:coarse)]:h-11 [@media(pointer:coarse)]:w-11" />
              ))}
            </div>
          </div>
          <dl aria-label={t("pageOptions.page.stats")} className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5 text-[length:var(--text-ui-small-size)]">
            <dt className="text-[var(--c-text-muted)]">{t("pageOptions.page.words")}</dt><dd data-stat="words">{stats ? nf.format(stats.words) : "…"}</dd>
            <dt className="text-[var(--c-text-muted)]">{t("pageOptions.page.characters")}</dt><dd data-stat="characters">{stats ? nf.format(stats.characters) : "…"}</dd>
            <dt className="text-[var(--c-text-muted)]">{t("pageOptions.page.reading")}</dt><dd data-stat="reading">{stats ? (stats.readingMinutes === 0 ? t("pageOptions.page.readingNone") : t("pageOptions.page.readingMinutes", { count: stats.readingMinutes })) : "…"}</dd>
            <dt className="text-[var(--c-text-muted)]">{t("pageOptions.page.created")}</dt><dd>{fmt(page.createdAt)}</dd>
            <dt className="text-[var(--c-text-muted)]">{t("pageOptions.page.updated")}</dt><dd>{fmt(page.updatedAt)}</dd>
          </dl>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button size="sm" disabled={Object.keys(style).length === 0}
              onClick={() => void controller.resetPageStyle(page.id).then((r) => { if (r.ok) undoToast(t("pageOptions.page.resetDone")); })}>{t("pageOptions.page.reset")}</Button>
            <Button size="sm" onClick={() => void controller.usePageStyleAsDefault(page.id).then((r) => { if (r.ok) toasts.add({ key: "page-default", tone: "success", message: t("pageOptions.page.defaultSaved") }); })}>{t("pageOptions.page.setDefault")}</Button>
          </div>
        </Section>
      </div>
    </Drawer>
    </>
  );
}
