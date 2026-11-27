// study-features-2 T-6 (prueba primero): plantillas de diagrama (flujo, ER y UML) sobre el modelo de diagramas.
import { describe, it, expect } from "vitest";
import { DIAGRAM_TEMPLATES, diagramTemplate, templateKeys } from "./templates";
import { isAttached, parseDiagram, serializeDiagram, type Diagram } from "./diagram";

const t = (k: string) => `«${k}»`;
const overlaps = (a: Diagram["nodes"][number], b: Diagram["nodes"][number]) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

describe.each(DIAGRAM_TEMPLATES)("plantilla «%s»", (id) => {
  const d = diagramTemplate(id, t);
  it("es un diagrama válido que sobrevive a guardarse y leerse", () => {
    const r = parseDiagram(serializeDiagram(d));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.nodes.map((n) => n.id)).toEqual(d.nodes.map((n) => n.id));
  });
  it("tiene al menos 3 formas, ids únicos, textos con contenido y ninguna encima de otra", () => {
    expect(d.nodes.length).toBeGreaterThanOrEqual(3);
    expect(new Set(d.nodes.map((n) => n.id)).size).toBe(d.nodes.length);
    expect(d.nodes.every((n) => n.text.trim() !== "")).toBe(true);
    for (let i = 0; i < d.nodes.length; i++) for (let j = i + 1; j < d.nodes.length; j++) expect(overlaps(d.nodes[i]!, d.nodes[j]!), `${d.nodes[i]!.text} / ${d.nodes[j]!.text}`).toBe(false);
  });
  it("todos los conectores unen formas que existen", () => {
    const ids = new Set(d.nodes.map((n) => n.id));
    expect(d.edges.length).toBeGreaterThanOrEqual(2);
    for (const e of d.edges) for (const end of [e.from, e.to]) { expect(isAttached(end)).toBe(true); if (isAttached(end)) expect(ids.has(end.node)).toBe(true); }
  });
  it("todos los textos pasan por la traducción: no queda ninguna clave sin traducir", () => {
    const texts = [...d.nodes.map((n) => n.text), ...d.edges.map((e) => e.label)].filter(Boolean);
    expect(texts.every((x) => x.includes("«") || /^[0-9N*.]+$/.test(x) || x.includes("\n") || x.length < 4)).toBe(true);
  });
  it("las claves de traducción que usa están declaradas", () => {
    const keys = templateKeys(id);
    expect(keys.length).toBeGreaterThan(0);
    const used = new Set<string>();
    diagramTemplate(id, (k) => { used.add(k); return k; });
    for (const k of used) expect(keys).toContain(k);
  });
});

describe("estructura de cada plantilla", () => {
  it("flujo: empieza y termina con terminadores y la decisión tiene dos salidas con etiqueta", () => {
    const d = diagramTemplate("flow", t);
    expect(d.nodes.filter((n) => n.shape === "terminator")).toHaveLength(2);
    const decision = d.nodes.find((n) => n.shape === "decision")!;
    const out = d.edges.filter((e) => isAttached(e.from) && e.from.node === decision.id);
    expect(out).toHaveLength(2);
    expect(out.every((e) => e.label.trim() !== "")).toBe(true);
  });
  it("ER: entidades con atributos y relaciones con cardinalidad", () => {
    const d = diagramTemplate("er", t);
    expect(d.nodes.filter((n) => n.shape === "process").every((n) => n.text.includes("\n"))).toBe(true);
    expect(d.edges.some((e) => e.label.includes("1")) && d.edges.some((e) => /N|\*/.test(e.label))).toBe(true);
  });
  it("UML: clases con atributos y métodos (+) y una relación con nombre", () => {
    const d = diagramTemplate("uml", t);
    expect(d.nodes.filter((n) => n.text.includes("+")).length).toBeGreaterThanOrEqual(2);
    expect(d.edges.some((e) => e.label.trim() !== "")).toBe(true);
  });
});
