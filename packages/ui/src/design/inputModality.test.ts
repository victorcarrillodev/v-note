// R-025 (prueba primero): detector de modalidad de entrada (plan 004, DP-13).
import { describe, it, expect, afterEach } from "vitest";
import { installInputModality } from "./inputModality";

let stop: (() => void) | undefined;
afterEach(() => { stop?.(); stop = undefined; document.documentElement.removeAttribute("data-input"); });
const root = () => document.documentElement;
const key = (k: string) => window.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true }));

describe("installInputModality", () => {
  it("un pointerdown pone «pointer»", () => {
    stop = installInputModality();
    window.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    expect(root().getAttribute("data-input")).toBe("pointer");
  });
  it("Tab, flechas, Enter y Esc ponen «keyboard»", () => {
    stop = installInputModality();
    for (const k of ["Tab", "ArrowDown", "ArrowLeft", "Enter", "Escape"]) {
      window.dispatchEvent(new Event("pointerdown", { bubbles: true }));
      expect(root().getAttribute("data-input")).toBe("pointer");
      key(k);
      expect(root().getAttribute("data-input"), k).toBe("keyboard");
    }
  });
  it("una letra normal no cambia la modalidad (escribir no activa el anillo)", () => {
    stop = installInputModality();
    window.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    key("a");
    expect(root().getAttribute("data-input")).toBe("pointer");
  });
  it("una tecla modificadora sola no cambia la modalidad", () => {
    stop = installInputModality();
    window.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    key("Shift"); key("Alt"); key("Control");
    expect(root().getAttribute("data-input")).toBe("pointer");
  });
  it("sin eventos previos no pone nada (el anillo de teclado es el valor por defecto)", () => {
    stop = installInputModality();
    expect(root().hasAttribute("data-input")).toBe(false);
  });
  it("la limpieza quita los oyentes", () => {
    const off = installInputModality();
    off();
    window.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    expect(root().hasAttribute("data-input")).toBe(false);
  });
});
