// Ícono de página con imagen subida: se elige en la pestaña «Subir», se pinta en la cabecera y en el árbol, y se quita desde el selector.
import { describe, it, expect } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryAssetStore, parseIcon } from "@vnote/core";
import { renderWithI18n } from "../../../tests/renderWithI18n";
import { makeController } from "../../../tests/withController";
import { PageHeader } from "../PageHeader";
import { PageIcon } from "./PageIcon";

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3];
const pngFile = () => new File([new Uint8Array(PNG)], "a.png", { type: "image/png" });

async function setup(encode: (b: Uint8Array) => Promise<Uint8Array>) {
  const { controller } = await makeController();
  const r = await controller.createPage(null, "Página");
  if (!r.ok) throw new Error("x");
  const assets = new MemoryAssetStore();
  await renderWithI18n(<PageHeader controller={controller} pageId={r.value.id} assets={assets} iconEncode={encode} />);
  const icon = () => { const f = (ns: ReturnType<typeof controller.getSnapshot>["tree"]): string | null | undefined => ns.flatMap((n) => (n.page.id === r.value.id ? [n.page.icon] : [f(n.children)]))[0]; return f(controller.getSnapshot().tree); };
  return { icon, assets, user: userEvent.setup() };
}

describe("ícono con imagen", () => {
  it("subir una imagen la guarda en el almacén y deja `asset:<hash>` como ícono", async () => {
    const { icon, assets, user } = await setup(async () => new Uint8Array([7, 7, 7]));
    await user.click(screen.getByRole("button", { name: "Añadir ícono" }));
    await user.click(screen.getByRole("tab", { name: "Subir" }));
    await user.upload(screen.getByLabelText("Subir una imagen"), pngFile());
    await waitFor(() => expect(parseIcon(icon())?.kind).toBe("image"));
    expect((await assets.list()).length).toBe(1);
    expect(screen.queryByRole("group", { name: "Elegir ícono" })).toBeNull(); // el selector se cerró
    expect(screen.getByRole("button", { name: "Cambiar ícono" })).toBeInTheDocument();
  });
  it("un archivo que no es imagen muestra el error y no cambia el ícono", async () => {
    const { icon, user } = await setup(async () => new Uint8Array([7]));
    await user.click(screen.getByRole("button", { name: "Añadir ícono" }));
    await user.click(screen.getByRole("tab", { name: "Subir" }));
    await user.upload(screen.getByLabelText("Subir una imagen"), new File([new Uint8Array([1, 2, 3, 4])], "x.png", { type: "image/png" }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(icon()).toBeNull();
  });
  it("«Quitar» del selector borra la imagen del ícono", async () => {
    const { icon, user } = await setup(async () => new Uint8Array([7, 7]));
    await user.click(screen.getByRole("button", { name: "Añadir ícono" }));
    await user.click(screen.getByRole("tab", { name: "Subir" }));
    await user.upload(screen.getByLabelText("Subir una imagen"), pngFile());
    await waitFor(() => expect(parseIcon(icon())?.kind).toBe("image"));
    await user.click(screen.getByRole("button", { name: "Cambiar ícono" }));
    await user.click(screen.getByRole("button", { name: "Quitar" }));
    expect(icon()).toBeNull();
  });
});

describe("PageIcon", () => {
  it("pinta un emoji como texto y una imagen guardada como <img>", async () => {
    const assets = new MemoryAssetStore();
    const { hash } = await assets.put(new Uint8Array([0x89, 0x50, 0x4e, 0x47]));
    const { rerender } = await renderWithI18n(<PageIcon icon="📓" size={20} data-testid="i" />);
    expect(screen.getByTestId("i")).toHaveTextContent("📓");
    rerender(<PageIcon icon={`asset:${hash}`} assets={assets} size={20} data-testid="i" />);
    await waitFor(() => expect(screen.getByTestId("i").querySelector("img")).not.toBeNull());
  });
  it("sin ícono o con una referencia mal formada no pinta nada", async () => {
    await renderWithI18n(<><PageIcon icon={null} size={16} data-testid="a" /><PageIcon icon="asset:mal" size={16} data-testid="b" /></>);
    expect(screen.queryByTestId("a")).toBeNull();
    expect(screen.queryByTestId("b")).toBeNull();
  });
  it("un ícono de texto largo (de cuando se escribía a mano) ocupa su propio ancho y no se encima al título", async () => {
    await renderWithI18n(<PageIcon icon="hacker" size={16} data-testid="t" />);
    const el = screen.getByTestId("t");
    expect(el.style.minWidth).toBe("16px");
    expect(el.style.width).toBe("");
    expect(el.className).toContain("whitespace-nowrap");
  });
});
