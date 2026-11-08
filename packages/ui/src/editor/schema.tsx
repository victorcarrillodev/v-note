import { BlockNoteSchema, defaultBlockSpecs, defaultInlineContentSpecs } from "@blocknote/core";
import { createReactBlockSpec, createReactInlineContentSpec } from "@blocknote/react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Icon } from "../design/Icon";
import type { IconName } from "../design/iconMap";
import { TaskBlockView, type TaskProps } from "./TaskBlock";
import { codeBlock } from "./CodeBlock";
import { DatabasePicker, EmbeddedDatabaseView } from "../databases/EmbeddedDatabase";
import { DiagramEditor } from "../diagram/DiagramEditor";
import { MentionView } from "./MentionView";
import { MatrixEditor, TimelineEditor, TreeEditor } from "../diagram/Organizers";

export const CALLOUT_VARIANTS = ["info", "success", "warning", "danger"] as const;
type Variant = (typeof CALLOUT_VARIANTS)[number];
const ICON: Record<Variant, IconName> = { info: "info", success: "success", warning: "warning", danger: "error" };
const TONE: Record<Variant, string> = {
  info: "border-[var(--c-accent)] bg-[var(--chip-info-bg)] text-[var(--chip-info-fg)]",
  success: "border-[var(--c-success)] bg-[var(--chip-success-bg)] text-[var(--chip-success-fg)]",
  warning: "border-[var(--c-warning)] bg-[var(--chip-warning-bg)] text-[var(--chip-warning-fg)]",
  danger: "border-[var(--c-danger)] bg-[var(--chip-error-bg)] text-[var(--chip-error-fg)]",
};

export function CalloutView({ variant, onVariant, content }: { variant: string; onVariant: (v: Variant) => void; content: ReactNode }) {
  const { t } = useTranslation();
  const v = (CALLOUT_VARIANTS as readonly string[]).includes(variant) ? (variant as Variant) : "info";
  return (
    <div data-callout-variant={v} className={`flex w-full items-start gap-2 rounded-md border-l-4 p-3 ${TONE[v]}`}>
      <span className="mt-0.5 shrink-0" contentEditable={false}><Icon name={ICON[v]} size={20} /></span>
      <div className="min-w-0 flex-1">
        <div contentEditable={false} className="mb-1 flex items-center gap-2 text-[length:var(--text-ui-small-size)] font-semibold">
          <span data-callout-label>{t(`editor.calloutVariant.${v}`)}</span>
          <select aria-label={t("editor.calloutType")} value={v} onChange={(e) => onVariant(e.target.value as Variant)} className="rounded border border-[var(--c-border)] bg-[var(--c-card)] px-1 font-normal text-[var(--c-text)]">
            {CALLOUT_VARIANTS.map((o) => <option key={o} value={o}>{t(`editor.calloutVariant.${o}`)}</option>)}
          </select>
        </div>
        {content}
      </div>
    </div>
  );
}

/** Aviso destacado: texto editable con un tipo (info, éxito, advertencia, peligro). */
export const calloutBlock = createReactBlockSpec(
  { type: "callout", propSchema: { variant: { default: "info", values: [...CALLOUT_VARIANTS] } }, content: "inline" },
  {
    render: ({ block, editor, contentRef }) => (
      <CalloutView variant={block.props.variant} onVariant={(v) => editor.updateBlock(block, { props: { variant: v } })} content={<div ref={contentRef} />} />
    ),
  },
);

/** Sanea una URL escrita a mano: solo http(s). */
export function safeHttpUrl(raw: string): string | null {
  try {
    const u = new URL(raw.trim());
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}

function LinkCardView({ url, title, onSet }: { url: string; title: string; onSet: (url: string, title: string) => void }) {
  const { t } = useTranslation();
  if (!url) {
    return (
      <form
        contentEditable={false}
        className="flex w-full gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const v = safeHttpUrl(new FormData(e.currentTarget).get("url") as string);
          if (v) onSet(v, new URL(v).hostname);
        }}
      >
        <input name="url" aria-label={t("editor.linkUrl")} placeholder="https://…" className="min-w-0 flex-1 rounded border px-2 py-1" />
        <button type="submit">{t("editor.linkAdd")}</button>
      </form>
    );
  }
  return (
    <a data-link-card href={url} target="_blank" rel="noopener noreferrer" contentEditable={false} className="block w-full rounded border p-3 no-underline">
      <strong className="block">{title || url}</strong>
      <small className="opacity-70">{url}</small>
    </a>
  );
}

