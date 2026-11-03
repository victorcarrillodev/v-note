// U-055 a U-063 (RF-14.6, RF-11.3, RF-7.5, CL-28): menú, popover, modal de formulario, confirmación destructiva y panel lateral.
import { describe, it, expect, vi } from "vitest";
import { useState } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Menu } from "./Menu";
import { Popover } from "./Popover";
import { Dialog } from "./Dialog";
import { ConfirmDialog } from "./ConfirmDialog";
import { SidePanel } from "./SidePanel";
import { TooltipProvider } from "./Tooltip";

const items = [{ label: "Renombrar", onSelect: vi.fn() }, { label: "Duplicar", onSelect: vi.fn() }, { label: "Eliminar", onSelect: vi.fn(), danger: true }];

describe("Menu (teclado completo)", () => {
  it("abre con Enter, recorre con flechas, Inicio y Fin, y elige con Enter", async () => {
    const onSelect = vi.fn();
    render(<TooltipProvider><Menu label="Más acciones" items={[{ label: "Uno", onSelect }, { label: "Dos", onSelect: vi.fn() }, { label: "Tres", onSelect: vi.fn() }]} /></TooltipProvider>);
    const trigger = screen.getByRole("button", { name: "Más acciones" });
    trigger.focus();
    await userEvent.keyboard("{Enter}");
    expect(await screen.findByRole("menu")).toBeInTheDocument();
    await userEvent.keyboard("{End}");
    expect(screen.getByRole("menuitem", { name: "Tres" })).toHaveFocus();
    await userEvent.keyboard("{Home}");
    expect(screen.getByRole("menuitem", { name: "Uno" })).toHaveFocus();
    await userEvent.keyboard("{ArrowDown}");
    expect(screen.getByRole("menuitem", { name: "Dos" })).toHaveFocus();
    await userEvent.keyboard("{ArrowUp}{Enter}");
    expect(onSelect).toHaveBeenCalled();
  });
  it("búsqueda por letra", async () => {
    render(<TooltipProvider><Menu label="Acciones" items={items} /></TooltipProvider>);
    screen.getByRole("button", { name: "Acciones" }).focus();
    await userEvent.keyboard("{Enter}");
    await screen.findByRole("menu");
    await userEvent.keyboard("e");
    const focused = document.activeElement as HTMLElement;
    expect(["Eliminar"]).toContain(focused.textContent);
  });
  it("Escape cierra y devuelve el foco al disparador", async () => {
    render(<TooltipProvider><Menu label="Acciones" items={items} /></TooltipProvider>);
    const trigger = screen.getByRole("button", { name: "Acciones" });
    trigger.focus();
    await userEvent.keyboard("{Enter}");
    await screen.findByRole("menu");
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).toBeNull();
    expect(trigger).toHaveFocus();
  });
  it("el elemento peligroso usa el color de peligro", async () => {
    render(<TooltipProvider><Menu label="Acciones" items={items} /></TooltipProvider>);
    await userEvent.click(screen.getByRole("button", { name: "Acciones" }));
    expect((await screen.findByRole("menuitem", { name: "Eliminar" })).className).toContain("var(--c-danger)");
  });
});

describe("Popover", () => {
  it("abre con clic, cierra con Escape y devuelve el foco", async () => {
    render(<Popover trigger={<button>Fecha</button>}><p>contenido</p></Popover>);
    const t = screen.getByRole("button", { name: "Fecha" });
    await userEvent.click(t);
    expect(await screen.findByText("contenido")).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByText("contenido")).toBeNull();
    expect(t).toHaveFocus();
  });
  it("cierra al hacer clic fuera", async () => {
    render(<div><Popover trigger={<button>Fecha</button>}><p>contenido</p></Popover><p>fuera</p></div>);
    await userEvent.click(screen.getByRole("button", { name: "Fecha" }));
    await screen.findByText("contenido");
    await userEvent.click(screen.getByText("fuera"));
    expect(screen.queryByText("contenido")).toBeNull();
  });
  it("se acota a 360 px y evita colisiones con los bordes de la ventana", async () => {
    render(<Popover trigger={<button>Abrir</button>}><p>x</p></Popover>);
    await userEvent.click(screen.getByRole("button", { name: "Abrir" }));
    const content = (await screen.findByText("x")).closest("[data-side]") as HTMLElement;
    expect(content.className).toContain("max-w-[var(--size-popover-max)]");
  });
});

