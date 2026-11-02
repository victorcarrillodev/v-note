import { describe, it, expect } from "vitest";
import { safeHttpUrl } from "./schema";

describe("safeHttpUrl", () => {
  it("acepta http y https y los normaliza", () => {
    expect(safeHttpUrl(" https://example.com/a ")).toBe("https://example.com/a");
    expect(safeHttpUrl("http://example.com")).toBe("http://example.com/");
  });
  it("rechaza esquemas peligrosos y texto que no es URL", () => {
    for (const bad of ["javascript:alert(1)", "data:text/html,x", "file:///etc/passwd", "ftp://x.org", "hola", ""]) expect(safeHttpUrl(bad), bad).toBeNull();
  });
});
