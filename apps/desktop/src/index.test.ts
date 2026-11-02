import { describe, it, expect } from "vitest";
import * as pkg from "./index";

describe("@vnote/desktop", () => {
  it("el paquete carga", () => {
    expect(pkg).toBeDefined();
  });
});
