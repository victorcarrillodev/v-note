// R-016 y R-017 (prueba primero): alto del lienzo y su lectura/escritura tolerante (plan 004, §4.3 y §5.1).
import { describe, it, expect } from "vitest";
import { DEFAULT_DIAGRAM_HEIGHT, MIN_HEIGHT, MAX_HEIGHT, clampHeight, defaultMapHeight, readView, writeView } from "./view";
import { emptyDiagram, addNode, serializeDiagram, parseDiagram, type Diagram } from "./diagram";

describe("alto: constantes y clampHeight (R-016, RF-12)", () => {
  it("valores del plan", () => {
    expect(DEFAULT_DIAGRAM_HEIGHT).toBe(420);
    expect(MIN_HEIGHT).toBe(240);
    expect(MAX_HEIGHT).toBe(1600);
  });
  it("acota entre mínimo y máximo y redondea", () => {
    expect(clampHeight(100)).toBe(240);
    expect(clampHeight(240)).toBe(240);
    expect(clampHeight(500.4)).toBe(500);
    expect(clampHeight(500.6)).toBe(501);
    expect(clampHeight(5000)).toBe(1600);
  });
  it("un valor no numérico o no finito da el de por defecto", () => {
    expect(clampHeight(NaN)).toBe(420);
    expect(clampHeight("500")).toBe(420);
    expect(clampHeight(undefined)).toBe(420);
    expect(clampHeight(Infinity)).toBe(420);
    expect(clampHeight(null, 333)).toBe(333);
  });
  it("el alto por defecto del mapa muestra el contenido entre 320 y 560", () => {
    expect(defaultMapHeight(100)).toBe(320);
    expect(defaultMapHeight(400)).toBe(440);
    expect(defaultMapHeight(2000)).toBe(560);
  });
});

describe("readView y writeView (R-017)", () => {
  it("lee un view válido y acota su alto", () => {
    expect(readView({ height: 500 })).toEqual({ height: 500 });
    expect(readView({ height: 9999 })).toEqual({ height: 1600 });
    expect(readView({ height: 10 })).toEqual({ height: 240 });
  });
  it("lo no válido se descarta sin lanzar", () => {
    expect(readView(undefined)).toBeUndefined();
    expect(readView(null)).toBeUndefined();
    expect(readView("x")).toBeUndefined();
    expect(readView({})).toBeUndefined();
    expect(readView({ height: "alto" })).toBeUndefined();
    expect(readView({ height: NaN })).toBeUndefined();
  });
  it("writeView no emite nada sin valor", () => {
    expect(writeView(undefined)).toBeUndefined();
    expect(writeView({})).toBeUndefined();
    expect(writeView({ height: 500 })).toEqual({ height: 500 });
  });
});

describe("el diagrama y su view (R-017, RF-16)", () => {
  const base: Diagram = addNode(emptyDiagram(), { shape: "process", x: 0, y: 0, id: "a", text: "Hola" }).diagram;
  it("sin view se serializa exactamente igual que antes", () => {
    const text = serializeDiagram(base);
    expect(JSON.parse(text)).not.toHaveProperty("view");
    expect(text).toBe(serializeDiagram({ ...base }));
    const r = parseDiagram(text);
    expect(r.ok && serializeDiagram(r.value)).toBe(text);
  });
  it("con view lo escribe y lo conserva al leer", () => {
    const d: Diagram = { ...base, view: { height: 600 } };
    const text = serializeDiagram(d);
    expect(JSON.parse(text).view).toEqual({ height: 600 });
    const r = parseDiagram(text);
    expect(r.ok && r.value.view).toEqual({ height: 600 });
  });
  it("un view dañado se ignora al leer", () => {
    const text = JSON.stringify({ version: 2, nodes: [], edges: [], view: { height: "x" } });
    const r = parseDiagram(text);
    expect(r.ok).toBe(true);
    expect(r.ok && r.value.view).toBeUndefined();
  });
  it("un diagrama vacío no tiene view", () => { expect(emptyDiagram().view).toBeUndefined(); });
});
