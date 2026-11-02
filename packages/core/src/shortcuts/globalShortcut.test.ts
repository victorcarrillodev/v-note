// T-380, T-381 (prueba primero): conversión del atajo al formato nativo del sistema.
import { describe, it, expect } from "vitest";
import { toNativeCombo } from "./globalShortcut";

describe("atajo global (T-380)", () => {
  it("Mod se vuelve CommandOrControl y el resto se conserva", () => {
    expect(toNativeCombo("Mod+Shift+Space")).toBe("CommandOrControl+Shift+Space");
    expect(toNativeCombo("Mod+Alt+K")).toBe("CommandOrControl+Alt+K");
    expect(toNativeCombo("Alt+F9")).toBe("Alt+F9");
  });
  it("normaliza antes de convertir (Ctrl, Cmd y minúsculas)", () => {
    expect(toNativeCombo("ctrl+shift+space")).toBe("CommandOrControl+Shift+Space");
    expect(toNativeCombo("Cmd+Option+n")).toBe("CommandOrControl+Alt+N");
  });
});
