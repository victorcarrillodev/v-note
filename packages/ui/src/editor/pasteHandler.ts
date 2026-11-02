import { sanitizeHtml } from "./sanitize";

type Ctx = {
  event: ClipboardEvent;
  editor: { pasteHTML(html: string): void };
  defaultPasteHandler: (opts?: Record<string, unknown>) => boolean | undefined;
};

/** Pegado seguro (CL-24): el HTML se sanea siempre; archivos y texto plano siguen el camino normal del editor. */
export function handlePaste({ event, editor, defaultPasteHandler }: Ctx): boolean | undefined {
  const cd = event.clipboardData;
  if (cd && cd.files && cd.files.length > 0) return defaultPasteHandler();
  const html = cd?.getData("text/html") ?? "";
  if (html === "") return defaultPasteHandler();
  event.preventDefault();
  const clean = sanitizeHtml(html);
  if (clean.trim() !== "") editor.pasteHTML(clean);
  return true;
}
