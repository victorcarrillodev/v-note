// R-040 a R-052 (prueba primero): marco compartido del lienzo (plan 004, DP-1, §5.1, §5.2, §5.4).
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useState } from "react";
import { fireEvent, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithI18n } from "../../tests/renderWithI18n";
import { CanvasFrame } from "./CanvasFrame";
import { FloatingMenu } from "./FloatingMenu";
import { MAX_HEIGHT, MIN_HEIGHT } from "@vnote/core";

const zoom = () => ({ level: 1, min: 0.02, max: 4, onIn: vi.fn(), onOut: vi.fn(), onFit: vi.fn(), onReset: vi.fn() });
const hist = () => ({ canUndo: true, canRedo: false, onUndo: vi.fn(), onRedo: vi.fn() });

const mount = async (over: Partial<React.ComponentProps<typeof CanvasFrame>> = {}) => {
  const onHeightChange = vi.fn();
  const props = { testId: "diagram", label: "Lienzo del diagrama", height: undefined, defaultHeight: 420, onHeightChange, zoom: zoom(), history: hist(), ...over };
  const r = await renderWithI18n(<CanvasFrame {...props}><div data-testid="child">lienzo</div></CanvasFrame>);
  return { ...r, onHeightChange, props };
};
const frame = () => screen.getByTestId("diagram");

beforeEach(() => { localStorage.clear(); });

describe("ancho y alto (R-040, RF-12)", () => {
  it("ocupa el ancho de la columna y el alto por defecto", async () => {
    await mount();
    expect(frame().style.width).toBe("100%");
    expect(frame().style.height).toBe("420px");
  });
  it("usa el alto guardado, acotado", async () => {
    await mount({ height: 600 });
    expect(frame().style.height).toBe("600px");
  });
  it("un alto fuera de rango se acota", async () => {
    await mount({ height: 99999 });
    expect(frame().style.height).toBe(`${MAX_HEIGHT}px`);
  });
  it("muestra su contenido", async () => { await mount(); expect(screen.getByTestId("child")).toBeInTheDocument(); });
});

describe("asa de alto con teclado (R-041, RF-12, RF-17)", () => {
  it("es un separador con rango y nombre", async () => {
    await mount({ height: 500 });
    const h = screen.getByRole("separator", { name: "Alto del lienzo" });
    expect(h).toHaveAttribute("aria-valuenow", "500");
    expect(h).toHaveAttribute("aria-valuemin", String(MIN_HEIGHT));
    expect(h).toHaveAttribute("aria-valuemax", String(MAX_HEIGHT));
    expect(h).toHaveAttribute("tabindex", "0");
  });
  it("flecha abajo agranda 20 y arriba reduce 20; con Mayús, 100", async () => {
    const { onHeightChange } = await mount({ height: 500 });
    const h = screen.getByRole("separator");
    fireEvent.keyDown(h, { key: "ArrowDown" }); expect(onHeightChange).toHaveBeenLastCalledWith(520);
    fireEvent.keyDown(h, { key: "ArrowUp" }); expect(onHeightChange).toHaveBeenLastCalledWith(480);
    fireEvent.keyDown(h, { key: "ArrowDown", shiftKey: true }); expect(onHeightChange).toHaveBeenLastCalledWith(600);
  });
  it("respeta el mínimo y el máximo", async () => {
    const { onHeightChange } = await mount({ height: MIN_HEIGHT });
    fireEvent.keyDown(screen.getByRole("separator"), { key: "ArrowUp" });
    expect(onHeightChange).not.toHaveBeenCalled();
  });
});

describe("asa de alto con puntero: un solo paso al soltar (R-041, R-042)", () => {
  const drag = (h: HTMLElement, from: number, to: number, steps = 6) => {
    fireEvent.pointerDown(h, { clientY: from, button: 0, pointerId: 1 });
    for (let i = 1; i <= steps; i++) fireEvent.pointerMove(h, { clientY: from + ((to - from) * i) / steps, pointerId: 1 });
  };
  it("durante el arrastre cambia el alto mostrado pero no avisa; al soltar avisa una vez", async () => {
    const { onHeightChange } = await mount({ height: 500 });
    const h = screen.getByRole("separator");
    drag(h, 800, 900);
    expect(frame().style.height).toBe("600px");
    expect(onHeightChange).not.toHaveBeenCalled();
    fireEvent.pointerUp(h, { clientY: 900, pointerId: 1 });
    expect(onHeightChange).toHaveBeenCalledTimes(1);
    expect(onHeightChange).toHaveBeenCalledWith(600);
  });
  it("el arrastre se acota al rango", async () => {
    const { onHeightChange } = await mount({ height: 500 });
    const h = screen.getByRole("separator");
    drag(h, 800, 5000);
    fireEvent.pointerUp(h, { clientY: 5000, pointerId: 1 });
    expect(onHeightChange).toHaveBeenCalledWith(MAX_HEIGHT);
  });
  it("soltar sin mover no avisa", async () => {
    const { onHeightChange } = await mount({ height: 500 });
    const h = screen.getByRole("separator");
    fireEvent.pointerDown(h, { clientY: 800, button: 0, pointerId: 1 });
    fireEvent.pointerUp(h, { clientY: 800, pointerId: 1 });
    expect(onHeightChange).not.toHaveBeenCalled();
  });
  it("cancelar devuelve el alto anterior", async () => {
    const { onHeightChange } = await mount({ height: 500 });
    const h = screen.getByRole("separator");
    drag(h, 800, 900);
    fireEvent.pointerCancel(h, { pointerId: 1 });
    expect(frame().style.height).toBe("500px");
    expect(onHeightChange).not.toHaveBeenCalled();
  });
});

