import { describe, it, expect } from "vitest";
import { parseUnderline, formatUnderline, UNDERLINE_KINDS, UNDERLINE_COLORS } from "./underline";

describe("subrayado con estilo", () => {
  it("lee y escribe cada combinación de tipo y color", () => {
    for (const kind of UNDERLINE_KINDS) for (const color of UNDERLINE_COLORS) {
      expect(parseUnderline(formatUnderline({ kind, color }))).toEqual({ kind, color });
    }
  });
  it("un valor mal formado, desconocido o que no es texto no es un subrayado", () => {
    for (const bad of [undefined, null, true, 3, "", "marker", "marker:", ":red", "wavy:red", "marker:chartreuse", "MARKER:red", "marker:red:x"]) expect(parseUnderline(bad), String(bad)).toBeNull();
  });
});
