// T-109 (prueba primero): tema claro, oscuro y seguir al sistema; se aplica y persiste.
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider, useTheme, MemoryPreferences, type PreferenceStore } from "./theme";

type Listener = (e: { matches: boolean }) => void;
function mockMatchMedia(initialDark: boolean) {
  const listeners = new Set<Listener>();
  const mql = {
    matches: initialDark,
    addEventListener: (_: string, l: Listener) => listeners.add(l),
    removeEventListener: (_: string, l: Listener) => listeners.delete(l),
  };
  (window as unknown as { matchMedia: unknown }).matchMedia = () => mql;
  return { setDark(v: boolean) { mql.matches = v; listeners.forEach((l) => l({ matches: v })); }, listenerCount: () => listeners.size };
}

function Panel() {
  const { mode, resolved, setMode } = useTheme();
  return (
    <div>
      <p data-testid="state">{mode}/{resolved}</p>
      <button onClick={() => setMode("light")}>claro</button>
      <button onClick={() => setMode("dark")}>oscuro</button>
      <button onClick={() => setMode("system")}>sistema</button>
    </div>
  );
}
const setup = (prefs: PreferenceStore = new MemoryPreferences()) => render(<ThemeProvider preferences={prefs}><Panel /></ThemeProvider>);
const attr = () => document.documentElement.getAttribute("data-theme");

beforeEach(() => document.documentElement.removeAttribute("data-theme"));

describe("tema", () => {
  it("por defecto sigue al sistema (claro)", () => {
    mockMatchMedia(false);
    setup();
    expect(screen.getByTestId("state").textContent).toBe("system/light");
    expect(attr()).toBe("light");
  });
  it("por defecto sigue al sistema (oscuro)", () => {
    mockMatchMedia(true);
    setup();
    expect(screen.getByTestId("state").textContent).toBe("system/dark");
    expect(attr()).toBe("dark");
  });
  it("los tres modos se aplican", async () => {
    mockMatchMedia(false);
    setup();
    const user = userEvent.setup();
    await user.click(screen.getByText("oscuro"));
    expect(attr()).toBe("dark");
    await user.click(screen.getByText("claro"));
    expect(attr()).toBe("light");
    await user.click(screen.getByText("sistema"));
    expect(screen.getByTestId("state").textContent).toBe("system/light");
  });
  it("en modo sistema reacciona al cambio de preferencia del sistema operativo", () => {
    const media = mockMatchMedia(false);
    setup();
    act(() => media.setDark(true));
    expect(attr()).toBe("dark");
    act(() => media.setDark(false));
    expect(attr()).toBe("light");
  });
  it("en modo fijo ignora los cambios del sistema", async () => {
    const media = mockMatchMedia(false);
    setup();
    await userEvent.setup().click(screen.getByText("claro"));
    act(() => media.setDark(true));
    expect(attr()).toBe("light");
  });
  it("persiste la elección y la restaura al volver a abrir", async () => {
    mockMatchMedia(false);
    const prefs = new MemoryPreferences();
    const first = setup(prefs);
    await userEvent.setup().click(screen.getByText("oscuro"));
    expect(prefs.get("theme")).toBe("dark");
    first.unmount();
    setup(prefs);
    expect(screen.getByTestId("state").textContent).toBe("dark/dark");
  });
  it("un valor guardado inválido se ignora y vuelve a 'sistema'", () => {
    mockMatchMedia(false);
    const prefs = new MemoryPreferences();
    prefs.set("theme", "arcoiris");
    setup(prefs);
    expect(screen.getByTestId("state").textContent).toBe("system/light");
  });
  it("al desmontar se quita el oyente del sistema", () => {
    const media = mockMatchMedia(false);
    const r = setup();
    expect(media.listenerCount()).toBe(1);
    r.unmount();
    expect(media.listenerCount()).toBe(0);
  });
});

describe("cambio del tema del sistema mientras se trabaja (U-036, RF-2.3, CL-4)", () => {
  it("cambia al instante sin recargar y sin quitar el foco de lo que se está escribiendo", async () => {
    const mm = mockMatchMedia(false);
    render(<ThemeProvider preferences={new MemoryPreferences()}><Panel /><input aria-label="nota" /></ThemeProvider>);
    const input = screen.getByLabelText("nota") as HTMLInputElement;
    input.focus();
    await userEvent.type(input, "hola");
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    act(() => mm.setDark(true));
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(document.activeElement).toBe(input);
    expect(input.value).toBe("hola");
  });
});


