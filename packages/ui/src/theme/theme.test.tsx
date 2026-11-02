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
