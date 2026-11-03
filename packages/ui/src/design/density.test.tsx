// U-... (RF-10.4): hook que lee la densidad del documento y la altura de fila que le corresponde.
import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useDensity, rowHeightFor } from "./useDensity";
import { detectPlatform } from "./platform";

describe("densidad", () => {
  it("altura de fila: 32 px cómoda, 28 px compacta", () => { expect(rowHeightFor("comfortable")).toBe(32); expect(rowHeightFor("compact")).toBe(28); });
  it("el hook sigue el atributo data-density del documento", async () => {
    document.documentElement.removeAttribute("data-density");
    const { result } = renderHook(() => useDensity());
    expect(result.current).toBe("comfortable");
    await act(async () => { document.documentElement.setAttribute("data-density", "compact"); await Promise.resolve(); });
    expect(result.current).toBe("compact");
    document.documentElement.removeAttribute("data-density");
  });
});
describe("plataforma", () => {
  it("detecta macOS por la plataforma del navegador", () => {
    expect(detectPlatform("MacIntel")).toBe("mac");
    expect(detectPlatform("Linux x86_64")).toBe("other");
    expect(detectPlatform("Win32")).toBe("other");
    expect(detectPlatform(undefined)).toBe("other");
  });
});