/** Tarjeta de enlace web: se escribe la URL y se muestra como tarjeta con el título. */
export const linkCardBlock = createReactBlockSpec(
  { type: "linkCard", propSchema: { url: { default: "" }, title: { default: "" } }, content: "none" },
  { render: ({ block, editor }) => <LinkCardView url={block.props.url} title={block.props.title} onSet={(url, title) => editor.updateBlock(block, { props: { url, title } })} /> },
);

const localNow = () => { const d = new Date(); const p = (n: number) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };

/** Tarea: casilla con fecha límite, recordatorio y repetición (RF-11). */
export const taskBlock = createReactBlockSpec(
  { type: "task", propSchema: { checked: { default: false }, due: { default: "" }, remindAt: { default: "" }, recurrence: { default: "" }, durationMin: { default: "" } }, content: "inline" },
  {
    render: ({ block, editor, contentRef }) => (
      <TaskBlockView
        props={block.props as TaskProps}
        now={localNow()}
        onChange={(patch) => editor.updateBlock(block, { props: patch })}
        content={<div ref={contentRef} />}
      />
    ),
  },
);

/** Vista de una base de datos dentro de la nota, enlazada a la base original (T-264, T-277). */
export const databaseViewBlock = createReactBlockSpec(
  { type: "databaseView", propSchema: { databaseId: { default: "" }, viewId: { default: "" } }, content: "none" },
  {
    render: ({ block, editor }) => (
      <div className="w-full rounded border p-2" contentEditable={false}>
        {block.props.databaseId === "" ? (
          <DatabasePicker onPick={(id) => editor.updateBlock(block, { props: { databaseId: id } })} />
        ) : (
          <EmbeddedDatabaseView databaseId={block.props.databaseId} viewId={block.props.viewId} onViewChange={(id) => editor.updateBlock(block, { props: { viewId: id } })} />
        )}
      </div>
    ),
  },
);

/** Diagrama de flujo: lienzo con formas y conectores; el estado se guarda en el propio bloque (RF-9). */
export const diagramBlock = createReactBlockSpec(
  { type: "diagram", propSchema: { data: { default: "" } }, content: "none" },
  { render: ({ block, editor }) => <DiagramEditor value={block.props.data} onChange={(data) => editor.updateBlock(block, { props: { data } })} /> },
);

const organizerProps = { data: { default: "" } } as const;
/** Organizadores gráficos (RF-10): el estado de cada uno se guarda como texto JSON en el bloque. */
export const mindmapBlock = createReactBlockSpec(
  { type: "mindmap", propSchema: organizerProps, content: "none" },
  { render: ({ block, editor }) => <TreeEditor kind="mindmap" value={block.props.data} onChange={(data) => editor.updateBlock(block, { props: { data } })} /> },
);
export const orgchartBlock = createReactBlockSpec(
  { type: "orgchart", propSchema: organizerProps, content: "none" },
  { render: ({ block, editor }) => <TreeEditor kind="orgchart" value={block.props.data} onChange={(data) => editor.updateBlock(block, { props: { data } })} /> },
);
export const timelineBlock = createReactBlockSpec(
  { type: "timeline", propSchema: organizerProps, content: "none" },
  { render: ({ block, editor }) => <TimelineEditor value={block.props.data} onChange={(data) => editor.updateBlock(block, { props: { data } })} /> },
);
export const matrixBlock = createReactBlockSpec(
  { type: "matrix", propSchema: organizerProps, content: "none" },
  { render: ({ block, editor }) => <MatrixEditor value={block.props.data} onChange={(data) => editor.updateBlock(block, { props: { data } })} /> },
);

/** Mención en línea de otra página (RF-6): guarda el id de destino; el título mostrado se resuelve al dibujarla. */
export const mentionInline = createReactInlineContentSpec(
  { type: "mention", propSchema: { pageId: { default: "" }, title: { default: "" } }, content: "none" },
  { render: ({ inlineContent }) => <MentionView pageId={inlineContent.props.pageId} title={inlineContent.props.title} /> },
);

export const schema = BlockNoteSchema.create({
  inlineContentSpecs: { ...defaultInlineContentSpecs, mention: mentionInline },
  blockSpecs: { ...defaultBlockSpecs, codeBlock: codeBlock(), callout: calloutBlock(), linkCard: linkCardBlock(), task: taskBlock(), databaseView: databaseViewBlock(), diagram: diagramBlock(), mindmap: mindmapBlock(), orgchart: orgchartBlock(), timeline: timelineBlock(), matrix: matrixBlock() },
});
