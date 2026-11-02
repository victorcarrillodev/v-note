// T-410 (prueba primero): en el navegador, HTML = descarga de un archivo; PDF = diálogo de impresión del sistema.
import { describe, it, expect, vi, afterEach } from "vitest";
import { webExportRuntime } from "./webExportRuntime";

afterEach(() => { vi.restoreAllMocks(); document.body.innerHTML = ""; });

describe("webExportRuntime", () => {
  it("saveHtml descarga un archivo con ese nombre y libera la URL", async () => {
    const created: Blob[] = [];
    (URL as unknown as { createObjectURL: (b: Blob) => string }).createObjectURL = (b) => { created.push(b); return "blob:x"; };
    const revoke = vi.fn();
    (URL as unknown as { revokeObjectURL: (u: string) => void }).revokeObjectURL = revoke;
    const clicked: { download: string; href: string }[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) { clicked.push({ download: this.download, href: this.href }); });
    vi.useFakeTimers({ toFake: ["setTimeout"] });
    await webExportRuntime.saveHtml("Informe.html", "<p>hola</p>");
    expect(clicked).toEqual([{ download: "Informe.html", href: "blob:x" }]);
    expect(created[0]!.type).toBe("text/html;charset=utf-8");
    expect(await new Promise<string>((res) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.readAsText(created[0]!); })).toBe("<p>hola</p>");
    expect(document.querySelector("a[download]")).toBeNull();
    vi.advanceTimersByTime(20_000);
    expect(revoke).toHaveBeenCalledWith("blob:x");
    vi.useRealTimers();
  });
  it("printHtml carga el documento en un marco oculto y sin scripts, y abre la impresión", async () => {
    const printed = vi.fn();
    const p = webExportRuntime.printHtml("<p>pdf</p>");
    const frame = document.querySelector("iframe") as HTMLIFrameElement;
    expect(frame).not.toBeNull();
    expect(frame.srcdoc).toBe("<p>pdf</p>");
    expect(frame.getAttribute("sandbox")).not.toContain("allow-scripts");
    expect(frame.getAttribute("aria-hidden")).toBe("true");
    Object.defineProperty(frame, "contentWindow", { value: { focus: () => {}, print: printed, addEventListener: (_: string, fn: () => void) => fn() } });
    frame.dispatchEvent(new Event("load"));
    await p;
    expect(printed).toHaveBeenCalledTimes(1);
    expect(document.querySelector("iframe")).toBeNull();
  });
});
