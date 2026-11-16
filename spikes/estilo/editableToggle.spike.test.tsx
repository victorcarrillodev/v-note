// E-008 (spike, desechable): cambiar `editable` de BlockNoteView en vivo ¿conserva Yjs, el contenido y el cursor?
import { it, expect } from "vitest";
import { render, act } from "@testing-library/react";
import { useState } from "react";
import * as Y from "yjs";
import { Awareness } from "y-protocols/awareness";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import { withCollaboration } from "@blocknote/core/yjs";

window.matchMedia ??= ((q: string) => ({ matches: false, media: q, onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false })) as unknown as typeof window.matchMedia;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let api: { editor?: any; setEditable?: (v: boolean) => void } = {};
function Harness({ doc }: { doc: Y.Doc }) {
  const [editable, setEditable] = useState(true);
  const editor = useCreateBlockNote(
    { ...withCollaboration({ collaboration: { fragment: doc.getXmlFragment("doc"), provider: { awareness: new Awareness(doc) }, user: { name: "yo", color: "#000" } } }) },
    [doc],
  );
  api = { editor, setEditable };
  return <BlockNoteView editor={editor} editable={editable} />;
}

it("cambiar editable en vivo conserva el documento Yjs, el contenido, el nodo y el cursor", async () => {
  const doc = new Y.Doc();
  render(<Harness doc={doc} />);
  await act(async () => {
    api.editor.replaceBlocks(api.editor.document, [{ type: "paragraph", content: "uno" }, { type: "paragraph", content: "dos" }]);
  });
  const second = api.editor.document[1].id;
  await act(async () => api.editor.setTextCursorPosition(second, "end"));
  const textBefore = JSON.stringify(api.editor.document.map((b: { content: unknown }) => b.content));
  const domBefore = api.editor.prosemirrorView.dom;
  let updates = 0;
  doc.on("update", () => { updates++; });

  await act(async () => api.setEditable!(false));
  expect(api.editor.isEditable).toBe(false);
  expect(domBefore.getAttribute("contenteditable")).toBe("false");
  expect(api.editor.prosemirrorView.dom).toBe(domBefore); // no se remonta

  await act(async () => api.setEditable!(true));
  expect(api.editor.isEditable).toBe(true);
  expect(domBefore.getAttribute("contenteditable")).toBe("true");
  expect(updates).toBe(0); // cambiar el modo no escribe en Yjs
  expect(JSON.stringify(api.editor.document.map((b: { content: unknown }) => b.content))).toBe(textBefore);
  expect(api.editor.getTextCursorPosition().block.id).toBe(second); // el cursor sigue en el mismo bloque
});
