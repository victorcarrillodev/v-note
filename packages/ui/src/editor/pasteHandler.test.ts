// T-129: el HTML pegado se sanea antes de llegar al documento; sin HTML se usa el comportamiento normal.
import { describe, it, expect, vi } from "vitest";
import { handlePaste } from "./pasteHandler";

const ev = (data: Record<string, string>) => ({ clipboardData: { getData: (t: string) => data[t] ?? "" }, preventDefault: vi.fn() }) as unknown as ClipboardEvent;

describe("handlePaste", () => {
  it("sanea el HTML antes de insertarlo y consume el evento", () => {
    const pasteHTML = vi.fn();
    const defaultPasteHandler = vi.fn();
    const r = handlePaste({ event: ev({ "text/html": '<p>hola</p><script>alert(1)</script><img src=x onerror=alert(1)>' }), editor: { pasteHTML }, defaultPasteHandler });
    expect(r).toBe(true);
    expect(defaultPasteHandler).not.toHaveBeenCalled();
    expect(pasteHTML).toHaveBeenCalledTimes(1);
    const inserted = pasteHTML.mock.calls[0]![0] as string;
    expect(inserted).toContain("hola");
    expect(inserted).not.toMatch(/script|onerror/i);
  });
  it("sin HTML delega en el manejador por defecto (texto plano o archivos)", () => {
    const defaultPasteHandler = vi.fn().mockReturnValue(true);
    const pasteHTML = vi.fn();
    const r = handlePaste({ event: ev({ "text/plain": "solo texto" }), editor: { pasteHTML }, defaultPasteHandler });
    expect(r).toBe(true);
    expect(defaultPasteHandler).toHaveBeenCalledTimes(1);
    expect(pasteHTML).not.toHaveBeenCalled();
  });
  it("si el HTML queda vacío tras sanear, no inserta nada pero consume el evento", () => {
    const pasteHTML = vi.fn();
    const r = handlePaste({ event: ev({ "text/html": "<script>alert(1)</script>" }), editor: { pasteHTML }, defaultPasteHandler: vi.fn() });
    expect(r).toBe(true);
    expect(pasteHTML).not.toHaveBeenCalled();
  });
  it("con archivos en el portapapeles delega (imágenes pegadas)", () => {
    const e = { clipboardData: { getData: (t: string) => (t === "text/html" ? "<img src=x>" : ""), files: [{ name: "a.png" }] }, preventDefault: vi.fn() } as unknown as ClipboardEvent;
    const defaultPasteHandler = vi.fn().mockReturnValue(true);
    handlePaste({ event: e, editor: { pasteHTML: vi.fn() }, defaultPasteHandler });
    expect(defaultPasteHandler).toHaveBeenCalled();
  });
});
