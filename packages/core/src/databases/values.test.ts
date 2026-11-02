// T-229…T-234 (prueba primero): validación y normalización del valor de una celda según el tipo de propiedad.
import { describe, it, expect } from "vitest";
import { validateValue, defaultConfig, STATUS_OPTIONS, type PropertyConfig } from "./values";

const ok = (type: Parameters<typeof validateValue>[0], raw: unknown, config: PropertyConfig = defaultConfig(type)) => {
  const r = validateValue(type, config, raw);
  if (!r.ok) throw new Error(`debía ser válido: ${JSON.stringify(raw)} -> ${r.error.message}`);
  return r.value;
};
const bad = (type: Parameters<typeof validateValue>[0], raw: unknown, config: PropertyConfig = defaultConfig(type)) => {
  const r = validateValue(type, config, raw);
  expect(r.ok, `debía rechazarse: ${JSON.stringify(raw)}`).toBe(false);
  return r.ok ? null : r.error;
};

describe("vacío", () => {
  it("null, undefined y cadena vacía borran la celda (valor null) en los tipos editables", () => {
    for (const t of ["text", "number", "select", "multi_select", "date", "url", "email", "phone", "files", "status"] as const) {
      expect(ok(t, null), t).toBeNull();
      expect(ok(t, undefined), t).toBeNull();
    }
    expect(ok("text", "")).toBeNull();
    expect(ok("url", "   ")).toBeNull();
  });
});

describe("texto, número y casilla (T-229)", () => {
  it("texto: conserva el texto tal cual (sin recortar) y rechaza no-textos", () => {
    expect(ok("text", "  hola mundo ")).toBe("  hola mundo ");
    bad("text", 5); bad("text", {}); bad("text", ["a"]);
  });
  it("número: acepta finitos y cadenas numéricas; rechaza NaN, infinitos y texto", () => {
    expect(ok("number", 3.5)).toBe(3.5);
    expect(ok("number", "42")).toBe(42);
    expect(ok("number", -0.25)).toBe(-0.25);
    expect(ok("number", 0)).toBe(0);
    bad("number", NaN); bad("number", Infinity); bad("number", "abc"); bad("number", true);
  });
  it("casilla: solo booleanos (false es un valor, no vacío)", () => {
    expect(ok("checkbox", true)).toBe(true);
    expect(ok("checkbox", false)).toBe(false);
    bad("checkbox", "sí"); bad("checkbox", 1);
    expect(ok("checkbox", null)).toBe(false); // sin valor = desmarcada
  });
});

describe("selección y selección múltiple (T-230)", () => {
  const cfg: PropertyConfig = { options: [{ id: "a", name: "Alta" }, { id: "b", name: "Baja" }, { id: "c", name: "Media" }] };
  it("select: acepta el id de una opción existente", () => {
    expect(ok("select", "a", cfg)).toBe("a");
    bad("select", "zzz", cfg); bad("select", ["a"], cfg); bad("select", 3, cfg);
  });
  it("multi_select: lista de ids existentes, sin repetidos y conservando el orden de las opciones", () => {
    expect(ok("multi_select", ["c", "a"], cfg)).toEqual(["a", "c"]);
    expect(ok("multi_select", ["a", "a"], cfg)).toEqual(["a"]);
    expect(ok("multi_select", [], cfg)).toBeNull();
    bad("multi_select", ["a", "zzz"], cfg); bad("multi_select", "a", cfg);
  });
});

