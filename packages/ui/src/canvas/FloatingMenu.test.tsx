// R-032 a R-038 (prueba primero): menú emergente anclado a un elemento o a un punto (plan 004, §5.3, DP-3).
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FloatingMenu, type MenuGroup } from "./FloatingMenu";

const area = { left: 0, top: 0, width: 1000, height: 600 };
const groups: MenuGroup[] = [
  { id: "look", label: "Apariencia", icon: "tag", children: <><button type="button">Relleno</button><button type="button">Contorno</button></> },
  { id: "struct", label: "Estructura", icon: "link", children: <button type="button">Trazado</button> },
  { id: "acts", label: "Acciones", icon: "check", children: <><input aria-label="Texto" defaultValue="hola" /><button type="button">Eliminar</button></> },
];
const rect = (left: number, top: number, width: number, height: number) => ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => ({}) });

let anchorEl: HTMLElement;
beforeEach(() => { anchorEl = document.createElement("div"); anchorEl.setAttribute("data-anchor", ""); document.body.appendChild(anchorEl); anchorEl.getBoundingClientRect = () => rect(400, 300, 100, 40) as DOMRect; });

const setup = (over: Partial<React.ComponentProps<typeof FloatingMenu>> = {}) => {
  const onClose = vi.fn();
  const ui = (p: Partial<React.ComponentProps<typeof FloatingMenu>> = {}) => <FloatingMenu open anchor={{ element: anchorEl }} area={area} label="Opciones de la forma" groups={groups} onClose={onClose} {...over} {...p} />;
  const r = render(ui());
  return { ...r, onClose, ui, rerenderWith: (p: Partial<React.ComponentProps<typeof FloatingMenu>>) => r.rerender(ui(p)) };
};

describe("presencia y nombre accesible (R-032, R-038)", () => {
  it("cerrado no muestra nada", () => { setup({ open: false }); expect(screen.queryByRole("dialog")).toBeNull(); });
  it("abierto expone un diálogo no modal con nombre", async () => {
    setup();
    const d = await screen.findByRole("dialog", { name: "Opciones de la forma" });
    expect(d).toBeInTheDocument();
    expect(d).not.toHaveAttribute("aria-modal", "true");
  });
});

describe("grupos con etiqueta e ícono en orden estable (R-037, RF-2)", () => {
  it("muestra los grupos en el orden dado con su etiqueta", async () => {
    setup();
    const d = await screen.findByRole("dialog");
    const labels = within(d).getAllByRole("group").map((g) => g.getAttribute("aria-label"));
    expect(labels).toEqual(["Apariencia", "Estructura", "Acciones"]);
  });
  it("cada grupo trae un ícono decorativo y el mismo orden en dos renderizados", async () => {
    const a = setup(); const d1 = await screen.findByRole("dialog");
    const order1 = within(d1).getAllByRole("group").map((g) => g.getAttribute("aria-label"));
    expect(d1.querySelectorAll("svg[aria-hidden='true']").length).toBeGreaterThanOrEqual(3);
    a.unmount();
    setup(); const d2 = await screen.findByRole("dialog");
    expect(within(d2).getAllByRole("group").map((g) => g.getAttribute("aria-label"))).toEqual(order1);
  });
});

