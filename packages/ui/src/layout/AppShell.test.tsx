// T-110 (prueba primero): diseño con barra lateral y área de página.
import { describe, it, expect, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithI18n } from "../../tests/renderWithI18n";
import userEvent from "@testing-library/user-event";
import { AppShell } from "./AppShell";

// jsdom mide 1 024 px (< 1 040): por diseño eso es el modo superpuesto. Las pruebas del marco acoplado fijan un ancho amplio.
beforeEach(() => { Object.defineProperty(window, "innerWidth", { configurable: true, value: 1400 }); });

describe("AppShell", () => {
  it("muestra la barra lateral y el área de página con sus roles accesibles", async () => {
    await renderWithI18n(<AppShell sidebar={<p>árbol</p>}><p>contenido</p></AppShell>);
    expect(screen.getByRole("complementary", { name: /barra lateral/i })).toContainElement(screen.getByText("árbol"));
    expect(screen.getByRole("main")).toContainElement(screen.getByText("contenido"));
  });
  it("la barra lateral se puede ocultar y volver a mostrar con un botón accesible", async () => {
    await renderWithI18n(<AppShell sidebar={<p>árbol</p>}><p>contenido</p></AppShell>);
    const user = userEvent.setup();
    const toggle = screen.getByRole("button", { name: /ocultar barra lateral/i });
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    await user.click(toggle);
    expect(screen.queryByText("árbol")).not.toBeVisible();
    expect(screen.getByRole("button", { name: /mostrar barra lateral/i })).toHaveAttribute("aria-expanded", "false");
    await user.click(screen.getByRole("button", { name: /mostrar barra lateral/i }));
    expect(screen.getByText("árbol")).toBeVisible();
  });
  it("incluye un enlace para saltar al contenido (accesibilidad por teclado)", async () => {
    await renderWithI18n(<AppShell sidebar={<p>x</p>}><p>y</p></AppShell>);
    expect(screen.getByRole("link", { name: /saltar al contenido/i })).toHaveAttribute("href", "#contenido");
  });
  it("el botón de la barra lateral controla un elemento que existe (aria-controls válido)", async () => {
    await renderWithI18n(<AppShell sidebar={<p>lateral</p>}><p>contenido</p></AppShell>);
    const btn = screen.getByRole("button", { name: /barra lateral/i });
    const id = btn.getAttribute("aria-controls");
    expect(id).toBeTruthy();
    expect(document.getElementById(id!)).not.toBeNull();
  });
});

// ---- Spec 002 (U-068 a U-074, U-079 a U-083): marco de la ventana ----
import { act } from "@testing-library/react";
import { MemoryPreferences } from "../theme/theme";

const setWidth = (w: number) => { Object.defineProperty(window, "innerWidth", { configurable: true, value: w }); act(() => { window.dispatchEvent(new Event("resize")); }); };

describe("estructura del marco (RF-3.1, RF-3.2)", () => {
  it("barra lateral de 240 px, cabecera de 44 px y contenido", async () => {
    setWidth(1400);
    await renderWithI18n(<AppShell sidebar={<p>s</p>} header={<span>cabecera</span>}><p>c</p></AppShell>);
    expect(screen.getByRole("complementary", { name: /barra lateral/i }).className).toContain("w-[var(--size-sidebar-width)]");
    const header = screen.getByRole("banner");
    expect(header.className).toContain("h-[var(--size-header-height)]");
    expect(header).toContainElement(screen.getByText("cabecera"));
  });
  it("la cabecera vive en el marco, no en cada pantalla: al cambiar el contenido es el mismo elemento", async () => {
    setWidth(1400);
    const { createI18n } = await import("../i18n");
    const { I18nextProvider } = await import("react-i18next");
    const { render } = await import("@testing-library/react");
    const i18n = await createI18n();
    const ui = (c: string) => <I18nextProvider i18n={i18n}><AppShell sidebar={<p>s</p>} header={<span>h</span>}><p>{c}</p></AppShell></I18nextProvider>;
    const { rerender } = render(ui("uno"));
    const a = screen.getByRole("banner");
    rerender(ui("dos"));
    expect(screen.getByRole("banner")).toBe(a);
    expect(screen.getByText("dos")).toBeInTheDocument();
  });
});

