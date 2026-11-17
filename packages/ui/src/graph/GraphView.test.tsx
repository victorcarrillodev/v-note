// Spec 006 (T-041, DP-11): el grafo lee los colores del tema en cada dibujo y vuelve a hacerlo al pasar de un tema a otro de la MISMA variante.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithI18n } from "../../tests/renderWithI18n";
import { ThemeProvider, useTheme, MemoryPreferences } from "../theme/theme";

const readTokens = vi.fn((_el: Element, names: Record<string, string>) => Object.fromEntries(Object.keys(names).map((k) => [k, "#123456"])));
vi.mock("../design/canvasColors", async (orig) => ({ ...(await orig<typeof import("../design/canvasColors")>()), readTokens: (el: Element, n: Record<string, string>) => readTokens(el, n) }));
vi.mock("./layoutRunner", () => ({ computeLayout: async () => new Map([["a", { x: 0, y: 0 }]]) }));

import { GraphView } from "./GraphView";

const controller = { buildGraph: async () => ({ nodes: [{ id: "a", title: "A", kind: "note", trashed: false, degree: 0 }], edges: [], hasLinks: false }) } as never;
const fakeCtx = new Proxy({}, { get: (_t, p) => (p === "canvas" ? undefined : () => undefined), set: () => true });

function Switch() {
  const { setMode } = useTheme();
  return <><button onClick={() => setMode("oceano")}>oceano</button><button onClick={() => setMode("bosque")}>bosque</button><button onClick={() => setMode("dark")}>oscuro</button></>;
}

beforeEach(() => {
  readTokens.mockClear();
  HTMLCanvasElement.prototype.getContext = (() => fakeCtx) as never;
  (window as unknown as { matchMedia: unknown }).matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
});

describe("GraphView y el tema", () => {
  it("vuelve a leer los tokens al pasar de Océano a Bosque (misma variante)", async () => {
    await renderWithI18n(<ThemeProvider preferences={new MemoryPreferences()}><Switch /><GraphView controller={controller} currentPageId={null} onOpen={() => {}} /></ThemeProvider>);
    await waitFor(() => expect(readTokens).toHaveBeenCalled());
    const user = userEvent.setup();
    await user.click(screen.getByText("oceano"));
    const before = readTokens.mock.calls.length;
    await act(async () => { await user.click(screen.getByText("bosque")); });
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    expect(readTokens.mock.calls.length).toBeGreaterThan(before);
  });
});
