// U-168 (RF-5.8), E-054 a E-056 (RF-7.1, RF-7.8, CL-13): lógica pura del índice, en el núcleo.
import { describe, it, expect } from "vitest";
import { extractHeadings, shouldShowToc, activeHeading, MIN_HEADINGS } from "./toc";

const h = (id: string, level: number, text: string) => ({ id, type: "heading", props: { level }, content: [{ type: "text", text }] });
const p = (id: string, text: string) => ({ id, type: "paragraph", props: {}, content: [{ type: "text", text }] });
const many = (n: number) => Array.from({ length: n }, (_, i) => h(`h${i}`, (i % 3) + 1, `Título ${i}`));

describe("extractHeadings", () => {
  it("devuelve solo los encabezados, con nivel y texto", () => {
    expect(extractHeadings([p("a", "x"), h("b", 2, "Dos"), p("c", "y"), h("d", 1, "Uno")])).toEqual([{ id: "b", level: 2, text: "Dos" }, { id: "d", level: 1, text: "Uno" }]);
  });
  it("recorre bloques anidados y omite encabezados vacíos", () => {
    const nested = { ...p("n", "x"), children: [h("c1", 3, "Hijo")] };
    expect(extractHeadings([nested, h("e", 1, "  ")]).map((x) => x.id)).toEqual(["c1"]);
  });
  it("une varios fragmentos de texto en línea", () => {
    const b = { id: "m", type: "heading", props: { level: 1 }, content: [{ type: "text", text: "Hola " }, { type: "link", content: [{ type: "text", text: "mundo" }] }] };
    expect(extractHeadings([b])[0]!.text).toBe("Hola mundo");
  });
});
describe("extractHeadings con maxLevel (E-055)", () => {
  const doc = [h("a", 1, "Uno"), h("b", 2, "Dos"), h("c", 3, "Tres"), { ...p("n", "x"), children: [h("d", 3, "Hijo")] }];
  it("sin maxLevel incluye todos los niveles", () => {
    expect(extractHeadings(doc).map((x) => x.id)).toEqual(["a", "b", "c", "d"]);
  });
  it("filtra por nivel máximo 1, 2 o 3", () => {
    expect(extractHeadings(doc, 1).map((x) => x.id)).toEqual(["a"]);
    expect(extractHeadings(doc, 2).map((x) => x.id)).toEqual(["a", "b"]);
    expect(extractHeadings(doc, 3).map((x) => x.id)).toEqual(["a", "b", "c", "d"]);
  });
  it("sin encabezados devuelve una lista vacía", () => {
    expect(extractHeadings([p("a", "x")], 2)).toEqual([]);
  });
});
describe("extractHeadings con textos repetidos (E-056)", () => {
  it("cada entrada lleva el id de su bloque aunque el texto se repita", () => {
    const out = extractHeadings([h("x1", 2, "Ejemplo"), p("q", "…"), h("x2", 2, "Ejemplo")]);
    expect(out).toEqual([{ id: "x1", level: 2, text: "Ejemplo" }, { id: "x2", level: 2, text: "Ejemplo" }]);
  });
});
describe("shouldShowToc", () => {
  it("se muestra desde 3 encabezados", () => {
    expect(MIN_HEADINGS).toBe(3);
    expect([0, 2, 3, 50].map((n) => shouldShowToc(extractHeadings(many(n))))).toEqual([false, false, true, true]);
  });
  it("con 50 encabezados los extrae todos en orden", () => {
    expect(extractHeadings(many(50)).map((x) => x.id)).toEqual(many(50).map((x) => x.id));
  });
});
describe("activeHeading", () => {
  const hs = [{ id: "a", level: 1, text: "A" }, { id: "b", level: 1, text: "B" }, { id: "c", level: 1, text: "C" }];
  it("es el último encabezado cuyo borde superior ya pasó la línea de lectura", () => {
    expect(activeHeading(hs, { a: -300, b: -10, c: 200 }, 0)).toBe("b");
  });
  it("antes del primer encabezado marca el primero", () => {
    expect(activeHeading(hs, { a: 100, b: 300, c: 500 }, 0)).toBe("a");
  });
  it("sin encabezados devuelve null", () => { expect(activeHeading([], {}, 0)).toBeNull(); });
});
