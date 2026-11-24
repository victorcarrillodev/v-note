import { useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { CONTENT_WIDTHS, LEADINGS, LIMITS, TEXT_SIZES, TOC_LEVELS, type Page, type PageNode, type PageStats, type StylePatch } from "@vnote/core";
import type { WorkspaceController } from "../../workspace/controller";
import { useWorkspace } from "../../workspace/useController";
import { useUndoToast } from "../../feedback/useUndoToast";
import { useToasts } from "../../feedback/ToastContext";
import { Drawer } from "../../components/Drawer";
import { IconButton } from "../../components/IconButton";
import { Button } from "../../components/Button";
import { Switch } from "../../components/controls";
import { Select } from "../../components/fields";
import { hasCover } from "../cover";
import { usePageUiStore } from "../pageUiStore";
import { AccentPicker } from "./AccentPicker";
import { FontSelect } from "./FontSelect";

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
  const flag = (key: "titleOverCover" | "tag" | "updated" | "iconOverlap", v: boolean) => change({ header: { [key]: v ? true : undefined } });
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
          <FontSelect label={t("pageOptions.typography.body")} value={style.typography?.body ?? DEFAULT} onChange={(v) => change({ typography: { body: v === DEFAULT ? undefined : v } })} />
          <FontSelect label={t("pageOptions.typography.headings")} value={style.typography?.headings ?? DEFAULT} onChange={(v) => change({ typography: { headings: v === DEFAULT ? undefined : v } })} />
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
          <AccentPicker value={style.accent} onChange={(v) => change({ accent: v })} />
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
