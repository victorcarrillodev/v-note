import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { SuggestionMenuController, getDefaultReactSlashMenuItems, useCreateBlockNote } from "@blocknote/react";
import { filterSuggestionItems, insertOrUpdateBlockForSlashMenu } from "@blocknote/core";
import { schema } from "./schema";
import { DatabaseEmbedProvider } from "../databases/EmbeddedDatabase";
import { BlockNoteView } from "@blocknote/mantine";
import { withCollaboration } from "@blocknote/core/yjs";
import { en as bnEn, es as bnEs } from "@blocknote/core/locales";
import { Awareness } from "y-protocols/awareness";
import { countBlocks, serializeMatrix, template2x2, type DocSession } from "@vnote/core";
import { LargePageNotice } from "./LargePageNotice";
import { LinkProvider, type LinkApi } from "./LinkContext";
import { Backlinks } from "./Backlinks";
import { InboxTriage } from "./InboxTriage";
import type { AssetStore } from "@vnote/core";
import { createFileHandlers } from "./fileHandlers";
import type { WorkspaceController } from "../workspace/controller";
import { useTheme } from "../theme/theme";
import { handlePaste } from "./pasteHandler";
import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";

/** Editor de bloques de una página. El documento vive en Yjs y se guarda solo (DocSession). */
export function PageEditor({ controller, pageId, assets }: { controller: WorkspaceController; pageId: string; assets?: AssetStore }) {
  const { t } = useTranslation();
  const [session, setSession] = useState<DocSession | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [blocks, setBlocks] = useState(0);
  const [notes, setNotes] = useState<string[]>([]);
  const handlers = useMemo(
    () => (assets ? createFileHandlers(assets, {
      onWarning: (name) => setNotes((n) => [...n, t("editor.notBackedUp", { name })]),
      onError: (message) => setNotes((n) => [...n, t("editor.attachFailed", { message })]),
    }) : null),
    [assets, t],
  );

  const links = useMemo<LinkApi>(() => ({
    resolve: (id) => controller.resolveLink(id),
    open: (id) => void controller.select(id),
    restore: async (id) => { await controller.restore(id); },
  }), [controller]);

  useEffect(() => {
    let cancelled = false;
    let opened: DocSession | null = null;
    let stopCounting = () => {};
    setSession(null);
    setSaveError(null);
    void controller
      .openDocument(pageId, (m) => setSaveError(m))
      .then((s) => {
        if (cancelled) { void s.dispose(); return; }
        opened = s;
        const frag = s.doc.getXmlFragment("doc");
        setBlocks(countBlocks(frag));
        // Se recuenta con retardo para no frenar la escritura en páginas enormes.
        let timer: ReturnType<typeof setTimeout> | undefined;
        const onUpdate = () => { clearTimeout(timer); timer = setTimeout(() => setBlocks(countBlocks(frag)), 800); };
        s.doc.on("update", onUpdate);
        stopCounting = () => { clearTimeout(timer); s.doc.off("update", onUpdate); };
        setSession(s);
      });
    // Al ocultar o cerrar la ventana se fuerza el guardado de lo pendiente.
    const flush = () => void opened?.flush();
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", flush);
    return () => {
      cancelled = true;
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", flush);
      stopCounting();
      void opened?.dispose();
    };
  }, [controller, pageId]);

  return (
    <div className="mt-4">
      {saveError && (
        <p role="alert" className="mb-2 rounded border border-red-500 bg-red-50 p-2 text-sm text-red-900">
          {t("editor.saveFailed", { message: saveError })}
        </p>
      )}
      <InboxTriage controller={controller} pageId={pageId} />
      <LargePageNotice blocks={blocks} />
      {notes.map((n, i) => (
        <p key={i} role="status" className="mb-2 rounded border border-amber-500 bg-amber-50 p-2 text-sm text-amber-900">
          {n} <button type="button" onClick={() => setNotes((all) => all.filter((_, j) => j !== i))}>{t("editor.dismiss")}</button>
        </p>
      ))}
      {session ? <DatabaseEmbedProvider value={{ list: () => controller.listDatabases(), open: (id) => controller.openDatabaseById(id), openRow: (id) => void controller.select(id) }}><LinkProvider value={links}><Editor key={pageId} session={session} handlers={handlers} findPages={(q) => controller.findPages(q)} /></LinkProvider></DatabaseEmbedProvider> : <p role="status" className="opacity-70">{t("app.loading")}</p>}
      {session ? <Backlinks controller={controller} pageId={pageId} /> : null}
    </div>
  );
}