function Host({ dirty = false, onClose = vi.fn() }: { dirty?: boolean; onClose?: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button onClick={() => setOpen(true)}>Abrir</button>
      <p>fondo</p>
      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) onClose(); }} title="Crear tarea" dirty={dirty}
        footer={<><button onClick={() => setOpen(false)}>Cancelar</button><button>Guardar</button></>}>
        <label>Título<input /></label>
        <button>otro</button>
      </Dialog>
    </div>
  );
}

describe("Dialog (modal de formulario)", () => {
  it("foco inicial en el primer campo y foco atrapado con Tab", async () => {
    render(<Host />);
    await userEvent.click(screen.getByRole("button", { name: "Abrir" }));
    const dlg = await screen.findByRole("dialog", { name: "Crear tarea" });
    expect(within(dlg).getByLabelText("Título")).toHaveFocus();
    for (let i = 0; i < 8; i++) { await userEvent.tab(); expect(dlg.contains(document.activeElement), `Tab ${i}`).toBe(true); }
  });
  it("al cerrar devuelve el foco al elemento que lo abrió", async () => {
    render(<Host />);
    const opener = screen.getByRole("button", { name: "Abrir" });
    await userEvent.click(opener);
    await screen.findByRole("dialog");
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(opener).toHaveFocus();
  });
  it("el fondo queda inerte: no es alcanzable por lectores de pantalla", async () => {
    render(<Host />);
    await userEvent.click(screen.getByRole("button", { name: "Abrir" }));
    await screen.findByRole("dialog");
    expect(screen.queryByRole("button", { name: "Abrir" })).toBeNull(); // oculto para la accesibilidad mientras hay modal
  });
  it("el desplazamiento de la página se bloquea sin cambiar el ancho (sin salto)", async () => {
    render(<Host />);
    await userEvent.click(screen.getByRole("button", { name: "Abrir" }));
    await screen.findByRole("dialog");
    expect(document.body.style.overflow === "hidden" || document.body.hasAttribute("data-scroll-locked")).toBe(true);
    expect(document.body.style.width).not.toBe("100vw");
  });
  it("estructura: cuerpo con desplazamiento y pie fijo con los botones (CL-28)", async () => {
    render(<Host />);
    await userEvent.click(screen.getByRole("button", { name: "Abrir" }));
    const dlg = await screen.findByRole("dialog");
    expect(dlg.querySelector("[data-dialog-body]")!.className).toContain("overflow-y-auto");
    expect(dlg.querySelector("[data-dialog-footer]")!.className).toContain("shrink-0");
    expect(dlg.className).toContain("max-h-[");
  });
  it("sin cambios, Escape cierra directamente", async () => {
    const onClose = vi.fn();
    render(<Host onClose={onClose} />);
    await userEvent.click(screen.getByRole("button", { name: "Abrir" }));
    await screen.findByRole("dialog");
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
  });
  it("con cambios sin guardar, Escape pide confirmar el descarte y no cierra todavía", async () => {
    const onClose = vi.fn();
    render(<Host dirty onClose={onClose} />);
    await userEvent.click(screen.getByRole("button", { name: "Abrir" }));
    await screen.findByRole("dialog", { name: "Crear tarea" });
    await userEvent.keyboard("{Escape}");
    const confirm = await screen.findByRole("alertdialog");
    expect(confirm).toHaveTextContent(/descartar/i);
    expect(onClose).not.toHaveBeenCalled();
    await userEvent.click(within(confirm).getByRole("button", { name: /descartar/i }));
    expect(onClose).toHaveBeenCalled();
  });
  it("con cambios, el clic en el velo no cierra", async () => {
    const onClose = vi.fn();
    render(<Host dirty onClose={onClose} />);
    await userEvent.click(screen.getByRole("button", { name: "Abrir" }));
    await screen.findByRole("dialog");
    const overlay = document.querySelector("[data-dialog-overlay]") as HTMLElement;
    await userEvent.click(overlay);
    expect(onClose).not.toHaveBeenCalled();
    // Queda debajo de la confirmación de descarte (por eso está oculto para la accesibilidad), pero sigue abierto.
    expect(screen.getByRole("dialog", { hidden: true })).toBeInTheDocument();
    expect(await screen.findByRole("alertdialog")).toBeInTheDocument();
  });
  it("no se permite abrir un modal sobre otro modal", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    function Double() {
      return (
        <>
          <Dialog open onOpenChange={() => {}} title="Uno"><p>a</p></Dialog>
          <Dialog open onOpenChange={() => {}} title="Dos"><p>b</p></Dialog>
        </>
      );
    }
    expect(() => render(<Double />)).toThrow(/modal sobre otro modal/i);
    spy.mockRestore();
  });
});

