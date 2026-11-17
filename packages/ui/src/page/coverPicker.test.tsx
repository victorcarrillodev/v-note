// E-082 a E-087 (RF-2.1, RF-2.2, RF-2.3, RF-2.7, CL-14): selector de portada, importación y pintado.
import { describe, it, expect, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryAssetStore, MAX_COVER_INPUT_BYTES } from "@vnote/core";
import { renderWithI18n } from "../../tests/renderWithI18n";
import { makeController } from "../../tests/withController";
import { PageHeader } from "./PageHeader";

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3];
const optimizeTo = (sourceWidth: number) => vi.fn(async () => ({ jpeg: new Uint8Array([0xff, 0xd8, 0xff, 9]), sourceWidth, sourceHeight: 100 }));

async function setup(opts: { assets?: boolean; optimize?: ReturnType<typeof optimizeTo> } = {}) {
  const { controller } = await makeController();
  const r = await controller.createPage(null, "Página");
  if (!r.ok) throw new Error("x");
  const assets = opts.assets === false ? undefined : new MemoryAssetStore();
  const optimize = opts.optimize ?? optimizeTo(2000);
  const view = await renderWithI18n(<PageHeader controller={controller} pageId={r.value.id} assets={assets} optimize={optimize} workspaceName="Mi espacio" now={Date.UTC(2026, 10, 16)} />);
  const page = () => { const f = (ns: ReturnType<typeof controller.getSnapshot>["tree"]): any => ns.flatMap((n) => (n.page.id === r.value.id ? [n.page] : f(n.children)))[0]; return f(controller.getSnapshot().tree); };
  return { controller, id: r.value.id, assets, optimize, page, user: userEvent.setup(), ...view };
}
const openPicker = async (user: ReturnType<typeof userEvent.setup>) => { await user.click(screen.getByRole("button", { name: "Añadir portada" })); await screen.findByRole("group", { name: "Portada de la página" }); };

describe("selector de portada (E-082)", () => {
  it("se abre desde «Añadir portada» con las pestañas Subir, Colores y Degradados", async () => {
    const { user } = await setup();
    await openPicker(user);
    expect(screen.getAllByRole("tab").map((t) => t.textContent)).toEqual(["Subir", "Colores", "Degradados"]);
  });
  it("se recorre con el teclado: las flechas cambian de pestaña y Esc cierra", async () => {
    const { user } = await setup();
    await openPicker(user);
    screen.getByRole("tab", { name: "Subir" }).focus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Colores" })).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Degradados" })).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("group", { name: "Portada de la página" })).toBeNull());
  });
  it("sin almacén de archivos no ofrece «Subir»", async () => {
    const { user } = await setup({ assets: false });
    await openPicker(user);
    expect(screen.queryByRole("tab", { name: "Subir" })).toBeNull();
    expect(screen.getByRole("tab", { name: "Colores" })).toHaveAttribute("aria-selected", "true");
  });
  it("«Quitar portada» solo aparece si ya hay portada", async () => {
    const { user, controller, id } = await setup();
    await openPicker(user);
    expect(screen.queryByRole("button", { name: "Quitar portada" })).toBeNull();
    await user.keyboard("{Escape}");
    await controller.setPageProps(id, { cover: "gradient:sky" });
    await user.click(await screen.findByRole("button", { name: "Cambiar portada" }));
    expect(await screen.findByRole("button", { name: "Quitar portada" })).toBeInTheDocument();
  });
});

