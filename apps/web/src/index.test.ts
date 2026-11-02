import { describe, it, expect } from "vitest";
import * as pkg from "./index";

describe("@vnote/web", () => {
  it("el paquete carga", () => {
    expect(pkg).toBeDefined();
  });
});