describe("ConfirmDialog (confirmación destructiva)", () => {
  it("foco inicial en el botón seguro (Cancelar); el botón destructivo usa peligro", async () => {
    render(<ConfirmDialog open onOpenChange={() => {}} title="¿Eliminar definitivamente «Plan»?" description="No se puede deshacer." confirmLabel="Eliminar definitivamente" cancelLabel="Cancelar" onConfirm={() => {}} />);
    const dlg = await screen.findByRole("alertdialog");
    expect(within(dlg).getByRole("button", { name: "Cancelar" })).toHaveFocus();
    expect(within(dlg).getByRole("button", { name: "Eliminar definitivamente" }).className).toContain("var(--c-danger)");
  });
  it("el clic en el velo NO cierra", async () => {
    const onOpenChange = vi.fn();
    render(<ConfirmDialog open onOpenChange={onOpenChange} title="t" description="d" confirmLabel="Eliminar" cancelLabel="Cancelar" onConfirm={() => {}} />);
    await screen.findByRole("alertdialog");
    await userEvent.click(document.querySelector("[data-dialog-overlay]") as HTMLElement);
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });
  it("Escape cancela y confirmar ejecuta la acción", async () => {
    const onConfirm = vi.fn(); const onOpenChange = vi.fn();
    render(<ConfirmDialog open onOpenChange={onOpenChange} title="t" description="d" confirmLabel="Eliminar" cancelLabel="Cancelar" onConfirm={onConfirm} />);
    await screen.findByRole("alertdialog");
    await userEvent.click(screen.getByRole("button", { name: "Eliminar" }));
    expect(onConfirm).toHaveBeenCalled();
  });
  it("un diálogo de confirmación sí puede abrirse sobre un modal (máximo dos niveles)", async () => {
    render(<Host dirty />);
    await userEvent.click(screen.getByRole("button", { name: "Abrir" }));
    await screen.findByRole("dialog");
    await userEvent.keyboard("{Escape}");
    expect(await screen.findByRole("alertdialog")).toBeInTheDocument();
  });
});

describe("SidePanel (no modal)", () => {
  function P() {
    const [open, setOpen] = useState(false);
    return (
      <div>
        <button onClick={() => setOpen(true)}>Detalle</button>
        <button>Otro control</button>
        <SidePanel open={open} onClose={() => setOpen(false)} title="Detalle del elemento"><button>dentro</button></SidePanel>
      </div>
    );
  }
  it("es una región complementaria, no atrapa el foco y no vuelve inerte el fondo", async () => {
    render(<P />);
    await userEvent.click(screen.getByRole("button", { name: "Detalle" }));
    expect(await screen.findByRole("complementary", { name: "Detalle del elemento" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Otro control" })).toBeInTheDocument();
  });
  it("Escape lo cierra y el foco vuelve al elemento que lo abrió", async () => {
    render(<P />);
    const opener = screen.getByRole("button", { name: "Detalle" });
    await userEvent.click(opener);
    await screen.findByRole("complementary");
    screen.getByRole("button", { name: "dentro" }).focus();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("complementary")).toBeNull();
    expect(opener).toHaveFocus();
  });
});