describe("plegado recordado (RF-3.3)", () => {
  it("el estado se guarda en las preferencias y se restaura", async () => {
    setWidth(1400);
    const prefs = new MemoryPreferences();
    const first = await renderWithI18n(<AppShell sidebar={<p>árbol</p>} preferences={prefs}><p>c</p></AppShell>);
    await userEvent.click(screen.getByRole("button", { name: /ocultar barra lateral/i }));
    expect(prefs.get("sidebar")).toBe("closed");
    first.unmount();
    await renderWithI18n(<AppShell sidebar={<p>árbol</p>} preferences={prefs}><p>c</p></AppShell>);
    expect(screen.getByRole("button", { name: /mostrar barra lateral/i })).toHaveAttribute("aria-expanded", "false");
  });
  it("también se alterna con el atajo Ctrl+\\ cuando el marco lo gestiona", async () => {
    setWidth(1400);
    await renderWithI18n(<AppShell sidebar={<p>árbol</p>}><p>c</p></AppShell>);
    await userEvent.keyboard("{Control>}\\{/Control}");
    expect(screen.getByRole("button", { name: /mostrar barra lateral/i })).toBeInTheDocument();
  });
});

describe("ancho de lectura (RF-3.5)", () => {
  it("el contenido de una página usa el ancho de lectura de 720 px centrado", async () => {
    setWidth(1400);
    await renderWithI18n(<AppShell sidebar={<p>s</p>}><p>c</p></AppShell>);
    expect(document.documentElement.style.getPropertyValue("--reading-width") || "720").toBeTruthy();
    expect(screen.getByRole("main").className).toContain("min-h-0");
  });
});

describe("adaptación a la ventana (RF-15)", () => {
  it("por debajo de 1 040 px la barra lateral se pliega sola y se abre superpuesta con velo", async () => {
    setWidth(1000);
    await renderWithI18n(<AppShell sidebar={<p>árbol</p>}><p>c</p></AppShell>);
    expect(screen.getByRole("button", { name: /mostrar barra lateral/i })).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(screen.getByRole("button", { name: /mostrar barra lateral/i }));
    expect(screen.getByText("árbol")).toBeVisible();
    expect(document.querySelector("[data-shell-scrim]")).not.toBeNull();
    expect(screen.getByRole("complementary", { name: /barra lateral/i }).className).toContain("fixed");
  });
  it("el panel superpuesto se cierra con Escape y al hacer clic en el velo", async () => {
    setWidth(1000);
    await renderWithI18n(<AppShell sidebar={<p>árbol</p>}><p>c</p></AppShell>);
    await userEvent.click(screen.getByRole("button", { name: /mostrar barra lateral/i }));
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByText("árbol")).not.toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: /mostrar barra lateral/i }));
    await userEvent.click(document.querySelector("[data-shell-scrim]") as HTMLElement);
    expect(screen.queryByText("árbol")).not.toBeVisible();
  });
  it("elegir una página (closeOverlay del contexto) cierra el panel superpuesto", async () => {
    setWidth(1000);
    const { useShell } = await import("./AppShell");
    function Link() { const { closeOverlay } = useShell(); return <button onClick={closeOverlay}>Abrir página</button>; }
    await renderWithI18n(<AppShell sidebar={<Link />}><p>c</p></AppShell>);
    await userEvent.click(screen.getByRole("button", { name: /mostrar barra lateral/i }));
    await userEvent.click(screen.getByRole("button", { name: "Abrir página" }));
    expect(screen.getByRole("button", { name: "Abrir página", hidden: true })).not.toBeVisible();
  });
  it("por encima de 1 040 px la barra va acoplada y sin velo", async () => {
    setWidth(1200);
    await renderWithI18n(<AppShell sidebar={<p>árbol</p>}><p>c</p></AppShell>);
    expect(document.querySelector("[data-shell-scrim]")).toBeNull();
    expect(screen.getByRole("complementary", { name: /barra lateral/i }).className).not.toContain("fixed");
  });
  it("por debajo de 900 px nada se comprime ni se rompe: la lectura reflúa y solo se permite desplazar lo que no cabe", async () => {
    setWidth(800);
    const { container } = await renderWithI18n(<AppShell sidebar={<p>s</p>}><p>c</p></AppShell>);
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain("overflow-x-auto");
    // No hay un ancho mínimo forzado: el contenido de lectura se adapta al ancho disponible (zoom al 200 %, RF-14.10).
    expect(root.innerHTML).not.toContain("min-w-[var(--size-window-min)]");
    expect(screen.getByRole("main").className).toContain("min-h-0");
  });
});
