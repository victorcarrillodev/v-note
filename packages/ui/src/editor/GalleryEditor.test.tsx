import { describe, it, expect } from "vitest";
import { waitFor, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import { serializeGallery } from "@vnote/core";
import { renderWithI18n } from "../../tests/renderWithI18n";
import { schema } from "./schema";

window.matchMedia ??= ((q: string) => ({ matches: false, media: q, onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false })) as never;

let editorRef: any = null;
const images = serializeGallery([{ url: "https://x.test/a.png", name: "a.png", caption: "", cols: 1, rows: 1, fit: "" }, { url: "https://x.test/b.png", name: "b.png", caption: "", cols: 1, rows: 1, fit: "" }]);

function Host() {
  const editor = useCreateBlockNote({ schema, initialContent: [{ type: "gallery", props: { images, layout: "mosaic", mosaicStyle: "custom" } } as never], resolveFileUrl: async (u: string) => u });
  editorRef = editor;
  return <BlockNoteView editor={editor} />;
}

describe("galería dentro del editor real", () => {
  it("el menú de una imagen cambia las propiedades del bloque", async () => {
    await renderWithI18n(<Host />);
    const btn = await screen.findAllByRole("button", { name: /Opciones de/ });
    await userEvent.click(btn[0]!);
    await userEvent.click(await screen.findByRole("menuitem", { name: "Ensanchar" }));
    await waitFor(() => {
      const b = editorRef.document.find((x: any) => x.type === "gallery");
      expect(JSON.parse(b.props.images)[0].cols).toBe(2);
    });
    // el menú sigue abierto tras cambiar el tamaño y se puede volver a usar
    await userEvent.click(await screen.findByRole("menuitem", { name: "Alargar" }));
    await waitFor(() => {
      const b = editorRef.document.find((x: any) => x.type === "gallery");
      expect(JSON.parse(b.props.images)[0].rows).toBe(2);
    });
  });
  it("elegir un ajuste y quitar una imagen", async () => {
    await renderWithI18n(<Host />);
    await userEvent.click((await screen.findAllByRole("button", { name: /Opciones de/ }))[1]!);
    await userEvent.click(await screen.findByRole("menuitemradio", { name: "Contener" }));
    await waitFor(() => expect(JSON.parse(editorRef.document.find((x: any) => x.type === "gallery").props.images)[1].fit).toBe("contain"));
    await userEvent.click((await screen.findAllByRole("button", { name: /Opciones de/ }))[0]!);
    await userEvent.click(await screen.findByRole("menuitem", { name: "Quitar imagen" }));
    await waitFor(() => expect(JSON.parse(editorRef.document.find((x: any) => x.type === "gallery").props.images)).toHaveLength(1));
  });
});
