// T-409, T-410, T-411, T-412 (prueba primero): diálogo de exportar a HTML o PDF, con o sin páginas hijas, con progreso y cancelación.
import { describe, it, expect, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryAssetStore, PageService, assetUrl, type Block } from "@vnote/core";
import { updateFor } from "../../../core/tests/support/builders";
import { renderWithI18n } from "../../tests/renderWithI18n";
import { makeController } from "../../tests/withController";
import { ExportDialog, type ExportRuntime } from "./ExportDialog";

async function setup(opts: { children?: boolean } = {}) {
  const { controller } = await makeController();
  const root = await controller.createPage(null, "Informe");
  if (!root.ok) throw new Error("x");
  if (opts.children) {
    await controller.createPage(root.value.id, "Capítulo 1");
    await controller.createPage(root.value.id, "Capítulo 2");
  }
  const assets = new MemoryAssetStore();
  const runtime: ExportRuntime = { saveHtml: vi.fn(async () => {}), printHtml: vi.fn(async () => {}) };
  const onClose = vi.fn();
  const view = await renderWithI18n(<ExportDialog controller={controller} pageId={root.value.id} assets={assets} runtime={runtime} onClose={onClose} />);
  return { controller, id: root.value.id, assets, runtime, onClose, user: userEvent.setup(), ...view };
}

