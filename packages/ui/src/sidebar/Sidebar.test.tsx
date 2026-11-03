// U-077, U-078, U-083, U-084, U-085 (RF-4.1, RF-4.4, RF-4.5, RF-10.6, RF-9.1): contenido de la barra lateral.
import { describe, it, expect, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithI18n } from "../../tests/renderWithI18n";
import { makeController } from "../../tests/withController";
import { Sidebar } from "./Sidebar";
import { SidebarLinks } from "./SidebarLinks";

describe("Sidebar", () => {
  it("el campo «Buscar» muestra el atajo y abre la paleta", async () => {
    const { controller } = await makeController();
    const onSearch = vi.fn();
    await renderWithI18n(<Sidebar controller={controller} onOpenTrash={() => {}} onSearch={onSearch} searchCombo="Ctrl+K" />);
    const btn = screen.getByRole("button", { name: /Buscar/ });
    expect(btn).toHaveTextContent("Ctrl+K");
    await userEvent.click(btn);
    expect(onSearch).toHaveBeenCalled();
  });
  it("las acciones de creación llevan ícono y mantienen su texto", async () => {
    const { controller } = await makeController();
    await renderWithI18n(<Sidebar controller={controller} onOpenTrash={() => {}} />);
    for (const n of ["Nueva página", "Nueva base de datos", "Nuevo tablero"]) expect(screen.getByRole("button", { name: n }).querySelector("svg"), n).not.toBeNull();
  });
  it("los favoritos se muestran con ícono de estrella cuando existen", async () => {
    const { controller } = await makeController();
    const p = await controller.createPage(null, "Plan");
    if (!p.ok) throw new Error("x");
    await controller.toggleFavorite(p.value.id);
    await renderWithI18n(<Sidebar controller={controller} onOpenTrash={() => {}} />);
    const region = await screen.findByRole("region", { name: "Favoritos" });
    expect(within(region).getByRole("button", { name: "Plan" })).toBeInTheDocument();
    expect(region.querySelector("svg")).not.toBeNull();
  });
  it("sin favoritos no aparece la sección", async () => {
    const { controller } = await makeController();
    await renderWithI18n(<Sidebar controller={controller} onOpenTrash={() => {}} />);
    expect(screen.queryByRole("region", { name: "Favoritos" })).toBeNull();
  });
  it("el aviso de mover a una descendiente es un aviso persistente con ícono y se puede cerrar", async () => {
    const { controller } = await makeController();
    const a = await controller.createPage(null, "A"); const b = await controller.createPage(a.ok ? a.value.id : null, "B");
    if (!a.ok || !b.ok) throw new Error("x");
    await controller.movePage(a.value.id, b.value.id);
    await renderWithI18n(<Sidebar controller={controller} onOpenTrash={() => {}} />);
    const alert = await screen.findByRole("alert");
    expect(alert.querySelector("svg")).not.toBeNull();
    await userEvent.click(within(alert).getByRole("button", { name: /cerrar aviso/i }));
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("SidebarLinks (RF-4.1, RF-4.4)", () => {
  const items = [
    [{ id: "capture", label: "Captura rápida", icon: "inbox" as const, onClick: vi.fn() }, { id: "graph", label: "Grafo", icon: "graph" as const, onClick: vi.fn() }],
    [{ id: "backup", label: "Respaldo", icon: "backup" as const, onClick: vi.fn() }],
  ];
  it("agrupa los accesos con jerarquía menor: texto suave de 13 px y con ícono", async () => {
    await renderWithI18n(<SidebarLinks groups={items} />);
    const link = screen.getByRole("button", { name: "Grafo" });
    expect(link.className).toContain("text-[var(--c-text-muted)]");
    expect(link.className).toContain("text-[length:var(--text-ui-small-size)]");
    expect(link.querySelector("svg")).not.toBeNull();
    expect(screen.getAllByRole("group")).toHaveLength(2);
  });
  it("cada acceso ejecuta su acción", async () => {
    const onClick = vi.fn();
    await renderWithI18n(<SidebarLinks groups={[[{ id: "x", label: "Ajustes", icon: "settings", onClick }]]} />);
    await userEvent.click(screen.getByRole("button", { name: "Ajustes" }));
    expect(onClick).toHaveBeenCalled();
  });
});
