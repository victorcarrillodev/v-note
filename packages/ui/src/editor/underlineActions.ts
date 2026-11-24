// Aplicar, leer y quitar el subrayado con estilo en la selección del editor. Compartido por el botón de la barra y por el atajo.
import { formatUnderline, parseUnderline, UNDERLINE_STYLE_KEY, type Underline } from "@vnote/core";

/** Lo mínimo del editor que se usa: así vale para el editor con el esquema propio sin repetir sus tipos. */
export type UnderlineEditor = {
  getActiveStyles(): Record<string, unknown>;
  addStyles(styles: Record<string, string>): void;
  removeStyles(styles: Record<string, string>): void;
  focus(): void;
};

/** Lo último que se eligió: el siguiente subrayado de la sesión (y el atajo) arrancan ahí. */
let last: Underline = { kind: "marker", color: "yellow" };
export const lastUnderline = (): Underline => last;

export const activeUnderline = (editor: UnderlineEditor): Underline | null => parseUnderline(editor.getActiveStyles()[UNDERLINE_STYLE_KEY]);

export function applyUnderline(editor: UnderlineEditor, u: Underline): void {
  last = u;
  editor.addStyles({ [UNDERLINE_STYLE_KEY]: formatUnderline(u) });
}

export function removeUnderline(editor: UnderlineEditor): void {
  editor.removeStyles({ [UNDERLINE_STYLE_KEY]: "" });
}

/** Atajo: si la selección ya tiene subrayado con estilo lo quita; si no, aplica el último elegido. */
export function toggleUnderline(editor: UnderlineEditor): void {
  if (activeUnderline(editor)) removeUnderline(editor); else applyUnderline(editor, last);
}
