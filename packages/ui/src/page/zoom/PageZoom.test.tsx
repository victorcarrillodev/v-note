import { describe, it, expect } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithI18n } from "../../../tests/renderWithI18n";
import { MemoryPreferences } from "../../theme/theme";
import { PageZoom, parseZoom, stepZoom } from "./PageZoom";

const content = () => screen.getByTestId("page-zoom");
const factor = () => content().style.getPropertyValue("--page-zoom");
const wheel = (deltaY: number, ctrlKey = true) => {
  const e = new WheelEvent("wheel", { deltaY, ctrlKey, bubbles: true, cancelable: true });
  fireEvent(content(), e);
  return e;
};
const mount = (preferences = new MemoryPreferences()) => renderWithI18n(<main><PageZoom preferences={preferences}><p>nota</p></PageZoom></main>);

describe("zoom de página", () => {
  it("lee la preferencia guardada y la limita al rango", () => {
    expect([parseZoom(null), parseZoom("basura"), parseZoom("130"), parseZoom("900"), parseZoom("10")]).toEqual([100, 100, 130, 200, 50]);
    expect([stepZoom(100, 1), stepZoom(100, -1), stepZoom(200, 1), stepZoom(50, -1)]).toEqual([110, 90, 200, 50]);
  });

  it("Ctrl + rueda acerca y aleja, y evita el zoom del navegador", async () => {
    const prefs = new MemoryPreferences();
    await mount(prefs);
    expect(screen.queryByRole("group", { name: "Zoom de la página" })).toBeNull();
    expect(wheel(-100).defaultPrevented).toBe(true);
    expect(factor()).toBe("1.1");
    expect(prefs.get("zoom")).toBe("110");
    wheel(100); wheel(100);
    expect(factor()).toBe("0.9");
  });

  it("la rueda sin Ctrl desplaza como siempre", async () => {
    await mount();
    expect(wheel(-100, false).defaultPrevented).toBe(false);
    expect(factor()).toBe("");
  });

  it("acumula los pasos pequeños del panel táctil", async () => {
    await mount();
    for (let i = 0; i < 4; i++) wheel(-10);
    expect(factor()).toBe("");
    wheel(-10);
    expect(factor()).toBe("1.1");
  });

  it("el indicador permite acercar, alejar y restablecer", async () => {
    await mount();
    wheel(-100);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Acercar" }));
    expect(screen.getByRole("status")).toHaveTextContent("120 %");
    await user.click(screen.getByRole("button", { name: "Alejar" }));
    expect(screen.getByRole("status")).toHaveTextContent("110 %");
    await user.click(screen.getByRole("button", { name: "Restablecer zoom" }));
    expect(factor()).toBe("");
    expect(screen.getByRole("status")).toHaveTextContent("100 %");
  });
});
