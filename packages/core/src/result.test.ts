// T-034 (prueba primero)
import { describe, it, expect } from "vitest";
import { ok, err, isOk, isErr, unwrap, mapResult, appError, ERROR_CODES } from "./result";

describe("Result", () => {
  it("construye y distingue éxito y error", () => {
    const a = ok(5);
    const b = err(appError("NOT_FOUND", "no existe"));
    expect(isOk(a) && !isErr(a)).toBe(true);
    expect(isErr(b) && !isOk(b)).toBe(true);
  });
  it("unwrap devuelve el valor o lanza el error con su código", () => {
    expect(unwrap(ok("x"))).toBe("x");
    expect(() => unwrap(err(appError("CONFLICT", "choque")))).toThrow(/CONFLICT/);
  });
  it("mapResult transforma solo los éxitos", () => {
    expect(mapResult(ok(2), (n) => n * 2)).toEqual(ok(4));
    const e = err(appError("INVALID", "mal"));
    expect(mapResult(e, (n: number) => n * 2)).toBe(e);
  });
  it("los errores se comparan por código y llevan detalles opcionales", () => {
    expect(appError("INVALID", "m", { campo: "titulo" })).toEqual({ code: "INVALID", message: "m", details: { campo: "titulo" } });
    expect(appError("INVALID", "m").details).toBeUndefined();
  });
  it("el catálogo contiene los códigos del dominio", () => {
    for (const c of ["NOT_FOUND", "INVALID", "CONFLICT", "CYCLE", "NEEDS_CONFIRMATION", "UNSUPPORTED_VERSION", "STORAGE"]) {
      expect(ERROR_CODES).toContain(c);
    }
  });
});
