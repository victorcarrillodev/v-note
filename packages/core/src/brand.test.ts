// T-030 (prueba primero): el nombre del producto se lee de la configuración de marca, no está escrito en el código.
import { describe, it, expect } from "vitest";
import { brand } from "./brand";

describe("brand", () => {
  it("expone el nombre y el identificador desde brand.config", () => {
    expect(brand.name).toBe("v-note");
    expect(brand.appId).toBe("dev.vnote.app");
  });
  it("el identificador solo contiene caracteres válidos para un id de aplicación", () => {
    expect(brand.appId).toMatch(/^[a-z0-9]+(\.[a-z0-9]+)+$/);
  });
});
