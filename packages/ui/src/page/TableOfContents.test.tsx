// U-169 y U-170 (RF-5.8, RF-14.8): tabla de contenidos lateral y menú «En esta página».
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithI18n } from "../../tests/renderWithI18n";
import { TableOfContents } from "./TableOfContents";

const hs = [{ id: "a", level: 1, text: "Introducción" }, { id: "b", level: 2, text: "Detalles" }, { id: "c", level: 1, text: "Cierre" }];
const setWidth = (w: number) => { Object.defineProperty(window, "innerWidth", { configurable: true, value: w }); };
// Una ventana lo bastante ancha para que la columna lateral quepa en el margen del contenido (E-141); el resto de pruebas ajusta el ancho a su caso.
const WIDE = 2000;
beforeEach(() => { setWidth(WIDE); });
afterEach(() => { setWidth(WIDE); });

describe("TableOfContents", () => {
  it("con menos de 3 encabezados no se muestra", async () => {
    await renderWithI18n(<TableOfContents headings={hs.slice(0, 2)} activeId="a" onJump={() => {}} />);
    expect(screen.queryByRole("navigation", { name: "En esta página" })).toBeNull();
  });
  it("en ancho amplio es una columna lateral con la sección visible marcada", async () => {
    await renderWithI18n(<TableOfContents headings={hs} activeId="b" onJump={() => {}} />);
    const nav = screen.getByRole("navigation", { name: "En esta página" });
    const current = within(nav).getByRole("link", { name: "Detalles" });
    expect(current).toHaveAttribute("aria-current", "location");
    expect(within(nav).getByRole("link", { name: "Cierre" })).not.toHaveAttribute("aria-current");
  });
  it("a 1 100 px se convierte en un menú «En esta página»", async () => {
    setWidth(1100);
    const onJump = vi.fn();
    await renderWithI18n(<TableOfContents headings={hs} activeId="a" onJump={onJump} />);
    expect(screen.queryByRole("navigation", { name: "En esta página" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "En esta página" }));
    await userEvent.click(await screen.findByRole("link", { name: "Cierre" }));
    expect(onJump).toHaveBeenCalledWith("c", "smooth");
  });
  it("con movimiento reducido el salto es instantáneo", async () => {
    const mm = window.matchMedia;
    window.matchMedia = ((q: string) => ({ matches: q.includes("reduce"), media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false })) as typeof window.matchMedia;
    const onJump = vi.fn();
    await renderWithI18n(<TableOfContents headings={hs} activeId="a" onJump={onJump} />);
    await userEvent.click(screen.getByRole("link", { name: "Cierre" }));
    expect(onJump).toHaveBeenCalledWith("c", "auto");
    window.matchMedia = mm;
  });
  it("reacciona al cambio de tamaño de la ventana", async () => {
    await renderWithI18n(<TableOfContents headings={hs} activeId="a" onJump={() => {}} />);
    expect(screen.getByRole("navigation", { name: "En esta página" })).toBeTruthy();
    act(() => { setWidth(1000); window.dispatchEvent(new Event("resize")); });
    expect(screen.getByRole("button", { name: "En esta página" })).toBeTruthy();
  });
});
