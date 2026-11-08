import { useEffect, useMemo, useState } from "react";
import { TableOfContents, type JumpBehavior } from "../page/TableOfContents";
import { extractHeadings, activeHeading, type Heading } from "../page/toc";
import { buildSlashItems } from "./slashItems";
import { InlineAlert } from "../components/InlineAlert";
import { useTranslation } from "react-i18next";
import { SuggestionMenuController, useCreateBlockNote } from "@blocknote/react";
import { schema } from "./schema";
import { DatabaseEmbedProvider } from "../databases/EmbeddedDatabase";
import { BlockNoteView } from "@blocknote/mantine";
import { withCollaboration } from "@blocknote/core/yjs";
import { en as bnEn, es as bnEs } from "@blocknote/core/locales";
import { Awareness } from "y-protocols/awareness";
import { clearDiagramDefaults, countBlocks, fromYjs, loadDiagramDefaults, saveEdgeDefault, saveShapeDefault, type DocSession } from "@vnote/core";
import { LargePageNotice } from "./LargePageNotice";
import { LinkProvider, type LinkApi } from "./LinkContext";
import { DiagramDefaultsProvider, type DiagramDefaultsApi } from "../diagram/DiagramDefaults";
import { Backlinks } from "./Backlinks";
import { InboxTriage } from "./InboxTriage";
import type { AssetStore } from "@vnote/core";
import { createFileHandlers } from "./fileHandlers";
import type { WorkspaceController } from "../workspace/controller";
import { useTheme } from "../theme/theme";
import { saveStatusStore } from "../layout/saveStatusStore";
import { handlePaste } from "./pasteHandler";
import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";
import "./editor.css";

/** Editor de bloques de una página. El documento vive en Yjs y se guarda solo (DocSession). */
export function PageEditor({ controller, pageId, assets }: { controller: WorkspaceController; pageId: string; assets?: AssetStore }) {
  const { t } = useTranslation();
  const [session, setSession] = useState<DocSession | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [blocks, setBlocks] = useState(0);
  const [headings, setHeadings] = useState<Heading[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [notes, setNotes] = useState<string[]>([]);
  useEffect(() => {
    if (headings.length === 0) return;
    const tops = () => Object.fromEntries(headings.map((h) => [h.id, document.querySelector(`[data-id="${h.id}"]`)?.getBoundingClientRect().top ?? Infinity]));
    const onScroll = () => setActiveId(activeHeading(headings, tops(), 96));
    onScroll();
    window.addEventListener("scroll", onScroll, true);
    return () => window.removeEventListener("scroll", onScroll, true);
  }, [headings]);
  const jumpTo = (id: string, behavior: JumpBehavior) => document.querySelector(`[data-id="${id}"]`)?.scrollIntoView?.({ behavior, block: "start" });
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

  // Estilos predeterminados de los diagramas: viven en la base de este espacio de trabajo.
  const diagramDefaults = useMemo<DiagramDefaultsApi>(() => ({
    load: () => loadDiagramDefaults(controller.store),
    saveShape: async (style) => { await saveShapeDefault(controller.store, style); },
    saveEdge: async (style, route) => { await saveEdgeDefault(controller.store, style, route); },
    reset: () => clearDiagramDefaults(controller.store),
  }), [controller]);

  useEffect(() => {
    let cancelled = false;
    let opened: DocSession | null = null;
    let stopCounting = () => {};
    setSession(null);
    setSaveError(null);
    void controller
      .openDocument(pageId, (m) => setSaveError(m), (ev) => saveStatusStore.dispatch(ev))
      .then((s) => {
        if (cancelled) { void s.dispose(); return; }
        opened = s;
        saveStatusStore.reset();
        saveStatusStore.setRetry(() => void s.flush());
        const frag = s.doc.getXmlFragment("doc");
        setBlocks(countBlocks(frag));
        const refreshHeadings = () => setHeadings(extractHeadings(fromYjs(frag)));
        refreshHeadings();
        // Se recuenta con retardo para no frenar la escritura en páginas enormes.
        let timer: ReturnType<typeof setTimeout> | undefined;
        const onUpdate = () => { clearTimeout(timer); timer = setTimeout(() => { setBlocks(countBlocks(frag)); refreshHeadings(); }, 800); };
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
    <div className="relative mt-4">
      <TableOfContents headings={headings} activeId={activeId} onJump={jumpTo} />
      {saveError && (
        <InlineAlert tone="error">
          {t("editor.saveFailed", { message: saveError })}
        </InlineAlert>
      )}
      <InboxTriage controller={controller} pageId={pageId} />
      <LargePageNotice blocks={blocks} />
      {notes.map((n, i) => (
        <p key={i} role="status" className="mb-2 rounded border border-[var(--c-warning)] bg-[var(--chip-warning-bg)] p-2 text-sm text-[var(--chip-warning-fg)]">
          {n} <button type="button" onClick={() => setNotes((all) => all.filter((_, j) => j !== i))}>{t("editor.dismiss")}</button>
        </p>
      ))}
      {session ? <DatabaseEmbedProvider value={{ list: () => controller.listDatabases(), open: (id) => controller.openDatabaseById(id), openRow: (id) => void controller.select(id) }}><LinkProvider value={links}><DiagramDefaultsProvider value={diagramDefaults}><Editor key={pageId} session={session} handlers={handlers} findPages={(q) => controller.findPages(q)} /></DiagramDefaultsProvider></LinkProvider></DatabaseEmbedProvider> : <p role="status" className="opacity-70">{t("app.loading")}</p>}
      {session ? <Backlinks controller={controller} pageId={pageId} /> : null}
    </div>
  );
}

function Editor({ session, handlers, findPages }: { session: DocSession; handlers: ReturnType<typeof createFileHandlers> | null; findPages: (query: string) => Promise<{ id: string; title: string }[]> }) {
  const { i18n, t } = useTranslation();
  const { resolved } = useTheme();
  const collaboration = useMemo(
    () => ({ fragment: session.doc.getXmlFragment("doc"), provider: { awareness: new Awareness(session.doc) }, user: { name: "yo", color: "var(--c-accent)" } }),
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
  const items = async (query: string) => buildSlashItems(editor, t, query);
  return (
    <BlockNoteView editor={editor} theme={resolved} data-testid="editor" slashMenu={false}>
      <SuggestionMenuController triggerCharacter="/" getItems={items} />
      <SuggestionMenuController triggerCharacter="@" getItems={mentionItems} />
      <SuggestionMenuController triggerCharacter="[[" getItems={mentionItems} />
    </BlockNoteView>
  );
}