describe("zoom (R-043, RF-13)", () => {
  it("botones de acercar, alejar, 100 %, ajustar y el porcentaje", async () => {
    const { props } = await mount();
    const z = props.zoom;
    fireEvent.click(screen.getByRole("button", { name: "Acercar" })); expect(z.onIn).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Alejar" })); expect(z.onOut).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Restablecer al 100 %" })); expect(z.onReset).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Ajustar a pantalla" })); expect(z.onFit).toHaveBeenCalled();
    expect(screen.getByText("100 %", { selector: "output" })).toBeInTheDocument();
  });
});

describe("cuadrícula (R-044, RF-18)", () => {
  it("dos interruptores con estado y nombre que cambian y se recuerdan", async () => {
    await mount();
    const show = screen.getByRole("button", { name: "Mostrar cuadrícula" }), snap = screen.getByRole("button", { name: "Acomodar a la cuadrícula" });
    expect(show).toHaveAttribute("aria-pressed", "true");
    expect(snap).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(snap);
    expect(snap).toHaveAttribute("aria-pressed", "false");
    expect(show).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(show);
    expect(show).toHaveAttribute("aria-pressed", "false");
  });
  it("el estado del lienzo avisa a quien lo dibuja", async () => {
    const seen: { show: boolean; snap: boolean }[] = [];
    const onGrid = (g: { show: boolean; snap: boolean }) => seen.push(g);
    await mount({ onGridChange: onGrid });
    fireEvent.click(screen.getByRole("button", { name: "Acomodar a la cuadrícula" }));
    expect(seen.at(-1)).toEqual({ show: true, snap: false });
  });
});

describe("deshacer y rehacer (R-048)", () => {
  it("botones que respetan el estado del historial", async () => {
    const { props } = await mount();
    const undo = screen.getByRole("button", { name: "Deshacer" }), redo = screen.getByRole("button", { name: "Rehacer" });
    expect(undo).toBeEnabled(); expect(redo).toBeDisabled();
    fireEvent.click(undo); expect(props.history.onUndo).toHaveBeenCalled();
  });
});

