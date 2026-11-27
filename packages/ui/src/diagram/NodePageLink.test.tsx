// study-features-2 T-7 (prueba primero): enlazar una forma del lienzo con una página.
import { describe, it, expect, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithI18n } from "../../tests/renderWithI18n";
import { NodePageLink } from "./NodePageLink";
import { LinkBadge } from "./ShapeNode";

const api = (state: "ok" | "trashed" | "missing" = "ok") => ({
  resolve: vi.fn(async (id: string) => ({ state, id, title: state === "missing" ? "" : "Pilas y colas" })),
  find: vi.fn(async (q: string) => (q.toLowerCase().startsWith("pil") ? [{ id: "p1", title: "Pilas y colas" }, { id: "p2", title: "Pilas en C" }] : [])),
  open: vi.fn(),
  onSet: vi.fn(),
});

describe("enlace de una forma con una página", () => {
  it("sin enlace: busca páginas mientras se escribe y enlaza la elegida", async () => {
    const a = api();
    const user = userEvent.setup();
    await renderWithI18n(<NodePageLink page={undefined} resolve={a.resolve} find={a.find} open={a.open} onSet={a.onSet} />);
    await user.type(screen.getByRole("combobox", { name: "Enlazar con una página" }), "pil");
    await user.click(await screen.findByRole("option", { name: "Pilas en C" }));
    expect(a.onSet).toHaveBeenCalledWith("p2");
  });

  it("sin coincidencias lo dice, y no enlaza nada", async () => {
    const a = api();
    const user = userEvent.setup();
    await renderWithI18n(<NodePageLink page={undefined} resolve={a.resolve} find={a.find} open={a.open} onSet={a.onSet} />);
    await user.type(screen.getByRole("combobox", { name: "Enlazar con una página" }), "zzz");
    expect(await screen.findByText("No hay páginas con ese nombre.")).toBeInTheDocument();
    expect(a.onSet).not.toHaveBeenCalled();
  });

  it("con enlace: muestra el título vigente, abre la página y permite quitar el enlace", async () => {
    const a = api();
    const user = userEvent.setup();
    await renderWithI18n(<NodePageLink page="p1" resolve={a.resolve} find={a.find} open={a.open} onSet={a.onSet} />);
    expect(await screen.findByText("Pilas y colas")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Abrir página enlazada" }));
    expect(a.open).toHaveBeenCalledWith("p1");
    await user.click(screen.getByRole("button", { name: "Quitar enlace" }));
    expect(a.onSet).toHaveBeenCalledWith(null);
  });

  it("si la página ya no existe lo avisa y deja quitar el enlace (no rompe el lienzo)", async () => {
    const a = api("missing");
    await renderWithI18n(<NodePageLink page="gone" resolve={a.resolve} find={a.find} open={a.open} onSet={a.onSet} />);
    expect(await screen.findByText("La página enlazada ya no existe.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Abrir página enlazada" })).toBeNull();
    expect(screen.getByRole("button", { name: "Quitar enlace" })).toBeInTheDocument();
  });

  it("una página en la papelera se marca, pero el enlace sigue ahí", async () => {
    const a = api("trashed");
    await renderWithI18n(<NodePageLink page="t" resolve={a.resolve} find={a.find} open={a.open} onSet={a.onSet} />);
    await waitFor(() => expect(screen.getByText(/papelera/i)).toBeInTheDocument());
  });
});

describe("insignia de enlace en la forma", () => {
  it("abre la página enlazada al pulsarla, sin seleccionar ni mover la forma", async () => {
    const onOpen = vi.fn();
    const onPointerDown = vi.fn();
    const user = userEvent.setup();
    await renderWithI18n(<div onPointerDown={onPointerDown}><LinkBadge page="p1" onOpen={onOpen} /></div>);
    await user.click(screen.getByRole("button", { name: "Abrir página enlazada" }));
    expect(onOpen).toHaveBeenCalledWith("p1");
    expect(onPointerDown).not.toHaveBeenCalled();
  });
});
