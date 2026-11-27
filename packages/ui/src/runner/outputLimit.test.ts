// study-features-2 (revisión): el tope de salida es el mismo para JavaScript y Python.
import { describe, it, expect } from "vitest";
import { createOutput } from "./outputLimit";

describe("tope de salida", () => {
  it("acumula stdout y stderr por separado mientras cabe", () => {
    const o = createOutput(100);
    expect(o.write("out", "a\n")).toBe(true);
    expect(o.write("err", "b\n")).toBe(true);
    expect([o.stdout(), o.stderr(), o.truncated()]).toEqual(["a\n", "b\n", false]);
  });
  it("al pasarse recorta lo que cabe, no añade texto propio (el aviso lo traduce la interfaz) y avisa para que se detenga la ejecución", () => {
    const o = createOutput(10);
    expect(o.write("out", "12345\n")).toBe(true);
    expect(o.write("out", "abcdefghij\n")).toBe(false);
    expect(o.truncated()).toBe(true);
    expect(o.stdout()).toBe("12345\nabcd");
    expect(o.write("out", "más")).toBe(false);
    expect(o.stdout()).toBe("12345\nabcd");
  });
  it("el tope cuenta stdout y stderr juntos", () => {
    const o = createOutput(8);
    o.write("out", "1234");
    expect(o.write("err", "56789")).toBe(false);
    expect(o.stderr()).toBe("5678");
    expect(o.stdout()).toBe("1234"); // el exceso de stderr no ensucia stdout
  });
});
