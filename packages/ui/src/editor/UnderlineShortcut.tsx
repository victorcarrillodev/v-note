import { useEffect } from "react";
import { useBlockNoteEditor } from "@blocknote/react";
import { toggleUnderline, type UnderlineEditor } from "./underlineActions";

/** Atajo del subrayado con estilo: Ctrl+Alt+U (⌘+⌥+U en Mac) aplica el último elegido o lo quita. No interfiere con Ctrl+U, el subrayado simple. */
export function UnderlineShortcut() {
  const editor = useBlockNoteEditor();
  useEffect(() => {
    const dom = editor.domElement;
    if (!dom) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.altKey && !e.shiftKey && e.code === "KeyU") {
        e.preventDefault();
        toggleUnderline(editor as unknown as UnderlineEditor);
      }
    };
    dom.addEventListener("keydown", onKey);
    return () => dom.removeEventListener("keydown", onKey);
  }, [editor]);
  return null;
}
