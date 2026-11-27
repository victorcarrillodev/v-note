// study-features-2 T-3 (prueba primero): ecuación en línea ($…$) dentro del texto de un bloque.
import { describe, it, expect } from "vitest";
import * as Y from "yjs";
import { toYjs } from "./toYjs";
import { fromYjs } from "./fromYjs";
import { defaultProps, inlineToText, type Block, type Inline } from "./types";
import { blocksToPlainText } from "../search/plainText";
import { blocksToMarkdown } from "../backup/markdown";
import { blocksToHtml } from "../export/html";
import { markdownToBlocks } from "../import/markdown";

const withMath: Block = {
  id: "b1", type: "paragraph", props: defaultProps("paragraph"), children: [],
  content: [
    { type: "text", text: "Sabemos que ", styles: {} },
    { type: "math", formula: "a^2 + b^2 = c^2" },
    { type: "text", text: " siempre", styles: { bold: true } },
  ],
};
const inl = (b: Block | undefined): Inline[] => (b?.content ?? []) as Inline[];
const roundTrip = (blocks: Block[]) => { const doc = new Y.Doc(); toYjs(blocks, doc.getXmlFragment("doc")); return fromYjs(doc.getXmlFragment("doc")); };

describe("ecuación en línea", () => {
  it("ida y vuelta por Yjs conserva la fórmula y el texto de alrededor", () => {
    expect(roundTrip([withMath])[0]!.content).toEqual(withMath.content);
  });
  it("el texto plano y la búsqueda incluyen la fórmula", () => {
    expect(inlineToText(withMath.content as never)).toBe("Sabemos que a^2 + b^2 = c^2 siempre");
    expect(blocksToPlainText([withMath])).toContain("a^2 + b^2 = c^2");
  });
  it("el respaldo en Markdown la escribe con $…$", () => {
    expect(blocksToMarkdown([withMath])).toContain("Sabemos que $a^2 + b^2 = c^2$");
  });
  it("la exportación a HTML la dibuja como MathML en línea y escapa lo que no es fórmula", () => {
    const html = blocksToHtml([withMath], { assets: new Map(), databases: new Map(), pageAnchors: new Map(), report: { missing: [], warnings: [] } });
    expect(html).toContain('<span class="math">');
    expect(html).toContain("<math");
    expect(html).not.toContain("displaystyle=\"true\"");
  });
  it("un respaldo en Markdown vuelve a importarse como ecuación en línea", () => {
    const md = blocksToMarkdown([withMath]);
    const [b] = markdownToBlocks(md).blocks;
    const items = inl(b);
    expect(items.find((i) => i.type === "math")).toEqual({ type: "math", formula: "a^2 + b^2 = c^2" });
    expect(items[0]).toEqual({ type: "text", text: "Sabemos que ", styles: {} });
  });
});

describe("importar $…$ sin confundir importes de dinero", () => {
  it("«$x^2$» es ecuación; «cuesta $5 y $6» sigue siendo texto", () => {
    const [eq] = markdownToBlocks("La fórmula $x^2$ es simple").blocks;
    expect(inl(eq).some((i) => i.type === "math")).toBe(true);
    const [money] = markdownToBlocks("Cuesta $5 y luego $6 más").blocks;
    expect(inl(money).every((i) => i.type === "text")).toBe(true);
  });
  it("un «\\$» escapado no abre ecuación", () => {
    const [b] = markdownToBlocks("Precio \\$a y \\$b").blocks;
    expect(inl(b).every((i) => i.type === "text")).toBe(true);
  });
});

describe("ecuaciones en línea en otros contextos (revisión)", () => {
  it("dentro de un enlace la fórmula no se pierde: queda como texto «$…$» dentro del enlace", () => {
    const [b] = markdownToBlocks("[coste $x^2$ aquí](https://a.b)").blocks;
    const link = inl(b).find((i) => i.type === "link") as { content: { text: string }[] };
    expect(link.content.map((c) => c.text).join("")).toBe("coste $x^2$ aquí");
  });
  it("dentro de listas y de negrita la fórmula se conserva", () => {
    const [li] = markdownToBlocks("- el área es $\\pi r^2$").blocks;
    expect(inl(li).some((i) => i.type === "math" && i.formula === "\\pi r^2")).toBe(true);
    const [b] = markdownToBlocks("**importante: $x$**").blocks;
    expect(inl(b).some((i) => i.type === "math" && i.formula === "x")).toBe(true);
  });
  it("un «$» literal del texto se escapa en el respaldo y no se reimporta como ecuación", () => {
    const literal: Block = { id: "l", type: "paragraph", props: defaultProps("paragraph"), children: [], content: [{ type: "text", text: "cuesta a $b$ c", styles: {} }] };
    const md = blocksToMarkdown([literal]);
    expect(md).toContain("cuesta a \\$b\\$ c");
    const [back] = markdownToBlocks(md).blocks;
    expect(inl(back).every((i) => i.type === "text")).toBe(true);
    expect(inlineToText(inl(back))).toBe("cuesta a $b$ c");
  });
  it("una ecuación de verdad sigue escribiéndose con «$…$» sin escapar", () => {
    expect(blocksToMarkdown([withMath])).toContain("Sabemos que $a^2 + b^2 = c^2$");
  });
});
