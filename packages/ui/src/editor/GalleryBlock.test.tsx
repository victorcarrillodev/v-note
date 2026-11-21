import type React from "react";
import { describe, it, expect, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { serializeGallery } from "@vnote/core";
import { renderWithI18n } from "../../tests/renderWithI18n";
import { GalleryView } from "./GalleryBlock";

const imgs = serializeGallery([{ url: "asset:1", name: "a.png", caption: "Uno", cols: 1, rows: 1, fit: "" }, { url: "asset:2", name: "b.png", caption: "", cols: 1, rows: 1, fit: "" }]);
const base = { images: imgs, layout: "mosaic", editable: true, resolve: async (u: string) => `blob:${u}`, upload: async (f: File) => `asset:${f.name}`, onChange: () => {} };

describe("GalleryView", () => {
  it("muestra las imágenes en cada diseño", async () => {
    for (const layout of ["mosaic", "columns", "carousel"]) {
      const { unmount } = await renderWithI18n(<GalleryView {...base} layout={layout} />);
      expect(await screen.findAllByRole("img")).toHaveLength(2);
      expect(document.querySelector(`[data-gallery-layout="${layout}"]`)).not.toBeNull();
      unmount();
    }
  });
  it("cambiar el diseño y quitar una imagen avisan al bloque", async () => {
    const onChange = vi.fn();
    await renderWithI18n(<GalleryView {...base} onChange={onChange} />);
    await userEvent.click(screen.getByRole("radio", { name: "Carrusel" }));
    expect(onChange).toHaveBeenCalledWith({ layout: "carousel" });
    await userEvent.click(await screen.findByRole("button", { name: "Opciones de Uno" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Quitar imagen" }));
    expect(JSON.parse(onChange.mock.calls[1]![0].images)).toHaveLength(1);
  });
  it("añadir imágenes las sube y las agrega; los archivos que no son imagen se ignoran", async () => {
    const onChange = vi.fn();
    await renderWithI18n(<GalleryView {...base} images="" onChange={onChange} />);
    expect(screen.getByText(/Aún no hay imágenes/)).toBeInTheDocument();
    const input = screen.getByLabelText("Añadir imágenes", { selector: "input" });
    await userEvent.upload(input, [new File(["x"], "c.png", { type: "image/png" }), new File(["y"], "d.txt", { type: "text/plain" })]);
    await waitFor(() => expect(onChange).toHaveBeenCalled());
    expect(JSON.parse(onChange.mock.calls[0]![0].images)).toEqual([{ url: "asset:c.png", name: "c.png", caption: "", cols: 1, rows: 1, fit: "" }]);
  });
  it("de solo lectura no hay controles", async () => {
    await renderWithI18n(<GalleryView {...base} editable={false} />);
    expect(screen.queryByRole("radio")).toBeNull();
    expect(screen.queryByRole("button", { name: /Opciones de/ })).toBeNull();
  });
  it("mosaico personalizado: elegir el estilo y cambiar cuánto ocupa una imagen", async () => {
    const onChange = vi.fn();
    const { rerender } = (await renderWithI18n(<GalleryView {...base} onChange={onChange} />)) as never as { rerender: (ui: React.ReactElement) => void };
    await userEvent.click(await screen.findByRole("button", { name: "Opciones de Uno" }));
    expect(screen.queryByRole("menuitem", { name: "Ensanchar" })).toBeNull(); // regular: sin controles de tamaño
    await userEvent.keyboard("{Escape}");
    await userEvent.click(screen.getByRole("radio", { name: "Personalizado" }));
    expect(onChange).toHaveBeenCalledWith({ mosaicStyle: "custom" });
    rerender(<GalleryView {...base} mosaicStyle="custom" onChange={onChange} />);
    await userEvent.click(await screen.findByRole("button", { name: "Opciones de Uno" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Ensanchar" }));
    expect(JSON.parse(onChange.mock.calls[1]![0].images)[0]).toMatchObject({ cols: 2, rows: 1 });
    const figs = document.querySelectorAll("[data-gallery-item]");
    expect((figs[0] as HTMLElement).style.gridColumn).toBe("span 1");
  });
});