describe("temas de color en el proveedor (spec 006, T-033 a T-036)", () => {
  function Colors() {
    const { mode, resolved, palette, themeKey, setMode } = useTheme();
    return (
      <div>
        <p data-testid="s2">{mode}|{resolved}|{String(palette)}|{themeKey}</p>
        <button onClick={() => { (window as unknown as { __r: boolean }).__r = setMode("esmeralda"); }}>esmeralda</button>
        <button onClick={() => setMode("oceano")}>oceano</button>
        <button onClick={() => setMode("bosque")}>bosque</button>
        <button onClick={() => setMode("dark")}>oscuro</button>
        <input aria-label="nota" />
      </div>
    );
  }
  const pal = () => document.documentElement.getAttribute("data-palette");
  const mount = (prefs: PreferenceStore = new MemoryPreferences()) => render(<ThemeProvider preferences={prefs}><Colors /></ThemeProvider>);
  beforeEach(() => document.documentElement.removeAttribute("data-palette"));

  it("el contexto expone modo, variante, tema de color y themeKey", async () => {
    mockMatchMedia(false);
    mount();
    await userEvent.setup().click(screen.getByText("esmeralda"));
    expect(screen.getByTestId("s2").textContent).toBe("esmeralda|dark|esmeralda|esmeralda:dark");
    expect(attr()).toBe("dark");
    expect(pal()).toBe("esmeralda");
  });
  it("un valor guardado que ya no existe (arcoiris) vuelve a «sistema» sin tema de color", () => {
    mockMatchMedia(true);
    const prefs = new MemoryPreferences(); prefs.set("theme", "arcoiris");
    mount(prefs);
    expect(screen.getByTestId("s2").textContent).toBe("system|dark|null|system:dark");
    expect(pal()).toBeNull();
  });
  it("themeKey cambia entre temas de la misma variante (Océano → Bosque)", async () => {
    mockMatchMedia(false);
    mount();
    const user = userEvent.setup();
    await user.click(screen.getByText("oceano"));
    const a = screen.getByTestId("s2").textContent;
    await user.click(screen.getByText("bosque"));
    const b = screen.getByTestId("s2").textContent;
    expect(a).not.toBe(b);
    expect(attr()).toBe("light");
    expect(pal()).toBe("bosque");
  });
  it("setMode devuelve false si la preferencia no se pudo guardar, pero el tema se aplica", async () => {
    mockMatchMedia(false);
    const blocked: PreferenceStore = { get: () => null, set: () => false };
    mount(blocked);
    await userEvent.setup().click(screen.getByText("esmeralda"));
    expect((window as unknown as { __r: boolean }).__r).toBe(false);
    expect(pal()).toBe("esmeralda");
  });
  it("con un tema fijo, un cambio del sistema no altera los atributos (CL-5)", async () => {
    const media = mockMatchMedia(false);
    const prefs = new MemoryPreferences(); prefs.set("theme", "medianoche");
    mount(prefs);
    act(() => media.setDark(false));
    act(() => media.setDark(true));
    expect(attr()).toBe("dark");
    expect(pal()).toBe("medianoche");
    expect(media.listenerCount()).toBe(0);
  });
  it("cambiar de tema tres veces no desmonta ni pierde el texto ni el foco de un campo", async () => {
    mockMatchMedia(false);
    mount();
    const user = userEvent.setup();
    const input = screen.getByLabelText("nota") as HTMLInputElement;
    await user.type(input, "hola");
    for (const b of ["oceano", "esmeralda", "bosque"]) {
      input.focus();
      await user.click(screen.getByText(b));
      expect(screen.getByLabelText("nota")).toBe(input);
      expect(input.value).toBe("hola");
    }
  });
  it("Claro, Oscuro y Sistema no ponen data-palette", async () => {
    mockMatchMedia(false);
    mount();
    const user = userEvent.setup();
    await user.click(screen.getByText("esmeralda"));
    await user.click(screen.getByText("oscuro"));
    expect(pal()).toBeNull();
  });
});
