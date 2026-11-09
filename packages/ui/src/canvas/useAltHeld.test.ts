// R-063 (prueba primero): saber si Alt está pulsada para suspender el acomodo a la cuadrícula mientras se arrastra.
import { describe, it, expect } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useAltHeld } from "./useAltHeld";

const key = (type: "keydown" | "keyup", k: string, altKey = false) => act(() => { window.dispatchEvent(new KeyboardEvent(type, { key: k, altKey })); });

describe("useAltHeld", () => {
  it("es verdadero mientras Alt está pulsada", () => {
    const { result } = renderHook(() => useAltHeld());
    expect(result.current).toBe(false);
    key("keydown", "Alt", true); expect(result.current).toBe(true);
    key("keyup", "Alt"); expect(result.current).toBe(false);
  });
  it("se apaga si la ventana pierde el foco con Alt pulsada", () => {
    const { result } = renderHook(() => useAltHeld());
    key("keydown", "Alt", true);
    act(() => { window.dispatchEvent(new Event("blur")); });
    expect(result.current).toBe(false);
  });
  it("otras teclas no lo cambian", () => {
    const { result } = renderHook(() => useAltHeld());
    key("keydown", "a"); expect(result.current).toBe(false);
  });
});
