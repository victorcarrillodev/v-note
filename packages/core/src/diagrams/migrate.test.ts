// G-025 a G-031 (prueba primero): migración de diagramas de la versión 1 a la 2. Pura, determinista y sin pérdida.
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { migrateV1 } from "./migrate";
import { parseDiagram, serializeDiagram, type Diagram } from "./diagram";
import { defaultNodeStyle, defaultEdgeStyle } from "./style";

const dir = join(import.meta.dirname, "fixtures", "v1");
const names = readdirSync(dir).filter((f) => f.endsWith(".json")).sort();
const load = (f: string) => readFileSync(join(dir, f), "utf8");
const raw = (f: string) => JSON.parse(load(f));

describe("archivos de referencia", () => {
  it("hay al menos cinco diagramas v1", () => { expect(names.length).toBeGreaterThanOrEqual(5); });
  it("cada uno tiene su v2 esperada en fixtures/v2", () => {
    const v2 = readdirSync(join(import.meta.dirname, "fixtures", "v2")).filter((f) => f.endsWith(".json")).sort();
    expect(v2).toEqual(names);
  });
  for (const f of names) {
    it(`${f}: la migración coincide con su v2 esperada`, () => {
      const expected = readFileSync(join(import.meta.dirname, "fixtures", "v2", f), "utf8");
      expect(JSON.parse(serializeDiagram(migrateV1(raw(f))))).toEqual(JSON.parse(expected));
    });
  }
});

describe("formas: el color pasa al relleno y el resto conserva el aspecto de antes", () => {
  it("un diagrama simple", () => {
    const m = migrateV1(raw("02-simple.json"));
    expect(m.nodes[0]).toEqual({ id: "a", shape: "terminator", x: 0, y: 0, w: 140, h: 50, text: "Inicio", style: { ...defaultNodeStyle("terminator"), fill: "palette:green" } });
    expect(m.nodes[1]!.style).toEqual(defaultNodeStyle("process"));
  });
  it("la nota conserva su contorno discontinuo", () => {
    const m = migrateV1(raw("03-todas-las-formas.json"));
    expect(m.nodes.find((n) => n.shape === "note")!.style.strokeDash).toBe("dashed");
    expect(m.nodes.filter((n) => n.shape !== "note").every((n) => n.style.strokeDash === "solid")).toBe(true);
  });
  it("un hexadecimal de la paleta (en mayúsculas o minúsculas) pasa a id de paleta; uno ajeno se queda en hexadecimal", () => {
    const m = migrateV1(raw("05-colores-no-estandar.json"));
    const fill = (id: string) => m.nodes.find((n) => n.id === id)!.style.fill;
    expect(fill("a")).toBe("palette:blue");
    expect(fill("b")).toBe("palette:white");
    expect(fill("c")).toBe("#ff8800");
    expect(fill("d")).toBe("#12345680");
    expect(fill("e")).toBe("#abc");
  });
  it("un color inválido de un archivo antiguo cae al relleno del sistema, sin lanzar", () => {
    const m = migrateV1({ nodes: [{ id: "a", shape: "process", x: 0, y: 0, w: 100, h: 50, text: "", color: 'red" onload="x' }], edges: [] });
    expect(m.nodes[0]!.style.fill).toBe("palette:blue");
  });
});

describe("conectores: salen del lado derecho y llegan al izquierdo, como se dibujaban", () => {
  it("cada conector queda unido a los anclajes este → oeste, con trazado redondeado y flecha al final", () => {
    const m = migrateV1(raw("04-conectores-cruzados.json"));
    expect(m.edges).toHaveLength(4);
    for (const e of m.edges) {
      expect(e.route).toBe("curved");
      expect(e.style).toEqual(defaultEdgeStyle());
    }
    expect(m.edges[0]).toMatchObject({ id: "e1", from: { node: "a", anchor: "e" }, to: { node: "d", anchor: "w" }, label: "" });
    expect(m.edges[3]).toMatchObject({ id: "e4", from: { node: "c", anchor: "e" }, to: { node: "b", anchor: "w" }, label: "vuelta" });
  });
});

describe("sin pérdida", () => {
  for (const f of names) {
    it(`${f}: texto, posiciones, tamaños, ids, etiquetas y conexiones se conservan`, () => {
      const v1 = raw(f), m = migrateV1(v1);
      expect(m.nodes.map((n) => [n.id, n.shape, n.x, n.y, n.w, n.h, n.text])).toEqual(v1.nodes.map((n: any) => [n.id, n.shape, n.x, n.y, n.w, n.h, n.text]));
      expect(m.edges.map((e) => [e.id, (e.from as any).node, (e.to as any).node, e.label])).toEqual(v1.edges.map((e: any) => [e.id, e.from, e.to, e.label]));
    });
  }
});

describe("pureza e idempotencia", () => {
  it("la entrada no se muta y el mismo resultado sale siempre", () => {
    const v1 = raw("03-todas-las-formas.json");
    const copy = JSON.parse(JSON.stringify(v1));
    const a = migrateV1(v1), b = migrateV1(v1);
    expect(v1).toEqual(copy);
    expect(serializeDiagram(a)).toBe(serializeDiagram(b));
  });
  it("migrar el resultado ya serializado como v2 no cambia nada", () => {
    for (const f of names) {
      const once = serializeDiagram(migrateV1(raw(f)));
      const again = parseDiagram(once);
      expect(again.ok).toBe(true);
      expect(serializeDiagram(again.ok ? again.value : ({} as Diagram))).toBe(once);
    }
  });
});

describe("parseDiagram acepta v1 y devuelve v2 sin tocar el texto guardado", () => {
  it("leer un v1 equivale a su migración, y el texto original no se modifica", () => {
    for (const f of names) {
      const text = load(f);
      const r = parseDiagram(text);
      expect(r.ok, f).toBe(true);
      expect(serializeDiagram(r.ok ? r.value : ({} as Diagram))).toBe(serializeDiagram(migrateV1(JSON.parse(text))));
      expect(text).toBe(load(f)); // el archivo de referencia no cambió
    }
  });
  it("un v1 dañado sigue rechazándose antes de migrar", () => {
    expect(parseDiagram(JSON.stringify({ nodes: [], edges: [{ id: "e", from: "x", to: "y", label: "" }] })).ok).toBe(false);
  });
});