describe("cierre (R-035, RF-1, CL-2)", () => {
  it("Esc cierra", async () => {
    const { onClose } = setup(); await screen.findByRole("dialog");
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
  });
  it("un clic fuera cierra", async () => {
    const { onClose } = setup(); await screen.findByRole("dialog");
    const out = document.createElement("div"); document.body.appendChild(out);
    await userEvent.pointer({ keys: "[MouseLeft]", target: out });
    expect(onClose).toHaveBeenCalled();
  });
  it("un clic sobre el propio elemento ancla no cierra", async () => {
    const { onClose } = setup(); await screen.findByRole("dialog");
    await userEvent.pointer({ keys: "[MouseLeft]", target: anchorEl });
    expect(onClose).not.toHaveBeenCalled();
  });
  it("un clic en algo que se declara «no cierra» no cierra", async () => {
    const other = document.createElement("div"); other.setAttribute("data-keep", ""); document.body.appendChild(other);
    const { onClose } = setup({ keepOpenOn: (t) => t.closest("[data-keep]") !== null }); await screen.findByRole("dialog");
    await userEvent.pointer({ keys: "[MouseLeft]", target: other });
    expect(onClose).not.toHaveBeenCalled();
  });
  it("cambiar de elemento ancla mantiene el menú abierto con el contenido nuevo (CL-2)", async () => {
    const other = document.createElement("div"); document.body.appendChild(other); other.getBoundingClientRect = () => rect(600, 100, 80, 40) as DOMRect;
    const { rerenderWith, onClose } = setup(); await screen.findByRole("dialog");
    rerenderWith({ anchor: { element: other }, label: "Opciones del conector", groups: [{ id: "x", label: "Conector", children: <button type="button">Puntas</button> }] });
    expect(await screen.findByRole("dialog", { name: "Opciones del conector" })).toBeInTheDocument();
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Puntas" })).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe("sin robar el foco (R-036, RF-14)", () => {
  it("al abrirse deja el foco donde estaba", async () => {
    const field = document.createElement("input"); document.body.appendChild(field); field.focus();
    setup(); await screen.findByRole("dialog");
    expect(field).toHaveFocus();
  });
  it("al cerrarse no mueve el foco", async () => {
    const field = document.createElement("input"); document.body.appendChild(field); field.focus();
    const { rerenderWith } = setup(); await screen.findByRole("dialog");
    rerenderWith({ open: false });
    expect(field).toHaveFocus();
  });
});

describe("teclado (R-038, RF-2)", () => {
  it("las flechas recorren los controles y Esc cierra", async () => {
    const { onClose } = setup(); await screen.findByRole("dialog");
    screen.getByRole("button", { name: "Relleno" }).focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByRole("button", { name: "Contorno" })).toHaveFocus();
    await userEvent.keyboard("{ArrowDown}");
    expect(screen.getByRole("button", { name: "Trazado" })).toHaveFocus();
    await userEvent.keyboard("{ArrowLeft}");
    expect(screen.getByRole("button", { name: "Contorno" })).toHaveFocus();
    await userEvent.keyboard("{End}");
    expect(screen.getByRole("button", { name: "Eliminar" })).toHaveFocus();
    await userEvent.keyboard("{Home}");
    expect(screen.getByRole("button", { name: "Relleno" })).toHaveFocus();
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
  });
  it("dentro de un campo de texto las flechas no se secuestran", async () => {
    setup(); await screen.findByRole("dialog");
    const input = screen.getByRole("textbox", { name: "Texto" });
    input.focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(input).toHaveFocus();
  });
});

describe("ancla en un punto y visibilidad (R-033)", () => {
  it("con el punto dentro del área se muestra", async () => {
    setup({ anchor: { point: { x: 500, y: 300 } } });
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });
  it("con el punto fuera del área se oculta y reaparece al volver", async () => {
    const { rerenderWith } = setup({ anchor: { point: { x: 5000, y: 300 } } });
    expect(screen.queryByRole("dialog")).toBeNull();
    rerenderWith({ anchor: { point: { x: 500, y: 300 } } });
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    rerenderWith({ anchor: { point: { x: -20, y: 300 } } });
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("tamaño (R-034, RNF-4)", () => {
  it("alto máximo del 40 % del área visible, con desplazamiento interno", async () => {
    setup(); const d = await screen.findByRole("dialog");
    expect(d.style.maxHeight).toBe("240px");   // 600 × 0.4
    expect(d.style.overflowY).toBe("auto");
  });
});

describe("ancla en un rectángulo (conectores)", () => {
  it("se muestra con el rectángulo dentro del área y se oculta fuera de ella", async () => {
    const { rerenderWith } = setup({ anchor: { rect: { left: 300, top: 200, width: 400, height: 120 } } });
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    rerenderWith({ anchor: { rect: { left: 3000, top: 200, width: 400, height: 120 } } });
    expect(screen.queryByRole("dialog")).toBeNull();
    rerenderWith({ anchor: { rect: { left: 900, top: 200, width: 400, height: 120 } } });   // cruza el borde: sigue visible
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });
  it("un menú compacto puede pedir un alto mínimo mayor que el 40 % (selector de color del mapa)", async () => {
    setup({ minHeight: 300 }); const d = await screen.findByRole("dialog");
    expect(d.style.maxHeight).toBe("300px");
  });
});