describe("vista ampliada (R-046 a R-051, RF-3)", () => {
  it("al ampliar cubre la ventana como diálogo modal con nombre", async () => {
    await mount();
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Ampliar" }));
    const d = screen.getByRole("dialog", { name: "Vista ampliada" });
    expect(d).toHaveAttribute("aria-modal", "true");
    expect(d).toBe(frame());
    expect(frame().style.position).toBe("fixed");
    expect(frame().className).toMatch(/inset-0/);
    expect(screen.queryByRole("separator")).toBeNull();   // sin asa de alto
  });
  it("el resto de la interfaz queda inerte y se restituye al salir", async () => {
    const other = document.createElement("main"); document.body.appendChild(other);
    await mount();
    fireEvent.click(screen.getByRole("button", { name: "Ampliar" }));
    expect(other).toHaveAttribute("inert");
    fireEvent.click(screen.getByRole("button", { name: "Salir de la vista ampliada" }));
    expect(other).not.toHaveAttribute("inert");
    other.remove();
  });
  it("el foco queda atrapado dentro con Tab y Mayús+Tab", async () => {
    await mount();
    fireEvent.click(screen.getByRole("button", { name: "Ampliar" }));
    const focusables = [...frame().querySelectorAll<HTMLElement>("button:not(:disabled), [tabindex='0']")];
    const last = focusables.at(-1)!, first = focusables[0]!;
    last.focus();
    await userEvent.tab();
    expect(frame().contains(document.activeElement)).toBe(true);
    first.focus();
    await userEvent.tab({ shift: true });
    expect(frame().contains(document.activeElement)).toBe(true);
  });
  it("al salir el foco vuelve al elemento que lo tenía al ampliar", async () => {
    await mount();
    const open = screen.getByRole("button", { name: "Ampliar" });
    open.focus();
    fireEvent.click(open);
    fireEvent.click(screen.getByRole("button", { name: "Salir de la vista ampliada" }));
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Ampliar" }));
  });
  it("Esc sale de la vista", async () => {
    await mount();
    fireEvent.click(screen.getByRole("button", { name: "Ampliar" }));
    fireEvent.keyDown(frame(), { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Vista ampliada" })).toBeNull();
  });
  it("Esc actúa en capas: con un menú abierto primero lo cierra y luego sale", async () => {
    const anchor = document.createElement("div"); document.body.appendChild(anchor);
    function Host() {
      const [open, setOpen] = useState(true);
      return (
        <CanvasFrame testId="diagram" label="Lienzo" height={undefined} defaultHeight={420} onHeightChange={() => {}} zoom={zoom()} history={hist()}>
          <FloatingMenu open={open} anchor={{ element: anchor }} label="Menú" groups={[{ id: "a", label: "A", children: <button type="button">Uno</button> }]} onClose={() => setOpen(false)} />
        </CanvasFrame>
      );
    }
    await renderWithI18n(<Host />);
    fireEvent.click(screen.getByRole("button", { name: "Ampliar" }));
    await screen.findByRole("dialog", { name: "Menú" });
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "Menú" })).toBeNull();
    expect(screen.getByRole("dialog", { name: "Vista ampliada" })).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "Vista ampliada" })).toBeNull();
  });
  it("conserva el estado de lo que hay dentro al entrar y salir (R-050, CL-9)", async () => {
    function Child() { const [text, setText] = useState(""); return <input aria-label="texto" value={text} onChange={(e) => setText(e.target.value)} />; }
    await renderWithI18n(<CanvasFrame testId="diagram" label="Lienzo" height={undefined} defaultHeight={420} onHeightChange={() => {}} zoom={zoom()} history={hist()}><Child /></CanvasFrame>);
    await userEvent.type(screen.getByLabelText("texto"), "a medio escribir");
    fireEvent.click(screen.getByRole("button", { name: "Ampliar" }));
    expect(screen.getByLabelText("texto")).toHaveValue("a medio escribir");
    fireEvent.click(screen.getByRole("button", { name: "Salir de la vista ampliada" }));
    expect(screen.getByLabelText("texto")).toHaveValue("a medio escribir");
  });
  it("bloquea el desplazamiento de la página mientras está ampliada (R-051)", async () => {
    await mount();
    document.body.style.overflow = "";
    fireEvent.click(screen.getByRole("button", { name: "Ampliar" }));
    expect(document.body.style.overflow).toBe("hidden");
    fireEvent.click(screen.getByRole("button", { name: "Salir de la vista ampliada" }));
    expect(document.body.style.overflow).toBe("");
  });
  it("conserva la barra de herramientas, el zoom y deshacer en la vista ampliada (R-048)", async () => {
    await mount();
    fireEvent.click(screen.getByRole("button", { name: "Ampliar" }));
    for (const n of ["Salir de la vista ampliada", "Deshacer", "Rehacer", "Acercar", "Alejar", "Ajustar a pantalla"]) expect(screen.getByRole("button", { name: n })).toBeInTheDocument();
  });
});

describe("cambios de ancho (R-052, CL-11)", () => {
  type RO = { cb: ResizeObserverCallback; el?: Element };
  const instances: RO[] = [];
  const original = globalThis.ResizeObserver;
  beforeEach(() => { instances.length = 0; globalThis.ResizeObserver = class { cb: ResizeObserverCallback; constructor(cb: ResizeObserverCallback) { this.cb = cb; instances.push(this); } observe(el: Element) { (this as unknown as RO).el = el; } unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver; });
  afterEach(() => { globalThis.ResizeObserver = original; });
  const resize = (w: number) => act(() => { for (const i of instances) i.cb([{ contentRect: { width: w } } as ResizeObserverEntry], i as unknown as ResizeObserver); });

  it("avisa del ancho nuevo y no repite si no cambió", async () => {
    const onWidthChange = vi.fn();
    await mount({ onWidthChange });
    resize(800); resize(800); resize(640);
    expect(onWidthChange.mock.calls.map((c) => c[0])).toEqual([800, 640]);
  });
});

describe("atajo de ampliar (plan §16)", () => {
  it("Ctrl+Mayús+F con el foco dentro amplía y vuelve a salir", async () => {
    await renderWithI18n(<CanvasFrame testId="f" label="Lienzo" height={undefined} defaultHeight={300} onHeightChange={() => undefined} zoom={{ level: 1, min: 0.1, max: 4, onIn: () => undefined, onOut: () => undefined, onFit: () => undefined, onReset: () => undefined }} history={{ canUndo: false, canRedo: false, onUndo: () => undefined, onRedo: () => undefined }}><button type="button">dentro</button></CanvasFrame>);
    const f = screen.getByTestId("f");
    fireEvent.keyDown(screen.getByRole("button", { name: "dentro" }), { key: "F", ctrlKey: true, shiftKey: true });
    expect(f).toHaveAttribute("data-expanded");
    fireEvent.keyDown(screen.getByRole("button", { name: "dentro" }), { key: "F", ctrlKey: true, shiftKey: true });
    expect(f).not.toHaveAttribute("data-expanded");
  });
});