describe("pestaña Subir (E-083)", () => {
  // `change` directo: el filtro `accept` del selector no impide que llegue un archivo (arrastrar, o «todos los archivos»).
  const upload = async (_user: ReturnType<typeof userEvent.setup>, file: File) => {
    fireEvent.change(screen.getByLabelText("Elegir una imagen", { selector: "input" }), { target: { files: [file] } });
  };
  it("una imagen válida se guarda como portada de archivo", async () => {
    const { user, page, assets } = await setup();
    await openPicker(user);
    await upload(user, new File([new Uint8Array(PNG)], "a.png", { type: "image/png" }));
    await waitFor(() => expect(page().cover).toMatch(/^asset:[0-9a-f]{64}$/));
    expect((await assets!.list()).length).toBe(1);
  });
  it("un formato no admitido muestra el mensaje y no cambia la portada", async () => {
    const { user, page, optimize } = await setup();
    await openPicker(user);
    await upload(user, new File([new Uint8Array([1, 2, 3, 4])], "a.gif", { type: "image/gif" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Formato no admitido");
    expect(page().cover).toBeNull();
    expect(optimize).not.toHaveBeenCalled();
  });
  it("un archivo de 25 MB muestra el mensaje y no se procesa", async () => {
    const { user, page, optimize } = await setup();
    await openPicker(user);
    const big = new File([new Uint8Array(PNG)], "grande.png", { type: "image/png" });
    Object.defineProperty(big, "size", { value: 25 * 1024 * 1024 });
    expect(25 * 1024 * 1024).toBeGreaterThan(MAX_COVER_INPUT_BYTES);
    await upload(user, big);
    expect(await screen.findByRole("alert")).toHaveTextContent("más de 20 MB");
    expect(page().cover).toBeNull();
    expect(optimize).not.toHaveBeenCalled();
  });
});

describe("pestaña Colores (E-084)", () => {
  it("elegir un color de la paleta guarda `color:#hex`", async () => {
    const { user, page } = await setup();
    await openPicker(user);
    await user.click(screen.getByRole("tab", { name: "Colores" }));
    const swatch = screen.getByRole("group", { name: "Colores de la aplicación" }).querySelector("button")!;
    const hex = swatch.getAttribute("data-swatch")!;
    await user.click(swatch);
    expect(page().cover).toBe(`color:${hex}`);
  });
  it("un color propio en hexadecimal se guarda; uno inválido no se puede aplicar", async () => {
    const { user, page } = await setup();
    await openPicker(user);
    await user.click(screen.getByRole("tab", { name: "Colores" }));
    await user.type(screen.getByLabelText("Color en hexadecimal"), "#12");
    expect(screen.getByRole("button", { name: "Color propio" })).toBeDisabled();
    expect(screen.getByText("Escribe un color como #RRGGBB.")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Color en hexadecimal"), "AB56");
    await user.click(screen.getByRole("button", { name: "Color propio" }));
    expect(page().cover).toBe("color:#12ab56");
  });
});

describe("pestaña Degradados (E-085)", () => {
  it("muestra los seis degradados actuales", async () => {
    const { user } = await setup();
    await openPicker(user);
    await user.click(screen.getByRole("tab", { name: "Degradados" }));
    expect(screen.getByRole("group", { name: "Degradados de la aplicación" }).querySelectorAll("button")).toHaveLength(6);
  });
  it("el editor guarda `lgrad:` con los colores y el ángulo elegidos", async () => {
    const { user, page } = await setup();
    await openPicker(user);
    await user.click(screen.getByRole("tab", { name: "Degradados" }));
    fireEvent.change(screen.getByLabelText("Color 1"), { target: { value: "#112233" } });
    fireEvent.change(screen.getByLabelText("Color 2"), { target: { value: "#445566" } });
    await user.click(screen.getByRole("radio", { name: "45°" }));
    await user.click(screen.getByRole("button", { name: "Añadir un tercer color" }));
    fireEvent.change(screen.getByLabelText("Color 3"), { target: { value: "#778899" } });
    await user.click(screen.getByRole("button", { name: "Degradado propio" }));
    expect(page().cover).toBe("lgrad:45:#112233,#445566,#778899");
  });
  it("el ángulo exacto se acota a 0–359", async () => {
    const { user, page } = await setup();
    await openPicker(user);
    await user.click(screen.getByRole("tab", { name: "Degradados" }));
    fireEvent.change(screen.getByLabelText("Ángulo exacto (grados)"), { target: { value: "900" } });
    await user.click(screen.getByRole("button", { name: "Degradado propio" }));
    expect(page().cover).toMatch(/^lgrad:359:/);
  });
});

describe("pintar la portada (E-086)", () => {
  it.each([
    ["gradient:sage", "gradient"], ["color:#cfe8ff", "color"], ["lgrad:90:#112233,#445566", "lgrad"],
  ])("pinta %s", async (cover, kind) => {
    const { controller, id } = await setup();
    await controller.setPageProps(id, { cover });
    expect((await screen.findByTestId("cover")).getAttribute("data-cover-kind")).toBe(kind);
  });
  it("una portada de archivo pinta la imagen del almacén", async () => {
    const { controller, id, assets } = await setup();
    const { hash } = await assets!.put(new Uint8Array([0xff, 0xd8, 0xff, 1]));
    await controller.setPageProps(id, { cover: `asset:${hash}` });
    expect((await screen.findByTestId("cover")).getAttribute("data-cover-kind")).toBe("asset");
    await waitFor(() => expect(document.querySelector('[data-testid="cover"] img')).not.toBeNull());
  });
  it("un valor dañado se trata como «sin portada»: no hay recuadro y se ofrece añadir una", async () => {
    const { db, controller, id } = await (async () => { const s = await setup(); return { ...s, db: null }; })();
    void db;
    await controller.setPageProps(id, { cover: "gradient:sky" });
    await controller.setPageProps(id, { cover: "no-es-valido" } as never);
    expect(screen.queryByTestId("cover")).toBeNull();
    expect(screen.getByRole("button", { name: "Añadir portada" })).toBeInTheDocument();
  });
});
