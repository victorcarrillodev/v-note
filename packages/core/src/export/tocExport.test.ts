// E-147 (RNF-8, RF-7.4): el bloque `toc` se exporta como lista de enlaces a los encabezados, en Markdown y en HTML.
import { describe, it, expect } from "vitest";
import { defaultProps, type Block } from "../blocks/types";
import { blocksToMarkdown } from "../backup/markdown";
import { blocksToHtml, newReport } from "./html";
import { headingAnchor, tocEntries, hasTocBlock } from "../pages/toc";

const t = (text: string) => [{ type: "text" as const, text, styles: {} }];
const h = (id: string, level: number, text: string): Block => ({ id, type: "heading", props: { ...defaultProps("heading"), level }, content: t(text), children: [] });
const p = (id: string, text: string): Block => ({ id, type: "paragraph", props: defaultProps("paragraph"), content: t(text), children: [] });
const toc = (id = "toc1"): Block => ({ id, type: "toc", props: {}, content: undefined, children: [] });
const ctx = () => ({ assets: new Map(), databases: new Map(), pageAnchors: new Map(), report: newReport() });

describe("anclas de encabezados", () => {
  it("minúsculas, sin signos y con guiones; conserva las letras acentuadas", () => {
    expect(headingAnchor("Introducción a Qué?")).toBe("introducción-a-qué");
    expect(headingAnchor("  Hola,   mundo!  ")).toBe("hola-mundo");
    expect(headingAnchor("¿¡!?")).toBe("seccion");
  });
  it("los encabezados repetidos reciben sufijos, como en GitHub", () => {
    const e = tocEntries([h("a", 1, "Uso"), h("b", 2, "Uso"), h("c", 2, "Uso")]);
    expect(e.map((x) => x.anchor)).toEqual(["uso", "uso-1", "uso-2"]);
  });
  it("detecta el bloque de índice aunque esté anidado", () => {
    expect(hasTocBlock([p("a", "x")])).toBe(false);
    expect(hasTocBlock([{ ...p("a", "x"), children: [toc()] }])).toBe(true);
  });
});

describe("Markdown (E-147)", () => {
  const doc = [toc(), h("a", 1, "Uno"), h("b", 2, "Dos"), h("c", 3, "Tres"), h("d", 1, "Uno"), p("p", "texto")];
  it("el bloque es una lista anidada de enlaces con las anclas de los encabezados", () => {
    expect(blocksToMarkdown(doc)).toBe([
      "- [Uno](#uno)", "  - [Dos](#dos)", "    - [Tres](#tres)", "- [Uno](#uno-1)", "",
      "# Uno", "", "## Dos", "", "### Tres", "", "# Uno", "", "texto", "",
    ].join("\n"));
  });
  it("sin encabezados no escribe nada", () => {
    expect(blocksToMarkdown([toc(), p("p", "texto")])).toBe("texto\n");
  });
  it("sin bloque de índice el Markdown no cambia (prueba dorada)", () => {
    expect(blocksToMarkdown([h("a", 1, "Uno"), p("p", "texto")])).toBe("# Uno\n\ntexto\n");
  });
});

describe("HTML (E-147)", () => {
  it("el bloque es una lista de enlaces a los encabezados, que llevan su id", () => {
    const html = blocksToHtml([toc(), h("a", 1, "Uno"), h("b", 2, "Dos")], ctx());
    expect(html).toContain('<nav class="toc"');
    expect(html).toContain('<a href="#uno">Uno</a>');
    expect(html).toContain('<a href="#dos">Dos</a>');
    expect(html).toContain('<h1 id="uno">Uno</h1>');
    expect(html).toContain('<h2 id="dos">Dos</h2>');
  });
  it("las listas se anidan por nivel", () => {
    const html = blocksToHtml([toc(), h("a", 1, "Uno"), h("b", 2, "Dos"), h("c", 1, "Tres")], ctx());
    expect(html).toContain('<li><a href="#uno">Uno</a><ul><li><a href="#dos">Dos</a></li></ul></li><li><a href="#tres">Tres</a></li>');
  });
  it("sin bloque de índice los encabezados no llevan id (la salida de siempre)", () => {
    expect(blocksToHtml([h("a", 1, "Uno")], ctx())).toBe("<h1>Uno</h1>");
  });
  it("el texto de los encabezados se escapa en el índice", () => {
    const html = blocksToHtml([toc(), h("a", 1, "<b>x</b> & y")], ctx());
    expect(html).not.toContain("<b>");
    expect(html).toContain("&lt;b&gt;");
  });
  it("un salto de dos niveles se anida un solo nivel y el HTML queda bien formado", () => {
    const html = blocksToHtml([toc(), h("a", 1, "Uno"), h("c", 3, "Tres"), h("d", 1, "Cuatro")], ctx());
    expect(html).toContain('<ul><li><a href="#uno">Uno</a><ul><li><a href="#tres">Tres</a></li></ul></li><li><a href="#cuatro">Cuatro</a></li></ul>');
  });
  it("sin encabezados, un índice vacío", () => {
    expect(blocksToHtml([toc(), p("p", "x")], ctx())).toContain('<nav class="toc"');
  });
});