function Editor({ session, handlers, findPages }: { session: DocSession; handlers: ReturnType<typeof createFileHandlers> | null; findPages: (query: string) => Promise<{ id: string; title: string }[]> }) {
  const { i18n, t } = useTranslation();
  const { resolved } = useTheme();
  const collaboration = useMemo(
    () => ({ fragment: session.doc.getXmlFragment("doc"), provider: { awareness: new Awareness(session.doc) }, user: { name: "yo", color: "#3366cc" } }),
    [session],
  );
  const editor = useCreateBlockNote(
    { ...withCollaboration({ collaboration }), schema, domAttributes: { editor: { "aria-label": t("editor.label") } }, pasteHandler: handlePaste, ...(handlers ? { uploadFile: handlers.uploadFile, resolveFileURL: handlers.resolveFileUrl } : {}), dictionary: i18n.language.startsWith("es") ? bnEs : bnEn },
    [session, i18n.language],
  );
  /** Menú de menciones (`@` o `[[`): páginas que coinciden con lo escrito. */
  const mentionItems = async (query: string) => {
    const found = await findPages(query);
    if (found.length === 0) return [{ title: t("links.noResults"), onItemClick: () => {} }];
    return found.map((p) => ({
      title: p.title.trim() || t("app.untitled"),
      onItemClick: () => editor.insertInlineContent([{ type: "mention", props: { pageId: p.id, title: p.title } }, " "]),
    }));
  };
  const items = async (query: string) =>
    filterSuggestionItems(
      [
        ...getDefaultReactSlashMenuItems(editor),
        { title: t("editor.callout"), subtext: t("editor.calloutHint"), aliases: ["aviso", "callout", "nota"], group: t("editor.customGroup"),
          onItemClick: () => insertOrUpdateBlockForSlashMenu(editor, { type: "callout" }) },
        { title: t("task.slash"), subtext: t("task.slashHint"), aliases: ["tarea", "task", "pendiente", "recordatorio", "todo"], group: t("editor.customGroup"),
          onItemClick: () => insertOrUpdateBlockForSlashMenu(editor, { type: "task" }) },
        { title: t("embed.slash"), subtext: t("embed.slashHint"), aliases: ["base", "database", "tabla", "vista", "tablero"], group: t("editor.customGroup"),
          onItemClick: () => insertOrUpdateBlockForSlashMenu(editor, { type: "databaseView" }) },
        { title: t("diagram.slash"), subtext: t("diagram.slashHint"), aliases: ["diagrama", "flujo", "flowchart", "diagram"], group: t("editor.customGroup"),
          onItemClick: () => insertOrUpdateBlockForSlashMenu(editor, { type: "diagram" }) },
        { title: t("organizer.mindmap.slash"), subtext: t("organizer.mindmap.hint"), aliases: ["mapa", "mental", "mindmap", "ideas"], group: t("editor.customGroup"),
          onItemClick: () => insertOrUpdateBlockForSlashMenu(editor, { type: "mindmap" }) },
        { title: t("organizer.orgchart.slash"), subtext: t("organizer.orgchart.hint"), aliases: ["organigrama", "orgchart", "jerarquia"], group: t("editor.customGroup"),
          onItemClick: () => insertOrUpdateBlockForSlashMenu(editor, { type: "orgchart" }) },
        { title: t("organizer.timeline.slash"), subtext: t("organizer.timeline.hint"), aliases: ["linea", "tiempo", "timeline", "cronologia"], group: t("editor.customGroup"),
          onItemClick: () => insertOrUpdateBlockForSlashMenu(editor, { type: "timeline" }) },
        { title: t("organizer.matrix.slash"), subtext: t("organizer.matrix.hint"), aliases: ["matriz", "matrix", "2x2", "cuadrante"], group: t("editor.customGroup"),
          onItemClick: () => insertOrUpdateBlockForSlashMenu(editor, { type: "matrix", props: { data: serializeMatrix(template2x2()) } }) },
        { title: t("editor.linkCard"), subtext: t("editor.linkCardHint"), aliases: ["enlace", "link", "url", "tarjeta"], group: t("editor.customGroup"),
          onItemClick: () => insertOrUpdateBlockForSlashMenu(editor, { type: "linkCard" }) },
      ],
      query,
    );
  return (
    <BlockNoteView editor={editor} theme={resolved} data-testid="editor" slashMenu={false}>
      <SuggestionMenuController triggerCharacter="/" getItems={items} />
      <SuggestionMenuController triggerCharacter="@" getItems={mentionItems} />
      <SuggestionMenuController triggerCharacter="[[" getItems={mentionItems} />
    </BlockNoteView>
  );
}