describe("diálogo de exportar (T-412)", () => {
  it("ofrece HTML o PDF y la opción de incluir páginas hijas", async () => {
    await setup();
    const dlg = screen.getByRole("alertdialog", { name: /exportar/i });
    expect(within(dlg).getByRole("radio", { name: "HTML" })).toBeChecked();
    expect(within(dlg).getByRole("radio", { name: "PDF" })).not.toBeChecked();
    expect(within(dlg).getByRole("checkbox", { name: /páginas hijas/i })).not.toBeChecked();
  });
  it("exportar a HTML entrega el archivo con el nombre de la página", async () => {
    const { user, runtime, onClose } = await setup();
    await user.click(screen.getByRole("button", { name: "Exportar" }));
    await waitFor(() => expect(runtime.saveHtml).toHaveBeenCalledTimes(1));
    const [fileName, html] = (runtime.saveHtml as ReturnType<typeof vi.fn>).mock.calls[0] as [string, string];
    expect(fileName).toBe("Informe.html");
    expect(html).toContain("<title>Informe</title>");
    expect(runtime.printHtml).not.toHaveBeenCalled();
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });
  it("el nombre del archivo es seguro aunque el título tenga caracteres de ruta", async () => {
    const { controller } = await makeController();
    const p = await controller.createPage(null, 'a/b\\c:d*e?"f<g>h|i');
    if (!p.ok) throw new Error("x");
    const runtime: ExportRuntime = { saveHtml: vi.fn(async () => {}), printHtml: vi.fn(async () => {}) };
    await renderWithI18n(<ExportDialog controller={controller} pageId={p.value.id} assets={new MemoryAssetStore()} runtime={runtime} onClose={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: "Exportar" }));
    await waitFor(() => expect(runtime.saveHtml).toHaveBeenCalled());
    const name = (runtime.saveHtml as ReturnType<typeof vi.fn>).mock.calls[0]![0] as string;
    expect(name).toMatch(/^[^/\\:*?"<>|]+\.html$/);
  });
  it("con páginas hijas el documento las incluye con su índice", async () => {
    const { user, runtime } = await setup({ children: true });
    await user.click(screen.getByRole("checkbox", { name: /páginas hijas/i }));
    await user.click(screen.getByRole("button", { name: "Exportar" }));
    await waitFor(() => expect(runtime.saveHtml).toHaveBeenCalled());
    const html = (runtime.saveHtml as ReturnType<typeof vi.fn>).mock.calls[0]![1] as string;
    expect(html).toContain("Capítulo 1");
    expect(html).toContain("Capítulo 2");
    expect(html).toContain('class="toc"');
  });
  it("sin la opción, las hijas no se incluyen", async () => {
    const { user, runtime } = await setup({ children: true });
    await user.click(screen.getByRole("button", { name: "Exportar" }));
    await waitFor(() => expect(runtime.saveHtml).toHaveBeenCalled());
    expect((runtime.saveHtml as ReturnType<typeof vi.fn>).mock.calls[0]![1] as string).not.toContain("Capítulo 1");
  });
});

describe("dónde se guardó (T-409)", () => {
  it("si la plataforma informa la ruta, la muestra y deja el diálogo abierto para leerla", async () => {
    const { controller } = await makeController();
    const p = await controller.createPage(null, "X");
    if (!p.ok) throw new Error("x");
    const runtime: ExportRuntime = { saveHtml: vi.fn(async () => "/home/ana/Descargas/X.html"), printHtml: vi.fn(async () => {}) };
    const onClose = vi.fn();
    await renderWithI18n(<ExportDialog controller={controller} pageId={p.value.id} assets={new MemoryAssetStore()} runtime={runtime} onClose={onClose} />);
    await userEvent.click(screen.getByRole("button", { name: "Exportar" }));
    expect(await screen.findByRole("status")).toHaveTextContent("/home/ana/Descargas/X.html");
    expect(onClose).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Cerrar" }));
    expect(onClose).toHaveBeenCalled();
  });
});

describe("PDF (T-409, T-410)", () => {
  it("abre el diálogo de impresión con el documento y no guarda ningún HTML", async () => {
    const { user, runtime } = await setup();
    await user.click(screen.getByRole("radio", { name: "PDF" }));
    await user.click(screen.getByRole("button", { name: "Exportar" }));
    await waitFor(() => expect(runtime.printHtml).toHaveBeenCalledTimes(1));
    expect((runtime.printHtml as ReturnType<typeof vi.fn>).mock.calls[0]![0] as string).toContain("@media print");
    expect(runtime.saveHtml).not.toHaveBeenCalled();
  });
  it("explica que en el diálogo se elige «Guardar como PDF»", async () => {
    const { user } = await setup();
    await user.click(screen.getByRole("radio", { name: "PDF" }));
    expect(screen.getByText(/guardar como pdf/i)).toBeInTheDocument();
  });
});

describe("adjuntos faltantes y errores (T-407)", () => {
  it("avisa de los adjuntos que faltan y la exportación se completa", async () => {
    const { controller, db, clock } = await makeController();
    const p = await controller.createPage(null, "Con imagen");
    if (!p.ok) throw new Error("x");
    const img: Block = { id: "i", type: "image", props: { url: assetUrl("d".repeat(64)), name: "perdida.png", caption: "" }, content: undefined, children: [] };
    await new PageService(db, clock).saveUpdate(p.value.id, updateFor([img]));
    const runtime: ExportRuntime = { saveHtml: vi.fn(async () => {}), printHtml: vi.fn(async () => {}) };
    await renderWithI18n(<ExportDialog controller={controller} pageId={p.value.id} assets={new MemoryAssetStore()} runtime={runtime} onClose={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: "Exportar" }));
    await waitFor(() => expect(runtime.saveHtml).toHaveBeenCalled());
    expect(await screen.findByRole("status")).toHaveTextContent(/perdida\.png/);
  });
  it("si guardar falla muestra el error y deja reintentar", async () => {
    const { controller } = await makeController();
    const p = await controller.createPage(null, "X");
    if (!p.ok) throw new Error("x");
    const runtime: ExportRuntime = { saveHtml: vi.fn(async () => { throw new Error("disco lleno"); }), printHtml: vi.fn(async () => {}) };
    const onClose = vi.fn();
    await renderWithI18n(<ExportDialog controller={controller} pageId={p.value.id} assets={new MemoryAssetStore()} runtime={runtime} onClose={onClose} />);
    await userEvent.click(screen.getByRole("button", { name: "Exportar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/disco lleno/);
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Exportar" })).toBeEnabled();
  });
});

describe("progreso y cancelación (T-411)", () => {
  it("durante la exportación muestra el progreso y «Cancelar» detiene todo sin entregar nada", async () => {
    const { controller, db, clock } = await makeController();
    const root = await controller.createPage(null, "Grande");
    if (!root.ok) throw new Error("x");
    const svc = new PageService(db, clock);
    for (let i = 0; i < 400; i++) await svc.create({ title: `Hija ${i}`, parentId: root.value.id });
    await controller.refresh();
    const runtime: ExportRuntime = { saveHtml: vi.fn(async () => {}), printHtml: vi.fn(async () => {}) };
    await renderWithI18n(<ExportDialog controller={controller} pageId={root.value.id} assets={new MemoryAssetStore()} runtime={runtime} onClose={() => {}} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("checkbox", { name: /páginas hijas/i }));
    await user.click(screen.getByRole("button", { name: "Exportar" }));
    const bar = await screen.findByRole("progressbar");
    expect(bar).toHaveAttribute("aria-valuemax");
    await user.click(screen.getByRole("button", { name: "Cancelar exportación" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/cancelada/i));
    expect(runtime.saveHtml).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Exportar" })).toBeEnabled();
  });
});