describe("fecha (T-231)", () => {
  it("acepta inicio como fecha o fecha y hora ISO", () => {
    expect(ok("date", { start: "2026-03-05" })).toEqual({ start: "2026-03-05" });
    expect(ok("date", { start: "2026-03-05T14:30" })).toEqual({ start: "2026-03-05T14:30" });
    expect(ok("date", "2026-03-05")).toEqual({ start: "2026-03-05" }); // atajo: solo texto
  });
  it("acepta un rango con fin igual o posterior al inicio", () => {
    expect(ok("date", { start: "2026-03-05", end: "2026-03-09" })).toEqual({ start: "2026-03-05", end: "2026-03-09" });
    expect(ok("date", { start: "2026-03-05", end: "2026-03-05" })).toEqual({ start: "2026-03-05", end: "2026-03-05" });
    bad("date", { start: "2026-03-09", end: "2026-03-05" });
  });
  it("rechaza fechas inexistentes y formatos raros", () => {
    bad("date", { start: "2026-02-30" }); bad("date", { start: "ayer" }); bad("date", { start: "2026-13-01" }); bad("date", { end: "2026-03-05" }); bad("date", 20260305);
  });
  it("los años bisiestos se respetan", () => {
    expect(ok("date", "2028-02-29")).toEqual({ start: "2028-02-29" });
    bad("date", "2027-02-29");
  });
  it("las fechas de creación y edición no se editan a mano", () => {
    expect(bad("created_time", "2026-01-01")?.details).toMatchObject({ reason: "READ_ONLY" });
    expect(bad("last_edited_time", "2026-01-01")?.details).toMatchObject({ reason: "READ_ONLY" });
  });
});

describe("enlace web, correo y teléfono (T-232)", () => {
  it("url: solo http(s)", () => {
    expect(ok("url", " https://example.com/a?b=1 ")).toBe("https://example.com/a?b=1");
    expect(ok("url", "http://localhost:3000")).toBe("http://localhost:3000");
    for (const v of ["javascript:alert(1)", "ftp://x.org", "example.com", "https://", "http:// espacio.com", "data:text/html,x"]) bad("url", v);
  });
  it("correo: formato usuario@dominio.tld", () => {
    expect(ok("email", " yo@example.com ")).toBe("yo@example.com");
    expect(ok("email", "a.b+c@sub.example.org")).toBe("a.b+c@sub.example.org");
    for (const v of ["yo", "yo@", "@example.com", "yo@example", "yo @example.com", "yo@@example.com"]) bad("email", v);
  });
  it("teléfono: dígitos con +, espacios, guiones y paréntesis; entre 7 y 15 dígitos", () => {
    expect(ok("phone", "+52 (55) 1234-5678")).toBe("+52 (55) 1234-5678");
    expect(ok("phone", "5512345678")).toBe("5512345678");
    for (const v of ["123", "abc1234567", "+52 55 12345678901234567", "55-55-55-55-xx"]) bad("phone", v);
  });
});

describe("archivos (T-233)", () => {
  const h = "a".repeat(64);
  it("guarda referencias a adjuntos {hash, name, size}", () => {
    expect(ok("files", [{ hash: h, name: "doc.pdf", size: 10 }])).toEqual([{ hash: h, name: "doc.pdf", size: 10 }]);
  });
  it("rechaza hashes inválidos, nombres vacíos, tamaños negativos y duplicados exactos se unifican", () => {
    bad("files", [{ hash: "xyz", name: "a", size: 1 }]);
    bad("files", [{ hash: h, name: "", size: 1 }]);
    bad("files", [{ hash: h, name: "a", size: -1 }]);
    bad("files", "doc.pdf");
    expect(ok("files", [{ hash: h, name: "a", size: 1 }, { hash: h, name: "a", size: 1 }])).toHaveLength(1);
  });
  it("el mismo contenido con otro nombre son dos archivos distintos de la celda", () => {
    expect(ok("files", [{ hash: h, name: "a.txt", size: 1 }, { hash: h, name: "b.txt", size: 1 }])).toHaveLength(2);
  });
});

describe("estado (T-234)", () => {
  it("las opciones por defecto son Por hacer, En curso y Hecho", () => {
    expect(STATUS_OPTIONS.map((o) => o.id)).toEqual(["todo", "in_progress", "done"]);
    expect(defaultConfig("status")).toMatchObject({ options: STATUS_OPTIONS });
  });
  it("acepta cualquiera de los tres y rechaza otros", () => {
    for (const id of ["todo", "in_progress", "done"]) expect(ok("status", id)).toBe(id);
    bad("status", "cancelado"); bad("status", 1);
  });
});

describe("propiedades calculadas", () => {
  it("relación, rollup y fórmula no se escriben como valor", () => {
    for (const t of ["relation", "rollup", "formula"] as const) expect(bad(t, "x")?.details).toMatchObject({ reason: "READ_ONLY" });
  });
});
