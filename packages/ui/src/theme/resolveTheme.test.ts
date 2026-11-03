// U-033 (RF-2.1): resolución del tema a partir de la preferencia y del sistema.
import { describe, it, expect } from "vitest";
import { resolveTheme } from "./resolveTheme";

describe("resolveTheme", () => {
  it.each([
    ["light", false, "light"], ["light", true, "light"],
    ["dark", false, "dark"], ["dark", true, "dark"],
    ["system", false, "light"], ["system", true, "dark"],
  ] as const)("modo %s con sistema oscuro=%s → %s", (mode, sysDark, expected) => {
    expect(resolveTheme(mode, sysDark)).toBe(expected);
  });
  it("una preferencia desconocida se trata como «sistema»", () => {
    expect(resolveTheme("raro" as never, true)).toBe("dark");
    expect(resolveTheme(null as never, false)).toBe("light");
  });
});
