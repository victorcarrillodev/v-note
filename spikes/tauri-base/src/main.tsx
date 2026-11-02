import { createRoot } from "react-dom/client";
import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import { withCollaboration } from "@blocknote/core/yjs";
import * as Y from "yjs";
import { Awareness } from "y-protocols/awareness";
import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";

function Editor({ ydoc }: { ydoc: Y.Doc }) {
  const editor = useCreateBlockNote(
    withCollaboration({
      collaboration: {
        fragment: ydoc.getXmlFragment("doc"),
        provider: { awareness: new Awareness(ydoc) },
        user: { name: "yo", color: "#3366cc" },
      },
    }),
  );
  (window as any).__editor = editor;
  (window as any).__ydoc = ydoc;
  (window as any).__snapshot = () => ({
    doc: editor.document,
    update: btoa(String.fromCharCode(...Y.encodeStateAsUpdate(ydoc))),
  });
  return <BlockNoteView editor={editor} />;
}

const hasTauri = () => "__TAURI_INTERNALS__" in window;
if (hasTauri()) {
  (window as any).__ticks = 0;
  listen("tick", () => ((window as any).__ticks += 1));
}

function Aviso({ texto }: { texto: string }) {
  return <div data-testid="aviso" style={{ background: "#fff3cd", padding: 8, fontFamily: "sans-serif" }}>{texto}</div>;
}

function App() {
  const [state, setState] = useState<{ ydoc: Y.Doc; aviso?: string } | null>(null);
  const [fatal, setFatal] = useState<string | null>(null);
  useEffect(() => {
    (async () => {
      const doc = new Y.Doc();
      let aviso: string | undefined;
      if (!hasTauri()) {
        aviso = "Modo navegador: sin persistencia. Abre la app de escritorio para guardar.";
      } else {
        try {
          const saved = await invoke<number[] | null>("load_doc");
          if (saved) Y.applyUpdate(doc, new Uint8Array(saved));
        } catch (e) {
          console.error("archivo guardado dañado", e);
          await invoke("quarantine_doc").catch(() => {});
          aviso = "El archivo guardado estaba dañado. Se abrió un documento vacío y se conservó una copia (doc.bin.corrupt).";
        }
        let timer: ReturnType<typeof setTimeout> | undefined;
        doc.on("update", () => {
          clearTimeout(timer);
          timer = setTimeout(() => invoke("save_doc", { data: Array.from(Y.encodeStateAsUpdate(doc)) }).catch(console.error), 300);
        });
      }
      setState({ ydoc: doc, aviso });
    })().catch((e) => setFatal(String(e)));
  }, []);
  if (fatal) return <Aviso texto={`Error al iniciar: ${fatal}`} />;
  if (!state) return <div style={{ padding: 8, fontFamily: "sans-serif" }}>Cargando…</div>;
  return (
    <>
      {state.aviso && <Aviso texto={state.aviso} />}
      <Editor ydoc={state.ydoc} />
    </>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
if (hasTauri()) invoke("heartbeat", { userAgent: navigator.userAgent }).catch(console.error);
