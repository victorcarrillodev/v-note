// E-079 (RNF-4), E-080 (CL-1) y E-081 (CL-7): progreso, aviso de baja resolución y arrastrar o pegar una imagen.
import { describe, it, expect, vi } from "vitest";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryAssetStore } from "@vnote/core";
import { renderWithI18n } from "../../tests/renderWithI18n";
import { makeController } from "../../tests/withController";
import { PageHeader } from "./PageHeader";

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3];
const pngFile = () => new File([new Uint8Array(PNG)], "a.png", { type: "image/png" });
const result = (sourceWidth: number) => ({ jpeg: new Uint8Array([0xff, 0xd8, 0xff, 9]), sourceWidth, sourceHeight: 100 });

async function setup(optimize: (b: Uint8Array) => Promise<ReturnType<typeof result>>, opts: { locked?: boolean } = {}) {
  const { controller } = await makeController();
  const r = await controller.createPage(null, "Página");
  if (!r.ok) throw new Error("x");
  if (opts.locked) await controller.setPageProps(r.value.id, { locked: true });
  const assets = new MemoryAssetStore();
  await renderWithI18n(<PageHeader controller={controller} pageId={r.value.id} assets={assets} optimize={optimize} />);
  const page = () => { const f = (ns: ReturnType<typeof controller.getSnapshot>["tree"]): any => ns.flatMap((n) => (n.page.id === r.value.id ? [n.page] : f(n.children)))[0]; return f(controller.getSnapshot().tree); };
  return { page, user: userEvent.setup(), header: screen.getByTestId("page-header") };
}

describe("indicador de progreso (E-079)", () => {
  it("aparece mientras se optimiza, desaparece al terminar y la página sigue respondiendo", async () => {
    let finish!: (v: ReturnType<typeof result>) => void;
    const { page, user, header } = await setup(() => new Promise((res) => { finish = res; }));
    expect(screen.queryByText("Optimizando la imagen…")).toBeNull();
    fireEvent.drop(header, { dataTransfer: { files: [pngFile()], items: [{ kind: "file" }] } });
    expect(await screen.findByText("Optimizando la imagen…")).toBeInTheDocument();
    // Mientras tanto se puede seguir escribiendo.
    const title = screen.getByRole("textbox", { name: "Título de la página" });
    await user.clear(title);
    await user.type(title, "Sigue viva");
    expect(title).toHaveValue("Sigue viva");
    await act(async () => { finish(result(2000)); });
    await waitFor(() => expect(screen.queryByText("Optimizando la imagen…")).toBeNull());
    expect(page().cover).toMatch(/^asset:/);
  });
  it("un error también lo apaga y deja la portada anterior", async () => {
    const { page, header } = await setup(async () => { throw new Error("x"); });
    fireEvent.drop(header, { dataTransfer: { files: [pngFile()], items: [{ kind: "file" }] } });
    expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo leer la imagen");
    expect(screen.queryByText("Optimizando la imagen…")).toBeNull();
    expect(page().cover).toBeNull();
  });
});

describe("aviso de baja resolución (E-080)", () => {
  it("una imagen de 300 px avisa que puede verse borrosa y se guarda igual", async () => {
    const { page, header } = await setup(async () => result(300));
    fireEvent.drop(header, { dataTransfer: { files: [pngFile()], items: [{ kind: "file" }] } });
    const aviso = await screen.findByText("La imagen es pequeña y puede verse borrosa.");
    expect(aviso).toBeInTheDocument();
    // la portada sube con margen negativo: el aviso debe apilarse por encima para no quedar tapado por ella
    expect(aviso.closest("[data-testid=cover-alerts]")?.className).toMatch(/\brelative\b.*\bz-30\b/);
    expect(page().cover).toMatch(/^asset:/);
  });
  it("una imagen grande no avisa", async () => {
    const { page, header } = await setup(async () => result(2000));
    fireEvent.drop(header, { dataTransfer: { files: [pngFile()], items: [{ kind: "file" }] } });
    await waitFor(() => expect(page().cover).toMatch(/^asset:/));
    expect(screen.queryByText("La imagen es pequeña y puede verse borrosa.")).toBeNull();
  });
});

describe("arrastrar y pegar sobre la cabecera (E-081)", () => {
  it("al arrastrar un archivo se muestra la ayuda y al soltarlo se usa como portada", async () => {
    const { page, header } = await setup(async () => result(2000));
    fireEvent.dragOver(header, { dataTransfer: { items: [{ kind: "file" }], files: [] } });
    expect(await screen.findByText("Suelta la imagen para usarla como portada")).toBeInTheDocument();
    fireEvent.drop(header, { dataTransfer: { files: [pngFile()], items: [{ kind: "file" }] } });
    await waitFor(() => expect(page().cover).toMatch(/^asset:/));
    expect(screen.queryByText("Suelta la imagen para usarla como portada")).toBeNull();
  });
  it("pegar una imagen la usa como portada", async () => {
    const { page, header } = await setup(async () => result(2000));
    fireEvent.paste(header, { clipboardData: { files: [pngFile()] } });
    await waitFor(() => expect(page().cover).toMatch(/^asset:/));
  });
  it("lo que no es una imagen se ignora", async () => {
    const optimize = vi.fn(async () => result(2000));
    const { page, header } = await setup(optimize);
    fireEvent.drop(header, { dataTransfer: { files: [new File(["x"], "a.txt", { type: "text/plain" })], items: [{ kind: "file" }] } });
    fireEvent.paste(header, { clipboardData: { files: [] } });
    expect(optimize).not.toHaveBeenCalled();
    expect(page().cover).toBeNull();
  });
  it("una página bloqueada no acepta imágenes", async () => {
    const optimize = vi.fn(async () => result(2000));
    const { page, header } = await setup(optimize, { locked: true });
    fireEvent.drop(header, { dataTransfer: { files: [pngFile()], items: [{ kind: "file" }] } });
    expect(optimize).not.toHaveBeenCalled();
    expect(page().cover).toBeNull();
  });
});
